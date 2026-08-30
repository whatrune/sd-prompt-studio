from __future__ import annotations

import http.client
import json
import socket
import struct
import sys
import tempfile
import threading
import traceback
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import research_explorer as explorer  # noqa: E402


class HTTPFixtureHandler(explorer.ResearchExplorerHandler):
    def end_headers(self) -> None:
        if self.headers.get("Connection", "").lower() == "close":
            self.send_header("Connection", "close")
        super().end_headers()


def configure_http_fixture(
    server: explorer.ResearchExplorerHTTPServer,
    errors: list[object],
) -> None:
    server.daemon_threads = False
    server.RequestHandlerClass = HTTPFixtureHandler
    server.fixture_close_event = threading.Event()
    def record_error(_request: object, address: object) -> None:
        detail = traceback.format_exc()
        errors.append((address, detail))
        sys.stderr.write(detail)

    server.handle_error = record_error
    close_request = server.close_request

    def graceful_shutdown_request(request: socket.socket) -> None:
        linger_format = "HH" if sys.platform == "win32" else "ii"
        request.setsockopt(
            socket.SOL_SOCKET,
            socket.SO_LINGER,
            struct.pack(linger_format, 1, 5),
        )
        try:
            request.shutdown(socket.SHUT_WR)
        finally:
            close_request(request)
            server.fixture_close_event.set()

    server.shutdown_request = graceful_shutdown_request


def close_http_fixture_connection(
    connection: http.client.HTTPConnection,
    close_event: threading.Event,
) -> int:
    close_event.clear()
    try:
        connection.request("GET", "/", headers={"Connection": "close"})
        if connection.sock is None:
            raise AssertionError("Research Explorer fixture connection socket is unavailable")
        response = connection.getresponse()
        response.read()
        if response.getheader("Connection", "").lower() != "close":
            raise AssertionError("Research Explorer fixture close response omitted Connection: close")
        status = response.status
    finally:
        connection.close()
    if not close_event.wait(timeout=10):
        raise AssertionError("Research Explorer fixture close was not observed by the server")
    return status


class ResearchExplorerRealDataIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.frontend_temp = tempfile.TemporaryDirectory()
        cls.frontend = Path(cls.frontend_temp.name)
        cls.frontend_marker = b'<div id="root">integration-shell</div>'
        (cls.frontend / "index.html").write_bytes(cls.frontend_marker)
        cls.server = explorer.create_companion_server(
            ROOT,
            cls.frontend,
            host="127.0.0.1",
            port=0,
            session_token="integration-session-token",
        )
        cls.server_errors: list[object] = []
        configure_http_fixture(cls.server, cls.server_errors)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.port = cls.server.server_address[1]

    def setUp(self) -> None:
        self.connection = http.client.HTTPConnection(
            "127.0.0.1",
            self.port,
            timeout=10,
            source_address=("127.0.0.2", 0),
        )

    def tearDown(self) -> None:
        self.assertEqual(
            close_http_fixture_connection(self.connection, self.server.fixture_close_event),
            200,
        )
        self.assertIsNone(self.connection.sock)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.thread.join(timeout=5)
        request_threads = list(getattr(cls.server, "_threads", ()))
        cls.server.server_close()
        try:
            if cls.thread.is_alive():
                raise AssertionError("Research Explorer serve thread remained alive")
            if cls.server.fileno() != -1:
                raise AssertionError("Research Explorer listening socket remained open")
            if any(thread.is_alive() for thread in request_threads):
                raise AssertionError("Research Explorer request thread remained alive")
            if cls.server_errors:
                raise AssertionError(f"Research Explorer server errors: {cls.server_errors!r}")
        finally:
            cls.frontend_temp.cleanup()

    def request(
        self,
        method: str,
        path: str,
        *,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        self.connection.request(method, path, headers=headers or {})
        response = self.connection.getresponse()
        body = response.read()
        result_headers = {key.lower(): value for key, value in response.getheaders()}
        status = response.status
        return status, result_headers, body

    def session_cookie(self) -> str:
        status, headers, _ = self.request("GET", "/")
        self.assertEqual(status, 200)
        set_cookie = headers["set-cookie"]
        self.assertIn("HttpOnly", set_cookie)
        self.assertIn("SameSite=Strict", set_cookie)
        self.assertIn("Path=/api/research", set_cookie)
        return set_cookie.split(";", 1)[0]

    def test_same_origin_routes_and_real_index(self) -> None:
        cookie = self.session_cookie()
        for route in ("/", "/research", "/research/artifact/direct-navigation"):
            with self.subTest(route=route):
                status, _, body = self.request("GET", route)
                self.assertEqual(status, 200)
                self.assertEqual(body, self.frontend_marker)

        status, headers, body = self.request(
            "GET",
            "/api/research/index",
            headers={"Cookie": cookie},
        )
        self.assertEqual(status, 200)
        self.assertNotIn("access-control-allow-origin", headers)
        index = json.loads(body)
        self.assertGreaterEqual(len(index["artifacts"]), 136)
        self.assertEqual(index["diagnostics"], [])
        artifact_types = {item["artifact_type"] for item in index["artifacts"]}
        self.assertTrue({"run", "observation", "canonical_assertion"}.issubset(artifact_types))
        self.assertNotIn("experiment", artifact_types)

        serialized = body.decode("utf-8")
        self.assertNotIn(str(ROOT), serialized)
        self.assertNotIn("integration-session-token", serialized)
        for artifact in index["artifacts"]:
            self.assertFalse(Path(artifact["source_path"]).is_absolute())
            self.assertIsInstance(artifact["relationships"], list)
            self.assertIsInstance(artifact["research_audit_hashes"], list)

    def test_real_artifacts_round_trip_and_snapshot_mismatch_stops_content(self) -> None:
        cookie = self.session_cookie()
        status, _, body = self.request(
            "GET",
            "/api/research/index",
            headers={"Cookie": cookie},
        )
        self.assertEqual(status, 200)
        index = json.loads(body)
        snapshot = index["index_snapshot_id"]

        by_media_type = {
            media_type: next(
                artifact for artifact in index["artifacts"] if artifact["media_type"] == media_type
            )
            for media_type in ("application/json", "application/yaml", "text/markdown")
        }
        for media_type, artifact in by_media_type.items():
            with self.subTest(media_type=media_type):
                status, headers, artifact_body = self.request(
                    "GET",
                    f'/api/research/artifacts/{artifact["artifact_id"]}',
                    headers={"Cookie": cookie, explorer.SNAPSHOT_HEADER: snapshot},
                )
                self.assertEqual(status, 200)
                self.assertEqual(headers["x-research-artifact-id"], artifact["artifact_id"])
                self.assertEqual(headers[explorer.SNAPSHOT_HEADER.lower()], snapshot)
                self.assertEqual(len(artifact_body), artifact["byte_size"])

        sample = by_media_type["application/json"]
        status, _, mismatch_body = self.request(
            "GET",
            f'/api/research/artifacts/{sample["artifact_id"]}',
            headers={"Cookie": cookie, explorer.SNAPSHOT_HEADER: "snapshot.invalid"},
        )
        self.assertEqual(status, 409)
        self.assertEqual(json.loads(mismatch_body)["error"]["code"], "INDEX_SNAPSHOT_MISMATCH")
        self.assertNotIn(b'"run_id"', mismatch_body)


if __name__ == "__main__":
    unittest.main()
