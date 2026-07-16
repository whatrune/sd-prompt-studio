from __future__ import annotations

import http.client
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import research_explorer as explorer  # noqa: E402


class ResearchExplorerTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project = Path(self.temp_dir.name) / "research-project"
        self.project.mkdir()
        (self.project / "schemas").mkdir()
        shutil.copy2(
            ROOT / "schemas" / "research-explorer-index.schema.json",
            self.project / "schemas" / "research-explorer-index.schema.json",
        )
        self.frontend = Path(self.temp_dir.name) / "frontend"
        self.frontend.mkdir()
        (self.frontend / "index.html").write_text("<!doctype html><title>fixture</title>\n", encoding="utf-8")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def write_json(self, relative: str, value: object) -> Path:
        path = self.project / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8", newline="\n")
        return path

    def write_yaml(self, relative: str, value: object) -> Path:
        path = self.project / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            yaml.safe_dump(value, sort_keys=False, allow_unicode=True),
            encoding="utf-8",
            newline="\n",
        )
        return path

    def manifest(self) -> Path:
        return self.write_yaml(
            "experiments/bridge/BRG-TEST-A/manifest.yaml",
            {"run_id": "BRG-TEST-A", "prompt": "fixture prompt"},
        )


class ResearchExplorerTests(ResearchExplorerTestCase):
    def test_fingerprint_is_content_sensitive_and_separate_from_research_hashes(self) -> None:
        path = self.manifest()
        first = explorer.source_freshness_fingerprint(path)
        same = explorer.source_freshness_fingerprint(path)
        self.assertEqual(first, same)
        path.write_bytes(path.read_bytes() + b"# changed\n")
        self.assertNotEqual(first, explorer.source_freshness_fingerprint(path))

        index = explorer.build_research_index(self.project)
        artifact = next(item for item in index["artifacts"] if item["artifact_type"] == "run")
        self.assertEqual(artifact["source_freshness_fingerprint"]["contract"], explorer.FINGERPRINT_CONTRACT)
        self.assertEqual(artifact["research_audit_hashes"], [])
        self.assertNotIn("content", artifact)
        self.assertNotIn("prompt", json.dumps(artifact))

    def test_index_references_only_existing_research_hash_contracts(self) -> None:
        hashes = {
            "draft_input_identity_hash": "a" * 64,
            "candidate_wrapper_artifact_hash_v1": "b" * 64,
            "canonical_assertion_artifact_hash_v1": "c" * 64,
            "assertion_content_v1_hash": "d" * 64,
            "invented_ui_hash": "e" * 64,
        }
        self.write_yaml(
            "inbox/claim-drafts/draft.001/pre-schema-draft.yaml",
            {"draft_id": "draft.001", **hashes},
        )
        index = explorer.build_research_index(self.project)
        artifact = next(item for item in index["artifacts"] if item["artifact_type"] == "draft")
        names = {item["name"] for item in artifact["research_audit_hashes"]}
        self.assertEqual(names, explorer.RESEARCH_HASH_KEYS)
        self.assertNotIn("invented_ui_hash", names)

    def test_snapshot_id_is_stable_for_unchanged_sources(self) -> None:
        self.manifest()
        first = explorer.build_research_index(self.project)
        second = explorer.build_research_index(self.project)
        self.assertEqual(first["index_snapshot_id"], second["index_snapshot_id"])
        self.assertNotEqual(first["generated_at"], "")
        explorer.validate_index(first, self.project / "schemas" / "research-explorer-index.schema.json")

    def test_validation_artifact_uses_namespaced_id(self) -> None:
        self.write_json(
            "reports/current-validation.json",
            {
                "validation_context": "candidate_generation",
                "passed": True,
                "valid": True,
                "infrastructure_error_count": 0,
                "infrastructure_errors": [],
            },
        )
        index = explorer.build_research_index(self.project)
        artifact = next(item for item in index["artifacts"] if item["artifact_type"] == "validation_result")
        self.assertTrue(artifact["artifact_id"].startswith("validation.candidate_generation."))
        self.assertEqual(artifact["display_status"]["value"], "passed")

    def test_finalize_relationship_requires_success_receipt_and_canonical_hash(self) -> None:
        candidate_id = "candidate." + "1" * 64
        assertion_id = "assertion.fixture.001"
        self.write_yaml(
            f"inbox/claim-drafts/draft.001/claim-candidates/{candidate_id}/claim-candidate.yaml",
            {"candidate_id": candidate_id, "canonical_assertion": {"assertions": [{"assertion_id": assertion_id}]}},
        )
        canonical = self.write_yaml(
            "knowledge/assertions/fixture.yaml",
            {
                "schema_version": "0.1.0",
                "assertion_file_id": "fixture",
                "claim_family": "phrase_behavior",
                "assertions": [{"assertion_id": assertion_id}],
            },
        )
        canonical_hash = explorer.normalized_text_file_sha256_v1(canonical)
        self.write_json(
            f"inbox/claim-drafts/draft.001/claim-candidates/{candidate_id}/generation-receipts/receipt.json",
            {
                "receipt_id": "019abcdef-0000-7000-8000-000000000001",
                "receipt_type": "finalize_attempt",
                "result": "succeeded",
                "related_artifact_ids": {
                    "claim_candidate": candidate_id,
                    "canonical_assertion": assertion_id,
                },
                "related_artifact_hashes": {
                    "canonical_assertion": {
                        "algorithm": "normalized_text_file_sha256_v1",
                        "value": canonical_hash,
                    }
                },
                "payload": {"destination_path": "knowledge/assertions/fixture.yaml"},
            },
        )
        index = explorer.build_research_index(self.project)
        candidate = next(item for item in index["artifacts"] if item["artifact_type"] == "candidate")
        self.assertEqual(candidate["display_status"]["value"], "finalized")
        self.assertTrue(any(item["relation"] == "finalized_as" for item in candidate["relationships"]))

    def test_bad_finalize_hash_does_not_mark_candidate_finalized(self) -> None:
        candidate_id = "candidate." + "2" * 64
        assertion_id = "assertion.fixture.002"
        self.write_yaml(
            f"inbox/claim-drafts/draft.002/claim-candidates/{candidate_id}/claim-candidate.yaml",
            {"candidate_id": candidate_id},
        )
        self.write_yaml(
            "knowledge/assertions/fixture.yaml",
            {"assertion_file_id": "fixture", "assertions": [{"assertion_id": assertion_id}]},
        )
        self.write_json(
            f"inbox/claim-drafts/draft.002/claim-candidates/{candidate_id}/generation-receipts/receipt.json",
            {
                "receipt_type": "finalize_attempt",
                "result": "succeeded",
                "related_artifact_ids": {
                    "claim_candidate": candidate_id,
                    "canonical_assertion": assertion_id,
                },
                "related_artifact_hashes": {
                    "canonical_assertion": {
                        "algorithm": "normalized_text_file_sha256_v1",
                        "value": "f" * 64,
                    }
                },
                "payload": {"destination_path": "knowledge/assertions/fixture.yaml"},
            },
        )
        index = explorer.build_research_index(self.project)
        candidate = next(item for item in index["artifacts"] if item["artifact_type"] == "candidate")
        self.assertEqual(candidate["display_status"]["value"], "created")

    def test_project_path_rejects_traversal_and_absolute_paths(self) -> None:
        for value in ("../outside.yaml", "C:/outside.yaml", "/outside.yaml"):
            with self.subTest(value=value), self.assertRaises(explorer.ResearchExplorerError) as raised:
                explorer.resolve_project_path(self.project, value, must_exist=False)
            self.assertEqual(raised.exception.code, "ARTIFACT_PATH_INVALID")

    def test_outside_symlink_is_not_indexed(self) -> None:
        outside = Path(self.temp_dir.name) / "outside.yaml"
        outside.write_text("secret: true\n", encoding="utf-8")
        link = self.project / "experiments" / "outside-link.yaml"
        link.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.symlink(outside, link)
        except OSError as exc:
            if os.name == "nt":
                self.skipTest(f"Windows symlink permission unavailable: {exc}")
            raise
        index = explorer.build_research_index(self.project)
        self.assertFalse(any(item["source_path"].endswith("outside-link.yaml") for item in index["artifacts"]))
        self.assertIn("ARTIFACT_PATH_OUTSIDE_ROOT", {item["code"] for item in index["diagnostics"]})

    def test_non_loopback_bind_is_rejected(self) -> None:
        with self.assertRaises(explorer.ResearchExplorerError) as raised:
            explorer.validate_loopback_host("0.0.0.0")
        self.assertEqual(raised.exception.code, "BIND_HOST_NOT_LOOPBACK")


