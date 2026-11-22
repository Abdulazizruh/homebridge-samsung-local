#!/usr/bin/env python3
"""homebridge-samsung-local helper.

A small process the Homebridge plugin starts and stops. It speaks JSON lines on
stdin/stdout and drives Samsung appliances on the LAN through the
`smartthings-local` library (CoAP over DTLS). It needs no Home Assistant, no
MQTT and no SmartThings cloud account.

Protocol (one JSON object per line):
  request : {"id": 1, "op": "probe", "host": "192.0.2.10"}
  response: {"id": 1, "ok": true, "result": {...}} | {"id": 1, "ok": false, "error": {...}}
  event   : {"ev": "state" | "status", "key": "<device key>", ...}

The process exits as soon as stdin closes, so it can never outlive Homebridge.

Credential minting and the probing order follow the approach of
mbillow/localthings and QuiteYellow/SmartThings-Local (both MIT). See
THIRD_PARTY_NOTICES.md.
"""

from __future__ import annotations

import datetime
import json
import os
import random
import socket
import sys
import threading
import time
import zlib
import ipaddress
from concurrent.futures import ThreadPoolExecutor

HELPER_VERSION = "0.1.2"

# The identity Samsung appliances of this generation grant local access to.
# Published constant from SmartThings-Local's setup_cert.py (MIT).
DEFAULT_CLIENT_UUID = "ab0b0ac4-aae9-4958-a04d-8ec36fe1b2f9"

FALLBACK_PORTS = list(range(49152, 49161))
MULTICAST_SECURE_PORT = 5684
LEGACY_HTTP_PORT = 8888
# Distinct from LocalThings' 61000 base so both can run on one host.
LOCAL_PORT_BASE = 61300

READ_TIMEOUT_S = 10.0
WRITE_TIMEOUT_S = 8.0
CONNECT_TIMEOUT_S = 12.0
BACKOFF_STEPS_S = (5, 10, 20, 40, 60)
QUIET_RECONNECT_DELAY_S = 1.0
QUIET_RECONNECT_WAIT_S = 12.0

OBSERVE_HREFS = (
    "/power/vs/0",
    "/power/0",
    "/mode/vs/0",
    "/mode/convenient/vs/0",
    "/temperatures/vs/0",
    "/temperature/desired/0",
    "/wind/strength/vs/0",
    "/wind/direction/vs/0",
)

_out_lock = threading.Lock()


def emit(obj):
    line = json.dumps(obj, separators=(",", ":"), default=_json_default)
    with _out_lock:
        sys.stdout.write(line + "\n")
        sys.stdout.flush()


def _json_default(value):
    if isinstance(value, (bytes, bytearray)):
        return {"$bytes": bytes(value).hex()}
    if isinstance(value, (set, frozenset, tuple)):
        return list(value)
    return str(value)


class HelperError(Exception):
    """An error with a stable code the plugin can turn into guidance."""

    def __init__(self, code, message, **extra):
        super().__init__(message)
        self.code = code
        self.extra = extra

    def to_dict(self):
        return {"code": self.code, "message": str(self), **self.extra}


def classify(exc):
    """Map any exception to {code, message} without leaking key material."""
    if isinstance(exc, HelperError):
        return exc.to_dict()
    name = type(exc).__name__
    text = str(exc)[:300]
    code = "error"
    if name in ("AuthenticationError", "AuthorizationError"):
        code = "auth_rejected"
    elif name in ("SessionTimeoutError", "HandshakePeerCleanupError") or isinstance(exc, TimeoutError):
        code = "timeout"
    elif name in ("SessionClosedError", "SessionResetError", "SessionError", "EndpointError",
                  "ProbeError", "PeerInitiatedHandshakeError") or isinstance(exc, OSError):
        code = "connection"
    return {"code": code, "message": f"{name}: {text}"}


# --------------------------------------------------------------------------
# Credentials
# --------------------------------------------------------------------------

