import importlib.util
from pathlib import Path
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading

spec = importlib.util.spec_from_file_location("runtime", Path(__file__).with_name("runtime.py"))
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class RuntimeScopeTests(unittest.TestCase):
    def test_preflight_does_not_follow_redirects(self):
        requested = []

        class RedirectingHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                requested.append(self.path)
                self.send_response(302)
                self.send_header("Location", "/outside-scope")
                self.end_headers()

            def log_message(self, *args):
                pass

        with ThreadingHTTPServer(("127.0.0.1", 0), RedirectingHandler) as server:
            thread = threading.Thread(target=server.serve_forever)
            thread.start()
            try:
                with self.assertRaises(ValueError):
                    runtime.check_ready(f"http://127.0.0.1:{server.server_port}", True)
            finally:
                server.shutdown()
                thread.join()
        self.assertEqual(requested, ["/api/health"])

    def test_authorization_and_exact_external_origin_required(self):
        with self.assertRaises(ValueError):
            runtime.validate_target("http://127.0.0.1:3001", "")
        with self.assertRaises(ValueError):
            runtime.validate_target("https://staging.example", "yes", "https://other.example")
        self.assertEqual(runtime.validate_target("https://staging.example", "yes", "https://staging.example"), ("https://staging.example", False))

    def test_credentials_query_fragment_and_noncanonical_targets_rejected(self):
        for url in ["https://" + "user" + ":" + "secret" + "@localhost", "http://localhost/?token=secret", "http://localhost/#x", "http://localhost/path", "http://localhost\\@example.com", "http://LOCALHOST", "file:///tmp/local", "http://127.0.0.1:bad"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                runtime.validate_target(url, "yes")

    def test_external_redirect_destinations_cannot_enter_path_list(self):
        for path in ["//example.com/", "https://example.com/", "/\\example.com/", "/api?url=https://example.com", "/foo\r\nHost: example.com"]:
            with self.subTest(path=path), self.assertRaises(ValueError):
                runtime.validate_paths([path])
        self.assertEqual(runtime.validate_paths(["/", "/api/health"]), ["/", "/api/health"])


if __name__ == "__main__":
    unittest.main()
