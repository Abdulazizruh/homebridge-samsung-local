"""Unit tests for the helper's pure logic (no appliance, no network)."""
import importlib.util
import os
import stat
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("bridge", os.path.join(HERE, "..", "..", "python", "bridge.py"))
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class PureLogic(unittest.TestCase):
    def test_parse_batch_keeps_resources_and_skips_the_collection(self):
        body = [
            {"rt": ["x.com.samsung.devcol", "oic.wk.col"]},
            {"href": "/power/vs/0", "rep": {"x.com.samsung.da.power": "On"}},
            {"href": "/device/0", "rep": {"rt": ["oic.wk.col"]}},
            "junk",
            {"href": "", "rep": {}},
        ]
        self.assertEqual(bridge.parse_batch(body), {"/power/vs/0": {"x.com.samsung.da.power": "On"}})

    def test_source_port_is_stable_per_device_and_distinct_from_localthings(self):
        a = bridge.local_source_port("192.168.1.50")
        self.assertEqual(a, bridge.local_source_port("192.168.1.50"))
        self.assertNotEqual(a, bridge.local_source_port("192.168.1.51"))
        self.assertEqual(a, 61300 + 50)
        self.assertNotIn(a, range(61000, 61256))  # LocalThings' range on the same host

    def test_classify_maps_errors_to_stable_codes(self):
        self.assertEqual(bridge.classify(TimeoutError("x"))["code"], "timeout")
        self.assertEqual(bridge.classify(OSError("x"))["code"], "connection")
        err = bridge.HelperError("auth_rejected", "refused", fatal=True)
        self.assertEqual(bridge.classify(err), {"code": "auth_rejected", "message": "refused", "fatal": True})

    def test_code_formatting_and_links(self):
        self.assertEqual(bridge.code_str(0x45), "2.05")
        self.assertEqual(bridge.code_str(0x81), "4.01")
        self.assertEqual(bridge.links_of([{"links": [{"href": "/a"}]}]), [{"href": "/a"}])
        self.assertEqual(bridge.links_of({"links": [{"href": "/b"}]}), [{"href": "/b"}])

    def test_json_output_never_carries_raw_bytes(self):
        self.assertEqual(bridge._json_default(b"\x01\x02"), {"$bytes": "0102"})


@unittest.skipUnless(importlib.util.find_spec("cryptography"), "cryptography not installed")
class Credentials(unittest.TestCase):
    def test_certificate_is_minted_once_with_private_permissions(self):
        from cryptography import x509

        with tempfile.TemporaryDirectory() as tmp:
            cred = os.path.join(tmp, "credentials")
            cert, key = bridge.ensure_credentials(cred)
            self.assertEqual((cert, key), bridge.ensure_credentials(cred))  # reused, not re-minted
            for name in ("client.pem", "client.key"):
                mode = stat.S_IMODE(os.stat(os.path.join(cred, name)).st_mode)
                self.assertEqual(mode, 0o600, name)
            subject = x509.load_pem_x509_certificate(cert.encode()).subject.rfc4514_string()
            self.assertIn("uuid:" + bridge.DEFAULT_CLIENT_UUID, subject)
            self.assertIn("PRIVATE KEY", key)


class FakeLink:
    """A session that reads fine a set number of times, then times out."""

    def __init__(self, reads):
        self.port, self.reads, self.closed = 49152, reads, False

    def read_identity(self):
        return {"di": "device-1", "pi": None}

    def read_resources(self):
        if self.reads <= 0:
            raise TimeoutError("session operation timed out")
        self.reads -= 1
        return {"/power/vs/0": {"x.com.samsung.da.power": "On"}}, "batch"

    def subscribe(self, href):
        pass

    def post(self, path, body):
        return 0x44, None

    def close(self):
        self.closed = True