def ensure_credentials(cred_dir):
    """Create (once) and load the self-signed client certificate.

    The private key is generated on this machine and never leaves it. Files are
    written 0600. Nothing here contacts any server.
    """
    cert_path = os.path.join(cred_dir, "client.pem")
    key_path = os.path.join(cred_dir, "client.key")
    if os.path.isfile(cert_path) and os.path.isfile(key_path):
        with open(cert_path, encoding="utf-8") as fh:
            cert = fh.read()
        with open(key_path, encoding="utf-8") as fh:
            key = fh.read()
        return cert, key

    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID

    uuid = os.environ.get("SAMSUNG_LOCAL_CLIENT_UUID", DEFAULT_CLIENT_UUID).strip().lower()
    key_obj = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "KR"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Samsung Electronics"),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, f"uuid:{uuid}"),
        x509.NameAttribute(NameOID.COMMON_NAME, f"urn:uuid:{uuid}"),
    ])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert_obj = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key_obj.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=3650))
        .sign(key_obj, hashes.SHA256())
    )
    cert = cert_obj.public_bytes(serialization.Encoding.PEM).decode()
    key = key_obj.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    os.makedirs(cred_dir, mode=0o700, exist_ok=True)
    for path, text in ((cert_path, cert), (key_path, key)):
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
    return cert, key


# --------------------------------------------------------------------------
# Probing and reading
# --------------------------------------------------------------------------

def local_source_port(host):
    """A stable per-device UDP source port.

    Reconnecting from the same port replaces the appliance's stale peer entry
    instead of piling up new ones (measured by LocalThings, issue #486).
    """
    try:
        offset = int(ipaddress.IPv4Address(host)) & 0xFF
    except (ipaddress.AddressValueError, ValueError):
        offset = zlib.crc32(host.encode()) & 0xFF
    return LOCAL_PORT_BASE + offset


def legacy_http_open(host):
    try:
        with socket.create_connection((host, LEGACY_HTTP_PORT), timeout=2.0):
            return True
    except OSError:
        return False


def find_secure_ports(host):
    """Candidate DTLS ports, proven ones first. Returns (ports, details)."""
    from smartthings_local.protocol.dtls_probe import probe_dtls_ports
    from smartthings_local.protocol.ocf_discovery import discover_ocf_secure_ports

    details = {"advertised": [], "probe_outcome": None}
    advertised = ()
    try:
        adv = discover_ocf_secure_ports(host, timeout=2.5, retries=2)
        advertised = tuple(adv.ports or ())
        details["advertised"] = list(advertised)
        details["plaintext_answered"] = bool(adv.response_received)
    except Exception as exc:  # noqa: BLE001 - discovery is best effort
        details["discovery_error"] = type(exc).__name__

    ports = [p for p in advertised if p != MULTICAST_SECURE_PORT]
    ports += [p for p in FALLBACK_PORTS if p not in ports]
    ports.append(MULTICAST_SECURE_PORT)
    preferred = next((p for p in advertised if p != MULTICAST_SECURE_PORT), None)
    try:
        result = probe_dtls_ports(host, ports[:32], preferred_port=preferred, timeout=3.0, retries=2)
        details["probe_outcome"] = result.outcome
        details["responders"] = [
            {"dialled": r.port, "kind": r.response_kind, "from": r.responder_port}
            for r in result.results if r.response_kind is not None
        ][:12]
        if result.selected_port is not None:
            return [result.selected_port], details
        responders = list(result.responder_ports)
        if responders:
            return responders, details
    except Exception as exc:  # noqa: BLE001
        details["probe_error"] = type(exc).__name__
    return [], details


def _decode(code, payload):
    import cbor2

    if not payload:
        return code, None
    if code >> 5 != 2:
        return code, None
    return code, cbor2.loads(payload)


def code_str(code):
    return f"{code >> 5}.{code & 0x1F:02d}"


def parse_batch(body):
    """{href: rep} out of a /device/0 batch (same rule as LocalThings)."""
    out = {}
    for entry in body or []:
        if not isinstance(entry, dict):
            continue
        href, rep = entry.get("href"), entry.get("rep")
        if href and isinstance(rep, dict) and "oic.wk.col" not in (rep.get("rt") or ()):
            out[href] = rep
    return out


def links_of(body):
    if isinstance(body, list):
        if body and isinstance(body[0], dict) and isinstance(body[0].get("links"), list):
            return body[0]["links"]
        return [x for x in body if isinstance(x, dict)]
    if isinstance(body, dict) and isinstance(body.get("links"), list):
        return body["links"]
    return []


