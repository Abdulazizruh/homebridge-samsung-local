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

HELPER_VERSION = "0.1.5"

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
QUIET_RECONNECT_DELAY_S = 2.0
# A short gap (a few lost packets) must not cost the session: a read that
# times out is retried on the same session before any reconnect.
READ_RETRIES = 2
READ_RETRY_PAUSE_S = 1.5
# After a working session drops, reconnects stay silent for this long. The
# appliance is reported unreachable only if it is still gone afterwards.
OFFLINE_GRACE_S = 30.0
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
# Finding an appliance again after its address changed
# --------------------------------------------------------------------------
# An appliance is known by the device id it reports. Its IP address is only
# where it was last seen, and its MAC address is a shortcut for finding it
# again. Nothing here changes any network setting; it only looks.

OCF_PORT = 5683
ARP_FILE = "/proc/net/arp"
RELOCATE_AFTER_ROUNDS = 2       # failed reconnect rounds before looking elsewhere
RELOCATE_MIN_INTERVAL_S = 300.0
RELOCATE_MAX_CANDIDATES = 12
# CoAP NON GET /oic/res: any OCF device answers it, and merely sending it
# makes the kernel resolve the neighbour's MAC address.
_OIC_RES_GET = bytes([0x50, 0x01, 0x53, 0x4C, 0xB3]) + b"oic" + bytes([0x03]) + b"res"


def normalize_mac(text):
    """'AA-BB-CC-DD-EE-FF', 'aabb.ccdd.eeff', ... -> 'aa:bb:cc:dd:ee:ff' or None."""
    digits = "".join(ch for ch in str(text or "").lower() if ch in "0123456789abcdef")
    raw = str(text or "").strip().lower()
    if len(digits) != 12 or any(ch not in "0123456789abcdef:-. " for ch in raw):
        return None
    if digits in ("000000000000", "ffffffffffff"):
        return None
    return ":".join(digits[i:i + 2] for i in range(0, 12, 2))


def parse_arp(text):
    """{ip: mac} from the kernel's neighbour table (/proc/net/arp format)."""
    table = {}
    for line in str(text or "").splitlines()[1:]:
        parts = line.split()
        if len(parts) < 4:
            continue
        mac = normalize_mac(parts[3])
        try:
            complete = int(parts[2], 16) & 0x2
        except ValueError:
            complete = 0
        if mac and complete:
            table[parts[0]] = mac
    return table


def arp_table():
    try:
        with open(ARP_FILE, encoding="ascii", errors="replace") as fh:
            return parse_arp(fh.read())
    except OSError:
        return {}