class Reconnect(unittest.TestCase):
    def run_worker(self, links, until, grace=5.0):
        events, opened = [], []
        saved = (bridge.open_link, bridge.emit, bridge.ensure_credentials,
                 bridge.QUIET_RECONNECT_DELAY_S, bridge.BACKOFF_STEPS_S,
                 bridge.READ_RETRY_PAUSE_S, bridge.OFFLINE_GRACE_S)

        def open_link(host, port, cert, key, on_notification=None):
            link = links.pop(0) if links else None
            opened.append(link)
            if link is None:
                raise TimeoutError("session operation timed out")
            return link, []

        worker = bridge.DeviceWorker("k", "10.0.0.5", None, "/nonexistent", "device-1", 2, False)
        worker.poll_interval = 0.02

        def emit(msg):
            events.append(msg)
            if until(events):
                worker.stop()

        bridge.open_link, bridge.emit = open_link, emit
        bridge.ensure_credentials = lambda cred_dir: ("cert", "key")
        bridge.QUIET_RECONNECT_DELAY_S, bridge.BACKOFF_STEPS_S = 0.01, (0.01,)
        bridge.READ_RETRY_PAUSE_S, bridge.OFFLINE_GRACE_S = 0.01, grace
        try:
            worker.start()
            worker.join(timeout=10)
            self.assertFalse(worker.is_alive())
        finally:
            (bridge.open_link, bridge.emit, bridge.ensure_credentials,
             bridge.QUIET_RECONNECT_DELAY_S, bridge.BACKOFF_STEPS_S,
             bridge.READ_RETRY_PAUSE_S, bridge.OFFLINE_GRACE_S) = saved
        return [e for e in events if e.get("ev") == "status"]

    def test_a_dropped_session_reconnects_once_without_reporting_offline(self):
        first, second = FakeLink(reads=2), FakeLink(reads=50)
        status = self.run_worker([first, second], lambda ev: sum(1 for e in ev if e.get("online")) >= 2)
        self.assertTrue(first.closed)
        self.assertEqual([e["online"] for e in status], [True, True])

    def test_a_single_timed_out_read_is_retried_on_the_same_session(self):
        class Flaky(FakeLink):
            def __init__(self):
                super().__init__(reads=50)
                self.calls = 0

            def read_resources(self):
                self.calls += 1
                if self.calls == 3:
                    raise TimeoutError("session operation timed out")
                return super().read_resources()

        link, opened = Flaky(), []
        status = self.run_worker([link], lambda ev: sum(1 for e in ev if e.get("ev") == "state") >= 6)
        self.assertGreaterEqual(link.calls, 6)
        self.assertEqual([e["online"] for e in status], [True], "no reconnect, no offline report")

    def test_offline_is_reported_when_the_reconnect_fails_too(self):
        status = self.run_worker([FakeLink(reads=2)], lambda ev: any(e.get("online") is False for e in ev), grace=0.2)
        self.assertEqual([e["online"] for e in status], [True, False])
        self.assertEqual(status[-1]["error"]["code"], "timeout")


class FollowAddress(unittest.TestCase):
    ARP = (
        "IP address       HW type     Flags       HW address            Mask     Device\n"
        "192.168.0.151    0x1         0x2         AA:BB:CC:00:4F:2A     *        eth0\n"
        "192.168.0.77     0x1         0x2         aa:bb:cc:00:11:22     *        eth0\n"
        "192.168.0.9      0x1         0x0         00:00:00:00:00:00     *        eth0\n"
    )

    def test_mac_addresses_are_normalized_and_junk_is_refused(self):
        self.assertEqual(bridge.normalize_mac("AA-BB-CC-00-4F-2A"), "aa:bb:cc:00:4f:2a")
        self.assertEqual(bridge.normalize_mac("aabb.cc00.4f2a"), "aa:bb:cc:00:4f:2a")
        for junk in ("192.168.0.144", "", None, "aa:bb:cc", "00:00:00:00:00:00", "zz:bb:cc:00:4f:2a"):
            self.assertIsNone(bridge.normalize_mac(junk), junk)

    def test_the_neighbour_table_is_read_and_incomplete_rows_are_skipped(self):
        table = bridge.parse_arp(self.ARP)
        self.assertEqual(table, {"192.168.0.151": "aa:bb:cc:00:4f:2a", "192.168.0.77": "aa:bb:cc:00:11:22"})

    def locate(self, identities, **kwargs):
        saved = (bridge.sweep, bridge.arp_table, bridge.identity_at)
        asked = []
        bridge.sweep = lambda networks, wait=2.0: set(identities)
        bridge.arp_table = lambda: bridge.parse_arp(self.ARP)

        def identity_at(host, cred_dir):
            asked.append(host)
            return identities.get(host)

        bridge.identity_at = identity_at
        try:
            return bridge.locate("/nonexistent", **kwargs), asked
        finally:
            bridge.sweep, bridge.arp_table, bridge.identity_at = saved

    def test_an_appliance_is_found_by_mac_and_confirmed_by_device_id(self):
        found, asked = self.locate({"192.168.0.151": "device-1", "192.168.0.77": "device-2"},
                                   di="device-1", mac="AA:BB:CC:00:4F:2A", hints=["192.168.0.144"])
        self.assertEqual(found, {"host": "192.168.0.151", "mac": "aa:bb:cc:00:4f:2a"})
        self.assertEqual(asked, ["192.168.0.151"], "the MAC match is tried first")

    def test_without_a_mac_it_is_found_by_device_id_among_the_answers(self):
        found, _ = self.locate({"192.168.0.77": "device-2", "192.168.0.151": "device-1"}, di="device-1")
        self.assertEqual(found["host"], "192.168.0.151")

    def test_another_appliance_on_the_old_mac_or_address_is_never_accepted(self):
        found, _ = self.locate({"192.168.0.151": "someone-else"}, di="device-1", mac="aa:bb:cc:00:4f:2a")
        self.assertIsNone(found)
        found, _ = self.locate({"192.168.0.151": "device-1"}, di="device-1", exclude=["192.168.0.151"])
        self.assertIsNone(found, "an address another appliance already uses is skipped")

    def test_a_worker_follows_its_appliance_to_a_new_address(self):
        events = []
        saved = (bridge.open_link, bridge.emit, bridge.ensure_credentials, bridge.locate,
                 bridge.arp_table, bridge.BACKOFF_STEPS_S)
        worker = bridge.DeviceWorker("k", "10.0.0.5", None, "/nonexistent", "device-1", 2, False,
                                     other_hosts=lambda: ["10.0.0.5", "10.0.0.6"])
        worker.poll_interval = 0.02
        asked = {}

        def open_link(host, port, cert, key, on_notification=None):
            if host == "10.0.0.5":
                raise TimeoutError("session operation timed out")
            return FakeLink(reads=50), []

        def locate(cred_dir, di=None, mac=None, hints=(), exclude=()):
            asked.update(di=di, hints=list(hints), exclude=sorted(exclude))
            return {"host": "10.0.0.9", "mac": "aa:bb:cc:00:4f:2a"}

        def emit(msg):
            events.append(msg)
            if msg.get("ev") == "status" and msg.get("online"):
                worker.stop()

        bridge.open_link, bridge.emit, bridge.locate = open_link, emit, locate
        bridge.ensure_credentials = lambda cred_dir: ("cert", "key")
        bridge.arp_table = lambda: {}
        bridge.BACKOFF_STEPS_S = (0.01,)
        try:
            worker.start()
            worker.join(timeout=10)
            self.assertFalse(worker.is_alive())
        finally:
            (bridge.open_link, bridge.emit, bridge.ensure_credentials, bridge.locate,
             bridge.arp_table, bridge.BACKOFF_STEPS_S) = saved
        moved = [e for e in events if e.get("ev") == "moved"]
        self.assertEqual([(e["from"], e["host"]) for e in moved], [("10.0.0.5", "10.0.0.9")])
        self.assertEqual(asked, {"di": "device-1", "hints": ["10.0.0.5"], "exclude": ["10.0.0.5", "10.0.0.6"]})
        last = [e for e in events if e.get("ev") == "status"][-1]
        self.assertEqual((last["online"], last["host"], last["mac"]), (True, "10.0.0.9", "aa:bb:cc:00:4f:2a"))

    def test_a_mac_alone_resolves_to_its_current_address(self):
        found, asked = self.locate({}, mac="aa-bb-cc-00-11-22")
        self.assertEqual(found, {"host": "192.168.0.77", "mac": "aa:bb:cc:00:11:22"})
        self.assertEqual(asked, [])

    def test_with_following_switched_off_the_network_is_never_searched(self):
        asked = []
        saved = bridge.locate
        bridge.locate = lambda *a, **k: asked.append(k) or None
        try:
            worker = bridge.DeviceWorker("k", "10.0.0.5", None, "/nonexistent", "device-1", 15, False, follow=False)
            self.assertFalse(worker._relocate())
        finally:
            bridge.locate = saved
        self.assertEqual(asked, [])


