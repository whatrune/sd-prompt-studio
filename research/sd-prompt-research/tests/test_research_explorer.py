from __future__ import annotations

import http.client
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

import yaml


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import research_explorer as explorer  # noqa: E402
import claim_draft_pipeline as pipeline  # noqa: E402


class ResearchExplorerTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project = Path(self.temp_dir.name) / "research" / "sd-prompt-research"
        self.project.mkdir(parents=True)
        shutil.copytree(ROOT / "schemas", self.project / "schemas")
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

    @staticmethod
    def successful_validator_process() -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout=json.dumps(
                {
                    "validation_completed": True,
                    "passed": True,
                    "valid": True,
                    "exit_code": 0,
                    "error_count": 0,
                    "infrastructure_error_count": 0,
                    "errors": [],
                    "infrastructure_errors": [],
                }
            ),
            stderr="",
        )

    def _resolution_for(self, result: pipeline.GenerationResult) -> dict:
        evidence = next(
            item
            for item in result.draft["staged_evidence"]
            if item["canonical_fact"]["metric"].endswith("primary_morphology_counts.lying_arch")
        )
        return {
            "human_resolution_schema_version": "0.1.0",
            "resolution_id": pipeline.uuid7_text(),
            "source_draft_id": result.draft_id,
            "source_draft_identity_hash": result.draft["draft_input_identity_hash"],
            "selected_assertion_id": "assertion.brg009.lying_arch.explorer.001",
            "selected_subject": {
                "kind": "phrase_surface",
                "phrase": "lying arch",
                "locale": "en",
                "normalized_phrase": "lying arch",
            },
            "selected_claim_statement": {
                "statement": "In the BRG-009-A context, lying arch morphology was observed."
            },
            "selected_evidence_bindings": [
                {
                    "evidence_ref_id": evidence["evidence_id"],
                    "evidence_role": "supports",
                    "applies_to": "assertion.brg009.lying_arch.explorer.001",
                    "evidence_quality": {
                        "coverage": "full",
                        "directness": "direct",
                        "consistency": "high",
                    },
                }
            ],
            "selected_claim_family": "phrase_behavior",
            "selected_scope": {
                "model_scope": "single_model",
                "context_scope": "single_context",
                "domain_scope": "pose",
                "generalization_scope": "local",
            },
            "selected_generalization_status": {
                "model_dependency_tested": False,
                "context_dependency_tested": False,
            },
            "interpretation_candidates": [],
            "causal_hypotheses": [],
            "depends_on": [],
            "supersedes": [],
            "rejected_candidates": [],
            "decided_by": "test-human",
            "decided_at": "2026-07-17T00:00:00Z",
        }

    def finalized_pipeline_fixture(
        self,
    ) -> tuple[pipeline.GenerationResult, pipeline.CandidateResult, pipeline.FinalizeResult]:
        for name in ("knowledge", "concepts", "templates"):
            shutil.copytree(ROOT / name, self.project / name)
        source_run = ROOT / "experiments" / "bridge" / "BRG-009-A"
        destination_run = self.project / "experiments" / "bridge" / "BRG-009-A"
        destination_run.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source_run, destination_run)
        result = pipeline.generate_draft(
            self.project,
            [(destination_run / "observation.json", "pose")],
            output_root=Path(self.temp_dir.name) / "i",
        )
        draft_dir = result.draft_dir.parent / "d"
        result.draft_dir.rename(draft_dir)
        (draft_dir / "human-resolution.yaml").write_bytes(
            pipeline.yaml_bytes(self._resolution_for(result))
        )
        completed = self.successful_validator_process()
        with patch.object(pipeline, "_integrated_validate"), patch.object(
            pipeline.subprocess, "run", return_value=completed
        ):
            candidate = pipeline.generate_candidate(self.project, draft_dir)
            finalized = pipeline.finalize_candidate(
                self.project,
                draft_dir,
                candidate_id=candidate.candidate_id,
                explicit_finalize=True,
            )
        self.pipeline_view_root = Path(self.temp_dir.name)
        shutil.copytree(self.project / "schemas", self.pipeline_view_root / "schemas")
        shutil.copytree(self.project / "knowledge", self.pipeline_view_root / "knowledge")
        return result, candidate, finalized

    @staticmethod
    def finalize_receipt_path(
        candidate: pipeline.CandidateResult, finalized: pipeline.FinalizeResult
    ) -> Path:
        return (
            candidate.candidate_dir
            / "generation-receipts"
            / f"{finalized.receipt['receipt_id']}.json"
        )

    def build_pipeline_index(self) -> dict:
        return explorer.build_research_index(
            self.pipeline_view_root,
            discovery_roots=(*explorer.DEFAULT_DISCOVERY_ROOTS, "i"),
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

    def test_index_size_and_fingerprint_share_one_secure_read_result(self) -> None:
        self.manifest()
        reads: dict[str, explorer.SecureReadResult] = {}
        original = explorer.secure_read_project_file

        def recording_read(project_root: Path, stored_path: str) -> explorer.SecureReadResult:
            result = original(project_root, stored_path)
            reads[stored_path] = result
            return result

        with patch.object(explorer, "secure_read_project_file", side_effect=recording_read):
            index = explorer.build_research_index(self.project)
        artifact = next(item for item in index["artifacts"] if item["artifact_type"] == "run")
        secure_read = reads[artifact["source_path"]]
        self.assertEqual(artifact["byte_size"], secure_read.byte_size)
        self.assertEqual(artifact["source_freshness_fingerprint"], secure_read.fingerprint)

    def test_secure_read_rejects_change_during_read(self) -> None:
        path = self.manifest().resolve()
        original_open = Path.open

        class MutatingReader:
            def __init__(self, stream: object) -> None:
                self.stream = stream

            def __enter__(self) -> "MutatingReader":
                self.stream.__enter__()
                return self

            def __exit__(self, *args: object) -> object:
                return self.stream.__exit__(*args)

            def fileno(self) -> int:
                return self.stream.fileno()

            def read(self) -> bytes:
                data = self.stream.read()
                with original_open(path, "ab") as writer:
                    writer.write(b"# changed during read\n")
                return data

        def mutating_open(target: Path, *args: object, **kwargs: object) -> object:
            stream = original_open(target, *args, **kwargs)
            if target.resolve() == path and args and args[0] == "rb":
                return MutatingReader(stream)
            return stream

        with patch.object(Path, "open", mutating_open), self.assertRaises(
            explorer.ResearchExplorerError
        ) as raised:
            explorer.secure_read_project_file(
                self.project, path.relative_to(self.project).as_posix()
            )
        self.assertEqual(raised.exception.code, "ARTIFACT_CHANGED_DURING_READ")

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
        _, candidate_result, _ = self.finalized_pipeline_fixture()
        index = self.build_pipeline_index()
        candidate = next(
            item
            for item in index["artifacts"]
            if item.get("entity_id") == candidate_result.candidate_id
        )
        self.assertEqual(candidate["display_status"]["value"], "finalized")
        self.assertTrue(any(item["relation"] == "finalized_as" for item in candidate["relationships"]))
        self.assertNotIn(
            "FINALIZE_BINDING_INVALID", {item["code"] for item in index["diagnostics"]}
        )

    def test_invalid_finalize_receipt_is_diagnostic_and_not_finalized(self) -> None:
        _, candidate_result, finalized = self.finalized_pipeline_fixture()
        receipt_path = self.finalize_receipt_path(candidate_result, finalized)
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        del receipt["recorded_at"]
        receipt_path.write_text(json.dumps(receipt) + "\n", encoding="utf-8")
        index = self.build_pipeline_index()
        candidate = next(
            item
            for item in index["artifacts"]
            if item.get("entity_id") == candidate_result.candidate_id
        )
        self.assertEqual(candidate["display_status"]["value"], "created")
        invalid = [item for item in index["diagnostics"] if item["code"] == "RECEIPT_INVALID"]
        self.assertTrue(invalid)
        self.assertEqual(
            invalid[0]["source_path"], receipt_path.relative_to(self.pipeline_view_root).as_posix()
        )

    def test_canonical_hash_mismatch_is_not_finalized(self) -> None:
        _, candidate_result, finalized = self.finalized_pipeline_fixture()
        canonical = self.pipeline_view_root / finalized.receipt["payload"]["destination_path"]
        canonical.write_bytes(canonical.read_bytes() + b"# changed\n")
        index = self.build_pipeline_index()
        candidate = next(
            item
            for item in index["artifacts"]
            if item.get("entity_id") == candidate_result.candidate_id
        )
        self.assertEqual(candidate["display_status"]["value"], "created")
        self.assertIn("FINALIZE_BINDING_INVALID", {item["code"] for item in index["diagnostics"]})

    def test_receipt_hash_mismatch_is_not_finalized(self) -> None:
        _, candidate_result, finalized = self.finalized_pipeline_fixture()
        receipt_path = self.finalize_receipt_path(candidate_result, finalized)
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        receipt["related_artifact_hashes"]["canonical_assertion"]["value"] = "f" * 64
        receipt_path.write_text(json.dumps(receipt) + "\n", encoding="utf-8")
        index = self.build_pipeline_index()
        candidate = next(
            item
            for item in index["artifacts"]
            if item.get("entity_id") == candidate_result.candidate_id
        )
        self.assertEqual(candidate["display_status"]["value"], "created")
        self.assertIn("RECEIPT_HASH_MISMATCH", {item["code"] for item in index["diagnostics"]})

    def test_candidate_change_after_finalize_is_not_finalized(self) -> None:
        _, candidate_result, _ = self.finalized_pipeline_fixture()
        candidate_result.candidate_path.write_bytes(
            candidate_result.candidate_path.read_bytes() + b"# changed\n"
        )
        index = self.build_pipeline_index()
        candidate = next(
            item
            for item in index["artifacts"]
            if item.get("entity_id") == candidate_result.candidate_id
        )
        self.assertEqual(candidate["display_status"]["value"], "created")
        self.assertIn("FINALIZE_BINDING_INVALID", {item["code"] for item in index["diagnostics"]})

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

    def test_artifact_change_during_secure_read_is_reported_as_stale(self) -> None:
        cookie = self.session_cookie()
        artifact = next(
            item for item in self.server.state.index["artifacts"] if item["artifact_type"] == "run"
        )
        changed = explorer.ResearchExplorerError(
            "ARTIFACT_CHANGED_DURING_READ", "changed while reading", status=409
        )
        with patch.object(explorer, "secure_read_project_file", side_effect=changed):
            status, _, body = self.request(
                "GET",
                f"/api/research/artifacts/{artifact['artifact_id']}",
                headers={
                    "Cookie": cookie,
                    explorer.SNAPSHOT_HEADER: self.server.state.index["index_snapshot_id"],
                },
            )
        self.assertEqual(status, 409)
        self.assertEqual(json.loads(body)["error"]["code"], "ARTIFACT_STALE")

    def test_artifact_read_rejects_symlink_swap_outside_project_root(self) -> None:
        cookie = self.session_cookie()
        artifact = next(
            item for item in self.server.state.index["artifacts"] if item["artifact_type"] == "run"
        )
        manifest = self.manifest()
        outside = Path(self.temp_dir.name) / "outside-manifest.yaml"
        outside.write_text("secret: true\n", encoding="utf-8")
        manifest.unlink()
        try:
            os.symlink(outside, manifest)
        except OSError as exc:
            if os.name == "nt":
                self.skipTest(f"Windows symlink permission unavailable: {exc}")
            raise
        status, _, body = self.request(
            "GET",
            f"/api/research/artifacts/{artifact['artifact_id']}",
            headers={
                "Cookie": cookie,
                explorer.SNAPSHOT_HEADER: self.server.state.index["index_snapshot_id"],
            },
        )
        self.assertEqual(status, 400)
        self.assertEqual(json.loads(body)["error"]["code"], "ARTIFACT_PATH_INVALID")

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