class Link:
    """One DTLS session to one appliance, with serialized requests."""

    def __init__(self, host, port, cert, key, on_notification=None):
        from smartthings_local.protocol.auth import CertificateAuth
        from smartthings_local.protocol.dtls_session import DtlsCoapSession

        self.host, self.port = host, port
        self._lock = threading.Lock()
        kwargs = {
            "auth": CertificateAuth.from_memory(cert, key),
            "local_port": local_source_port(host),
        }
        if on_notification is not None:
            kwargs["on_notification"] = on_notification
        self._session = DtlsCoapSession(host, port, **kwargs)
        self._batch_query = None

    def connect(self):
        self._session.connect(timeout=CONNECT_TIMEOUT_S)
        self._session.start_reader()

    def close(self):
        try:
            self._session.close()
        except Exception:  # noqa: BLE001
            try:
                self._session.abort()
            except Exception:  # noqa: BLE001
                pass

    def get(self, path, query=(), timeout=READ_TIMEOUT_S):
        with self._lock:
            return _decode(*self._session.get(list(path), query=tuple(query), timeout=timeout))

    def post(self, path, body, timeout=WRITE_TIMEOUT_S):
        import cbor2

        with self._lock:
            code, payload = self._session.post(list(path), cbor2.dumps(body), timeout=timeout)
        text = None
        if payload:
            try:
                decoded = cbor2.loads(payload)
                text = decoded if isinstance(decoded, str) else None
            except Exception:  # noqa: BLE001
                text = None
        return code, text

    def subscribe(self, href):
        with self._lock:
            self._session.subscribe([s for s in href.split("/") if s])

    def read_identity(self):
        ident = {}
        for name, path in (("d", ["oic", "d"]), ("p", ["oic", "p"])):
            try:
                code, body = self.get(path, timeout=6.0)
            except Exception:  # noqa: BLE001
                code, body = 0, None
            if code == 0x81:
                raise HelperError("auth_rejected", "The appliance refused this certificate (4.01).")
            ident[name] = body if isinstance(body, dict) else {}
        d, p = ident["d"], ident["p"]
        types = d.get("rt") if isinstance(d.get("rt"), list) else []
        return {
            "di": d.get("di") if isinstance(d.get("di"), str) else None,
            "pi": p.get("pi") if isinstance(p.get("pi"), str) else None,
            "name": d.get("n") or "",
            "manufacturer": p.get("mnmn") or "Samsung",
            "platformModel": p.get("mnmo") or "",
            "types": [t for t in types if isinstance(t, str)],
        }

    def read_resources(self):
        """All resources as {href: rep}. Batch read, per-href as fallback."""
        if self._batch_query is None:
            code, body = self.get(["device", "0"])
            if code == 0x45 and isinstance(body, dict) and isinstance(body.get("links"), list):
                code, body = self.get(["device", "0"], query=("if=oic.if.b",))
                if code == 0x45 and isinstance(body, list):
                    self._batch_query = ("if=oic.if.b",)
            elif code == 0x45:
                self._batch_query = ()
        else:
            code, body = self.get(["device", "0"], query=self._batch_query)
        if code == 0x45 and isinstance(body, list):
            return parse_batch(body), "batch"
        if code == 0x81:
            raise HelperError("auth_rejected", "The appliance refused this certificate (4.01).")
        if code != 0x84:
            raise HelperError("unexpected_response", f"/device/0 answered {code_str(code)}")
        # No /device/0 collection: read what /oic/res lists, one by one.
        code, body = self.get(["oic", "res"])
        out = {}
        for link in links_of(body)[:80]:
            href = link.get("href") if isinstance(link, dict) else None
            if not isinstance(href, str) or href.startswith("/oic/") or href.startswith("/oic/sec"):
                continue
            try:
                c, rep = self.get([s for s in href.split("/") if s], timeout=6.0)
            except Exception:  # noqa: BLE001
                continue
            if c == 0x45 and isinstance(rep, dict):
                out[href] = rep
        if not out:
            raise HelperError("no_resources", "The appliance answered but exposed no readable resources.")
        return out, "per_href"


def open_link(host, port, cert, key, on_notification=None):
    """Connect, trying a known port first and discovering otherwise."""
    tried, details = [], {}
    candidates = [port] if port else []
    last = None
    for attempt in range(2):
        if not candidates:
            candidates, details = find_secure_ports(host)
        for candidate in candidates:
            if candidate in tried:
                continue
            tried.append(candidate)
            link = Link(host, candidate, cert, key, on_notification)
            try:
                link.connect()
                return link, details
            except Exception as exc:  # noqa: BLE001
                last = exc
                link.close()
        candidates = []
    if not tried:
        if legacy_http_open(host):
            raise HelperError(
                "legacy_http",
                "This appliance only offers the older TCP 8888 interface, which this plugin does not support yet.",
            )
        raise HelperError(
            "no_local_api",
            "No local DTLS endpoint answered at this address. Check the IP address, that the appliance is on, "
            "and that Homebridge uses host networking.",
            details=details,
        )
    info = classify(last) if last else {"code": "connection", "message": "handshake failed"}
    info["triedPorts"] = tried
    info["details"] = details
    info["diagnosis"] = diagnose(host, tried[0], cert, key)
    raise HelperError(info.pop("code"), info.pop("message"), **info)


