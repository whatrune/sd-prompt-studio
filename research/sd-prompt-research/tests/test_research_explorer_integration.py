from __future__ import annotations

import http.client
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import research_explorer as explorer  # noqa: E402


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
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.port = cls.server.server_address[1]

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)
        cls.frontend_temp.cleanup()

    def request(
        self,
        method: str,
        path: str,
        *,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        connection.request(method, path, headers=headers or {})
        response = connection.getresponse()
        body = response.read()
        result_headers = {key.lower(): value for key, value in response.getheaders()}
        status = response.status
        connection.close()
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