if __name__ == "__main__":
    unittest.main()


class HandshakeReasonTest(unittest.TestCase):
    def test_reason_is_kept_for_the_connecting_thread_only(self):
        import logging
        import threading
        reasons = bridge.HANDSHAKE_REASONS
        reasons.clear()
        logging.getLogger("smartthings_local.protocol.dtls_session").warning(
            "dtls handshake failed at the TLS layer: %s", ["sslv3 alert handshake failure"])
        self.assertEqual(reasons.latest(), "sslv3 alert handshake failure")
        seen = []
        other = threading.Thread(target=lambda: seen.append(reasons.latest()))
        other.start(); other.join()
        self.assertEqual(seen, [None])
        reasons.clear()
        self.assertIsNone(reasons.latest())

    def test_other_library_messages_are_not_kept(self):
        import logging
        reasons = bridge.HANDSHAKE_REASONS
        reasons.clear()
        logging.getLogger("smartthings_local").warning("dereg /x: 192.168.1.9 timed out")
        self.assertIsNone(reasons.latest())


class PeerInitiatedRetry(unittest.TestCase):
    def _run(self, failures):
        class PeerInitiatedHandshakeError(Exception):
            pass

        made = []

        class FakeLink:
            def __init__(self, host, port, cert, key, on_notification=None):
                self.port = port
                made.append(self)

            def connect(self):
                if len(made) <= failures:
                    raise PeerInitiatedHandshakeError("peer initiated a concurrent handshake")

            def close(self):
                pass

        saved = (bridge.Link, bridge.time.sleep, bridge.diagnose, bridge.find_secure_ports, bridge.legacy_http_open)
        bridge.Link, bridge.time.sleep, bridge.diagnose = FakeLink, (lambda s: None), (lambda *a: None)
        bridge.find_secure_ports, bridge.legacy_http_open = (lambda host: ([], {})), (lambda host: False)
        try:
            return bridge.open_link("192.0.2.20", 49153, "cert", "key"), made
        finally:
            (bridge.Link, bridge.time.sleep, bridge.diagnose, bridge.find_secure_ports, bridge.legacy_http_open) = saved

    def test_second_try_at_once_when_the_appliance_was_reaching_for_us(self):
        (link, _details), made = self._run(failures=1)
        self.assertEqual(len(made), 2)
        self.assertIs(link, made[1])

    def test_only_one_extra_try(self):
        with self.assertRaises(bridge.HelperError):
            self._run(failures=5)