def diagnose(host, port, cert, key):
    """Why a handshake failed, in the appliance's own words (best effort).

    Reports the DTLS outcome and any fatal alert the appliance sent. Never
    includes key material.
    """
    try:
        from smartthings_local.protocol.dtls_probe import diagnose_dtls_handshake

        result = diagnose_dtls_handshake(host, port, cert_pem=cert, key_pem=key, retries=1, timeout=4.0)
        alert = result.alert
        return {
            "port": port,
            "outcome": result.outcome,
            "alert": alert[1] if isinstance(alert, (tuple, list)) and len(alert) > 1 else (str(alert) if alert else None),
            "flight": [str(m) for m in (result.handshake_msgs or [])][:12],
        }
    except Exception as exc:  # noqa: BLE001
        return {"port": port, "error": type(exc).__name__}


def probe(host, cred_dir, port=None):
    cert, key = ensure_credentials(cred_dir)
    link, details = open_link(host, port, cert, key)
    try:
        identity = link.read_identity()
        resources, read_mode = link.read_resources()
    finally:
        link.close()
    return {
        "host": host,
        "port": link.port,
        "identity": identity,
        "resources": resources,
        "readMode": read_mode,
        "discovery": details,
    }


# --------------------------------------------------------------------------
# Long-lived device workers
# --------------------------------------------------------------------------

class DeviceWorker(threading.Thread):
    def __init__(self, key, host, port, cred_dir, expected_di, poll_interval, push):
        super().__init__(daemon=True, name=f"device-{key}")
        self.key, self.host, self.port = key, host, port
        self.cred_dir, self.expected_di = cred_dir, expected_di
        self.poll_interval = max(2.0, float(poll_interval))
        self.push = push
        self._stop = threading.Event()
        self._wake = threading.Event()
        self._wake_at = None
        self._link = None
        self._link_lock = threading.Lock()
        self._linked = threading.Event()
        self._reconnecting = False
        self.notifications = 0

    # -- called from other threads -----------------------------------------
    def stop(self):
        self._stop.set()
        self._wake.set()

    def request_refresh(self, delay=0.0):
        self._wake_at = time.monotonic() + delay
        self._wake.set()

    def write(self, path, body):
        if self._reconnecting:
            # A session that just dropped is being reopened: wait for it
            # rather than failing the command.
            self._linked.wait(QUIET_RECONNECT_WAIT_S)
        with self._link_lock:
            link = self._link
        if link is None:
            raise HelperError("offline", "The appliance is not connected right now.")
        code, text = link.post(path, body)
        self.request_refresh(1.5)
        return {"code": code_str(code), "accepted": code >> 5 == 2, "detail": text}

    # -- worker ------------------------------------------------------------
    def _on_notification(self, href, payload):
        # Runs on the session's reader thread: never do I/O here.
        self.notifications += 1
        self.request_refresh(0.3)

    def _sleep(self, seconds):
        return self._stop.wait(seconds)

    def run(self):
        failures = 0
        was_online = False
        while not self._stop.is_set():
            link = None
            # A healthy session that drops gets one immediate, silent
            # reconnect before the appliance is reported as unreachable.
            quiet = was_online
            was_online = False
            try:
                cert, key = ensure_credentials(self.cred_dir)
                link, _ = open_link(self.host, self.port, cert, key,
                                    self._on_notification if self.push else None)
                self.port = link.port
                identity = link.read_identity()
                if self.expected_di and identity["di"] and identity["di"] != self.expected_di:
                    raise HelperError(
                        "identity_mismatch",
                        "A different appliance answered at this address. Update the IP address in the plugin settings.",
                        fatal=True,
                    )
                resources, _mode = link.read_resources()
                with self._link_lock:
                    self._link = link
                self._linked.set()
                self._reconnecting = False
                was_online = True
                failures = 0
                emit({"ev": "status", "key": self.key, "online": True, "port": link.port,
                      "identity": identity})
                emit({"ev": "state", "key": self.key, "resources": resources})
                if self.push:
                    for href in OBSERVE_HREFS:
                        if href in resources and not self._stop.is_set():
                            try:
                                link.subscribe(href)
                            except Exception:  # noqa: BLE001 - push is optional
                                pass
                self._loop(link)
            except Exception as exc:  # noqa: BLE001
                info = classify(exc)
                quiet = was_online and not info.get("fatal") and not self._stop.is_set()
                if not quiet:
                    self._reconnecting = False
                    emit({"ev": "status", "key": self.key, "online": False, "error": info})
                if info.get("fatal"):
                    # Wrong appliance at this address: retry slowly, never spam it.
                    failures = len(BACKOFF_STEPS_S)
            else:
                quiet = False
            finally:
                self._linked.clear()
                with self._link_lock:
                    self._link = None
                if link is not None:
                    link.close()
            if self._stop.is_set():
                break
            if quiet:
                self._reconnecting = True
                if self._sleep(QUIET_RECONNECT_DELAY_S):
                    break
                continue
            step = BACKOFF_STEPS_S[min(failures, len(BACKOFF_STEPS_S) - 1)]
            failures += 1
            if self._sleep(step + random.uniform(0, step * 0.2)):
                break

    def _loop(self, link):
        next_poll = time.monotonic() + self.poll_interval
        while not self._stop.is_set():
            # Clear before reading the deadline so a refresh request that
            # lands in between still wakes the wait below.
            self._wake.clear()
            wake_at = self._wake_at
            due = next_poll if wake_at is None else min(next_poll, wake_at)
            now = time.monotonic()
            if due > now:
                self._wake.wait(due - now)
                continue
            self._wake_at = None
            resources, _mode = link.read_resources()
            emit({"ev": "state", "key": self.key, "resources": resources, "pushes": self.notifications})
            next_poll = time.monotonic() + self.poll_interval


