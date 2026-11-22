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


if __name__ == "__main__":
    unittest.main()