class ResearchExplorerHTTPTests(ResearchExplorerTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.manifest()
        self.server = explorer.create_companion_server(
            self.project,
            self.frontend,
            host="127.0.0.1",
            port=0,
            session_token="test-session-token",
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_address[1]

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)
        super().tearDown()

    def request(
        self,
        method: str,
        path: str,
        *,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
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
        cookie = headers["set-cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Strict", cookie)
        self.assertNotIn("localStorage", cookie)
        return cookie.split(";", 1)[0]

    def test_api_requires_session_and_emits_no_cors_header(self) -> None:
        status, headers, body = self.request("GET", "/api/research/index")
        self.assertEqual(status, 401)
        self.assertNotIn("access-control-allow-origin", headers)
        self.assertEqual(json.loads(body)["error"]["code"], "SESSION_REQUIRED")

        cookie = self.session_cookie()
        status, headers, body = self.request(
            "GET", "/api/research/index", headers={"Cookie": cookie}
        )
        self.assertEqual(status, 200)
        self.assertNotIn("access-control-allow-origin", headers)
        self.assertEqual(json.loads(body)["index_snapshot_id"], self.server.state.index["index_snapshot_id"])

    def test_host_and_origin_allowlists_are_enforced(self) -> None:
        cookie = self.session_cookie()
        status, _, body = self.request(
            "GET",
            "/api/research/index",
            headers={"Cookie": cookie, "Host": "attacker.example"},
        )
        self.assertEqual(status, 403)
        self.assertEqual(json.loads(body)["error"]["code"], "HOST_NOT_ALLOWED")

        status, _, body = self.request(
            "GET",
            "/api/research/index",
            headers={"Cookie": cookie, "Origin": "https://attacker.example"},
        )
        self.assertEqual(status, 403)
        self.assertEqual(json.loads(body)["error"]["code"], "ORIGIN_NOT_ALLOWED")

    def test_mutation_methods_are_not_available(self) -> None:
        cookie = self.session_cookie()
        for method in ("POST", "PUT", "PATCH", "DELETE", "OPTIONS"):
            with self.subTest(method=method):
                status, _, body = self.request(
                    method,
                    "/api/research/index",
                    headers={"Cookie": cookie},
                )
                self.assertEqual(status, 405)
                self.assertEqual(json.loads(body)["error"]["code"], "READ_ONLY_API")

    def test_artifact_read_requires_snapshot_and_rejects_stale_source(self) -> None:
        cookie = self.session_cookie()
        artifact = next(
            item for item in self.server.state.index["artifacts"] if item["artifact_type"] == "run"
        )
        encoded_id = artifact["artifact_id"]

        status, _, body = self.request(
            "GET",
            f"/api/research/artifacts/{encoded_id}",
            headers={"Cookie": cookie},
        )
        self.assertEqual(status, 409)
        self.assertEqual(json.loads(body)["error"]["code"], "INDEX_SNAPSHOT_MISMATCH")

        status, _, body = self.request(
            "GET",
            f"/api/research/artifacts/{encoded_id}",
            headers={
                "Cookie": cookie,
                explorer.SNAPSHOT_HEADER: self.server.state.index["index_snapshot_id"],
            },
        )
        self.assertEqual(status, 200)
        self.assertIn(b"BRG-TEST-A", body)

        self.manifest().write_text("run_id: BRG-CHANGED\n", encoding="utf-8")
        status, _, body = self.request(
            "GET",
            f"/api/research/artifacts/{encoded_id}",
            headers={
                "Cookie": cookie,
                explorer.SNAPSHOT_HEADER: self.server.state.index["index_snapshot_id"],
            },
        )
        self.assertEqual(status, 409)
        self.assertEqual(json.loads(body)["error"]["code"], "ARTIFACT_STALE")

    def test_raw_path_api_is_not_exposed(self) -> None:
        cookie = self.session_cookie()
        status, _, body = self.request(
            "GET",
            "/api/research/artifacts/experiments/bridge/BRG-TEST-A/manifest.yaml",
            headers={"Cookie": cookie, explorer.SNAPSHOT_HEADER: self.server.state.index["index_snapshot_id"]},
        )
        self.assertEqual(status, 404)
        self.assertEqual(json.loads(body)["error"]["code"], "ARTIFACT_ID_INVALID")


if __name__ == "__main__":
    unittest.main()