def primary_ipv4():
    """This machine's address on its default route (no packet is sent)."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("192.0.2.1", 9))
        return sock.getsockname()[0]
    except OSError:
        return None
    finally:
        sock.close()


def sweep_networks(hints):
    """The /24 networks worth searching: around each hint and around us."""
    nets = []
    for host in list(hints or ()) + [primary_ipv4()]:
        try:
            net = ipaddress.ip_network(f"{ipaddress.IPv4Address(host)}/24", strict=False)
        except (ipaddress.AddressValueError, ValueError, TypeError):
            continue
        if net.is_private and net not in nets:
            nets.append(net)
    return nets[:4]


def sweep(networks, wait=2.0):
    """Ask every address on the given networks for /oic/res once.

    Returns the set of addresses that answered. One small UDP datagram per
    address; private networks only.
    """
    answered = set()
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    except OSError:
        return answered
    try:
        sock.setblocking(False)
        for net in networks:
            for addr in net.hosts():
                try:
                    sock.sendto(_OIC_RES_GET, (str(addr), OCF_PORT))
                except OSError:
                    continue
        deadline = time.monotonic() + wait
        while time.monotonic() < deadline:
            try:
                _data, peer = sock.recvfrom(2048)
                answered.add(peer[0])
            except (BlockingIOError, InterruptedError):
                time.sleep(0.05)
            except OSError:
                break
    finally:
        sock.close()
    return answered


def identity_at(host, cred_dir):
    """The device id answering at this address, or None."""
    link = None
    try:
        cert, key = ensure_credentials(cred_dir)
        link, _ = open_link(host, None, cert, key)
        return link.read_identity().get("di")
    except Exception:  # noqa: BLE001 - not our appliance, or not reachable
        return None
    finally:
        if link is not None:
            link.close()


def locate(cred_dir, di=None, mac=None, hints=(), exclude=()):
    """Find where an appliance is now.

    Looks for its MAC address first, then at every OCF device that answers.
    When a device id is given, an address is returned only after the
    appliance there proved to be that device over the authenticated session.
    Returns {"host", "mac"} or None.
    """
    mac = normalize_mac(mac)
    answered = sweep(sweep_networks(hints))
    table = arp_table()
    skip = set(exclude or ())
    candidates = [ip for ip, seen in table.items() if mac and seen == mac and ip not in skip]
    if di:
        candidates += sorted(ip for ip in answered if ip not in skip and ip not in candidates)
    for host in candidates[:RELOCATE_MAX_CANDIDATES]:
        if di and identity_at(host, cred_dir) != di:
            continue
        return {"host": host, "mac": table.get(host) or mac}
    return None


# --------------------------------------------------------------------------
# Long-lived device workers
# --------------------------------------------------------------------------

class DeviceWorker(threading.Thread):
    def __init__(self, key, host, port, cred_dir, expected_di, poll_interval, push,
                 mac=None, other_hosts=lambda: (), follow=True):
        super().__init__(daemon=True, name=f"device-{key}")
        self.follow = follow
        self.mac = normalize_mac(mac)
        self._other_hosts = other_hosts
        self._last_relocate = 0.0
        self.key, self.host, self.port = key, host, port
        self.cred_dir, self.expected_di = cred_dir, expected_di
        self.poll_interval = max(2.0, float(poll_interval))
        self.push = push
        self._stopping = threading.Event()
        self._wake = threading.Event()
        self._wake_at = None
        self._link = None
        self._link_lock = threading.Lock()
        self._linked = threading.Event()
        self._reconnecting = False
        self.notifications = 0

    # -- called from other threads -----------------------------------------
    def stop(self):
        self._stopping.set()
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
        return self._stopping.wait(seconds)

    def run(self):
        failures = 0
        offline_rounds = 0
        was_online = False
        grace_until = None  # while set and in the future, reconnects are silent
        while not self._stopping.is_set():
            link = None
            quiet = False
            if was_online:
                grace_until = time.monotonic() + OFFLINE_GRACE_S
            was_online = False
            started = time.monotonic()
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
                grace_until = None
                failures = 0
                offline_rounds = 0
                self.mac = arp_table().get(self.host) or self.mac
                emit({"ev": "status", "key": self.key, "online": True, "port": link.port,
                      "identity": identity, "host": self.host, "mac": self.mac,
                      "timing": {"totalMs": int((time.monotonic() - started) * 1000)}})
                emit({"ev": "state", "key": self.key, "resources": resources})
                if self.push:
                    for href in OBSERVE_HREFS:
                        if href in resources and not self._stopping.is_set():
                            try:
                                link.subscribe(href)
                            except Exception:  # noqa: BLE001 - push is optional
                                pass
                self._loop(link)
            except Exception as exc:  # noqa: BLE001
                info = classify(exc)
                if was_online:
                    grace_until = time.monotonic() + OFFLINE_GRACE_S
                    was_online = False
                quiet = (grace_until is not None and time.monotonic() < grace_until
                         and not info.get("fatal") and not self._stopping.is_set())
                if not quiet:
                    grace_until = None
                    self._reconnecting = False
                    emit({"ev": "status", "key": self.key, "online": False, "error": info})
                if not quiet:
                    offline_rounds += 1
                if info.get("fatal"):
                    # Wrong appliance at this address: retry slowly, never spam it.
                    failures = len(BACKOFF_STEPS_S)
                    offline_rounds = max(offline_rounds, RELOCATE_AFTER_ROUNDS)
            else:
                quiet = False
            finally:
                self._linked.clear()
                with self._link_lock:
                    self._link = None
                if link is not None:
                    link.close()
            if self._stopping.is_set():
                break
            if not quiet and offline_rounds >= RELOCATE_AFTER_ROUNDS and self._relocate():
                failures = 0
                offline_rounds = 0
                continue
            if quiet:
                self._reconnecting = True
                if self._sleep(QUIET_RECONNECT_DELAY_S):
                    break
                continue
            step = BACKOFF_STEPS_S[min(failures, len(BACKOFF_STEPS_S) - 1)]
            failures += 1
            if self._sleep(step + random.uniform(0, step * 0.2)):
                break

    def _relocate(self):
        """The appliance stopped answering here: see whether it moved."""
        if not self.follow or not self.expected_di or self._stopping.is_set():
            return False
        now = time.monotonic()
        if self._last_relocate and now - self._last_relocate < RELOCATE_MIN_INTERVAL_S:
            return False
        self._last_relocate = now
        try:
            found = locate(self.cred_dir, di=self.expected_di, mac=self.mac, hints=[self.host],
                           exclude=[h for h in self._other_hosts() if h != self.host] + [self.host])
        except Exception:  # noqa: BLE001 - looking is best effort
            return False
        if not found:
            return False
        previous, self.host, self.port = self.host, found["host"], None
        self.mac = found.get("mac") or self.mac
        emit({"ev": "moved", "key": self.key, "from": previous, "host": self.host, "mac": self.mac})
        return True

    def _read(self, link):
        """One poll. A timeout is retried on the same session, so a brief
        network gap does not force a new handshake."""
        for attempt in range(READ_RETRIES + 1):
            try:
                resources, _mode = link.read_resources()
                return resources
            except Exception as exc:  # noqa: BLE001
                if (attempt == READ_RETRIES or self._stopping.is_set()
                        or classify(exc).get("code") != "timeout"):
                    raise
                if self._sleep(READ_RETRY_PAUSE_S):
                    raise

    def _loop(self, link):
        next_poll = time.monotonic() + self.poll_interval
        while not self._stopping.is_set():
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
            resources = self._read(link)
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
            result = probe(str(req["host"]), self.cred_dir, req.get("port"))
            result["mac"] = arp_table().get(result["host"])
            return result
        if op == "locate":
            found = locate(self.cred_dir, di=req.get("di"), mac=req.get("mac"),
                           hints=req.get("hints") or (), exclude=req.get("exclude") or ())
            if not found:
                raise HelperError("not_found", "No appliance with this address was found on the local network.")
            return found
        if op == "open":
            key = str(req["key"])
            with self.lock:
                old = self.workers.pop(key, None)
            if old:
                old.stop()
                old.join(timeout=10)
            worker = DeviceWorker(key, str(req["host"]), req.get("port"), self.cred_dir,
                                  req.get("expectedDi"), req.get("pollInterval", 15),
                                  bool(req.get("push", True)), mac=req.get("mac"),
                                  other_hosts=self.hosts, follow=bool(req.get("follow", True)))
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

    def hosts(self):
        with self.lock:
            return [w.host for w in self.workers.values()]

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