# --------------------------------------------------------------------------
# Request loop
# --------------------------------------------------------------------------

class Helper:
    def __init__(self, cred_dir):
        self.cred_dir = cred_dir
        self.workers = {}
        self.lock = threading.Lock()
        self.pool = ThreadPoolExecutor(max_workers=6, thread_name_prefix="req")

    def handle(self, req):
        op = req.get("op")
        if op == "hello":
            import smartthings_local  # noqa: F401 - proves the runtime is usable
            from importlib.metadata import version

            return {"helper": HELPER_VERSION, "python": sys.version.split()[0],
                    "library": version("smartthings-local")}
        if op == "probe":
            return probe(str(req["host"]), self.cred_dir, req.get("port"))
        if op == "open":
            key = str(req["key"])
            with self.lock:
                old = self.workers.pop(key, None)
            if old:
                old.stop()
                old.join(timeout=10)
            worker = DeviceWorker(key, str(req["host"]), req.get("port"), self.cred_dir,
                                  req.get("expectedDi"), req.get("pollInterval", 15),
                                  bool(req.get("push", True)))
            with self.lock:
                self.workers[key] = worker
            worker.start()
            return {"opened": key}
        if op == "close":
            with self.lock:
                worker = self.workers.pop(str(req["key"]), None)
            if worker:
                worker.stop()
                worker.join(timeout=10)
            return {"closed": bool(worker)}
        if op in ("write", "refresh"):
            with self.lock:
                worker = self.workers.get(str(req["key"]))
            if worker is None:
                raise HelperError("unknown_device", "No such device is open.")
            if op == "refresh":
                worker.request_refresh(float(req.get("delay", 0)))
                return {"scheduled": True}
            return worker.write(req["path"], req["body"])
        raise HelperError("bad_request", f"unknown op {op!r}")

    def dispatch(self, req):
        rid = req.get("id")
        try:
            emit({"id": rid, "ok": True, "result": self.handle(req)})
        except Exception as exc:  # noqa: BLE001
            emit({"id": rid, "ok": False, "error": classify(exc)})

    def shutdown(self):
        with self.lock:
            workers, self.workers = list(self.workers.values()), {}
        for worker in workers:
            worker.stop()
        for worker in workers:
            worker.join(timeout=8)
        self.pool.shutdown(wait=False, cancel_futures=True)


def main():
    cred_dir = os.environ.get("SAMSUNG_LOCAL_CRED_DIR")
    if not cred_dir:
        sys.stderr.write("SAMSUNG_LOCAL_CRED_DIR is required\n")
        return 2
    helper = Helper(cred_dir)
    emit({"ev": "ready", "helper": HELPER_VERSION})
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                req = json.loads(line)
            except ValueError:
                continue
            if req.get("op") == "shutdown":
                break
            helper.pool.submit(helper.dispatch, req)
    except KeyboardInterrupt:
        pass
    finally:
        helper.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
