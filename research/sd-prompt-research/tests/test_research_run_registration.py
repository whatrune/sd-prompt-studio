from __future__ import annotations

import hashlib
import http.client
import json
import shutil
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

import yaml


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import register_research_run as registration  # noqa: E402
import research_explorer as explorer  # noqa: E402


class ResearchRunRegistrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(dir=ROOT)
        self.project = Path(self.temporary.name) / "research-project"
        (self.project / "templates").mkdir(parents=True)
        (self.project / "schemas").mkdir(parents=True)
        (self.project / "ledgers").mkdir(parents=True)
        shutil.copy2(
            ROOT / "templates" / "observation-schema.json",
            self.project / "templates" / "observation-schema.json",
        )
        shutil.copy2(
            ROOT / "schemas" / "research-explorer-index.schema.json",
            self.project / "schemas" / "research-explorer-index.schema.json",
        )
        self.ledger_path = self.project / "ledgers" / "run-index.yaml"
        self.write_ledger([])
        self.run_dir = self.make_run("BRG-TEST-A")

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def make_run(self, run_id: str, domain: str = "bridge") -> Path:
        run_dir = self.project / "experiments" / domain / run_id
        (run_dir / "source").mkdir(parents=True)
        source = ROOT / "experiments" / "bridge" / "BRG-009-A"

        manifest = yaml.safe_load((source / "manifest.yaml").read_text(encoding="utf-8"))
        manifest["run_id"] = run_id
        manifest["domain"] = domain
        manifest["title"] = run_id
        manifest["status"] = "OBSERVED"
        manifest["updated_at"] = "2026-08-31T00:00:00+09:00"
        (run_dir / "manifest.yaml").write_text(
            yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False), encoding="utf-8"
        )

        observation = json.loads((source / "observation.json").read_text(encoding="utf-8"))
        observation["run_id"] = run_id
        (run_dir / "observation.json").write_text(
            json.dumps(observation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

        rubric = yaml.safe_load((source / "source" / "rubric.yaml").read_text(encoding="utf-8"))
        rubric["run_id"] = run_id
        (run_dir / "source" / "rubric.yaml").write_text(
            yaml.safe_dump(rubric, allow_unicode=True, sort_keys=False), encoding="utf-8"
        )
        return run_dir

    def summary(self, run_dir: Path) -> dict[str, str]:
        manifest = yaml.safe_load((run_dir / "manifest.yaml").read_text(encoding="utf-8"))
        return {
            "run_id": manifest["run_id"],
            "domain": manifest["domain"],
            "title": manifest["title"],
            "status": manifest["status"],
            "updated_at": manifest["updated_at"],
            "path": f'experiments/{manifest["domain"]}/{manifest["run_id"]}',
        }

    def write_ledger(self, runs: list[dict[str, str]]) -> None:
        self.ledger_path.write_text(
            yaml.safe_dump(
                {"schema_version": "1.0", "runs": runs},
                allow_unicode=True,
                sort_keys=False,
            ),
            encoding="utf-8",
        )

    def ledger(self) -> dict[str, object]:
        return yaml.safe_load(self.ledger_path.read_text(encoding="utf-8"))

    def ledger_digest(self) -> str:
        return hashlib.sha256(self.ledger_path.read_bytes()).hexdigest()

    def make_prompt_blind_group(
        self,
        run_ids: tuple[str, ...] = ("CAM-TEST-A", "CAM-TEST-B", "CAM-TEST-C"),
    ) -> tuple[list[Path], Path, dict[str, str]]:
        payloads = {
            "observer_input": '{"conditions":["COND-01","COND-02","COND-03"]}',
            "freeze": '{"observations":{"COND-01":"visible"}}',
            "mapping": '{"COND-01":"CAM-TEST-A","COND-02":"CAM-TEST-B","COND-03":"CAM-TEST-C"}',
        }
        digests = {name: hashlib.sha256(value.encode("utf-8")).hexdigest() for name, value in payloads.items()}
        runs: list[Path] = []
        for run_id in run_ids:
            run_dir = self.make_run(run_id, domain="camera")
            manifest_path = run_dir / "manifest.yaml"
            manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
            manifest["source"]["metadata_file"] = f"source/{run_id}_metadata.yaml"
            manifest_path.write_text(
                yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False), encoding="utf-8"
            )
            metadata = {
                "run_id": run_id,
                "matched_seed_contract": {"run_ids": list(run_ids)},
                "provenance_binding": {
                    "observer_input_sha256": digests["observer_input"],
                    "blind_freeze_sha256": digests["freeze"],
                    "sealed_mapping_sha256": digests["mapping"],
                    "independently_recheckable_from_tracked_metadata": True,
                },
                "panels": [],
            }
            (run_dir / "source" / f"{run_id}_metadata.yaml").write_text(
                yaml.safe_dump(metadata, allow_unicode=True, sort_keys=False), encoding="utf-8"
            )
            runs.append(run_dir)

        owner_metadata = runs[0] / "source" / f"{run_ids[0]}_metadata.yaml"
        owner_record = {
            "record_type": "tracked_prompt_blind_record_owner_v1",
            "owner_path": registration._repository_relative_path(self.project, owner_metadata),
            "serialization": "exact_utf8_lf",
            **{
                name: {"sha256": digests[name], "utf8_payload": payloads[name]}
                for name in ("observer_input", "freeze", "mapping")
            },
        }
        owner_input = self.project / "prompt-blind-owner.yaml"
        owner_input.write_text(
            yaml.safe_dump(owner_record, allow_unicode=True, sort_keys=False), encoding="utf-8"
        )
        return runs, owner_input, digests

    def bind_prompt_blind(
        self,
        runs: list[Path],
        owner_input: Path,
        owner_run_id: str = "CAM-TEST-A",
    ) -> dict[str, object]:
        return registration.bind_prompt_blind_provenance(
            self.project,
            runs,
            owner_run_id=owner_run_id,
            owner_record_path=owner_input,
        )

    def finalize(self, *run_dirs: Path, **kwargs: object) -> dict[str, object]:
        expected_digest = kwargs.pop("expected_ledger_sha256", self.ledger_digest())
        return registration.register_runs(
            self.project,
            list(run_dirs) or [self.run_dir],
            finalize_ledger=True,
            expected_ledger_sha256=expected_digest,
            **kwargs,
        )

    def check(self, *run_dirs: Path, **kwargs: object) -> dict[str, object]:
        return registration.register_runs(
            self.project,
            list(run_dirs) or [self.run_dir],
            check_only=True,
            **kwargs,
        )

    def test_ingestion_has_no_run_ledger_owner_or_mutation(self) -> None:
        source = (SCRIPTS / "ingest_run.py").read_text(encoding="utf-8")
        self.assertNotIn("def update_run_index", source)
        self.assertNotIn("run-index.yaml", source)

    def test_pre_ledger_check_succeeds_without_registration_or_ledger(self) -> None:
        self.ledger_path.unlink()
        result = self.check()
        self.assertFalse(result["registered"])
        self.assertEqual(result["run_id"], "BRG-TEST-A")
        self.assertFalse(self.ledger_path.exists())

    def test_single_run_finalization_registers_and_builds_relationship(self) -> None:
        output = self.project / "tmp" / "research-explorer-index.json"
        result = self.finalize(index_output=output)
        self.assertTrue(result["registered"])
        self.assertEqual(result["run_id"], "BRG-TEST-A")
        self.assertEqual(result["diagnostic_count"], 0)
        self.assertTrue(output.is_file())
        self.assertEqual(self.ledger()["runs"], [self.summary(self.run_dir)])

        index = json.loads(output.read_text(encoding="utf-8"))
        observation = next(
            item for item in index["artifacts"] if item["artifact_id"] == result["observation_artifact_id"]
        )
        self.assertIn(result["relationship"], observation["relationships"])

    def test_multi_run_finalization_appends_task_entries_in_lexical_order(self) -> None:
        run_b = self.make_run("BRG-TEST-B")
        run_c = self.make_run("BRG-TEST-C")
        result = self.finalize(run_c, self.run_dir, run_b)
        self.assertEqual(result["run_ids"], ["BRG-TEST-A", "BRG-TEST-B", "BRG-TEST-C"])
        self.assertEqual(
            [entry["run_id"] for entry in self.ledger()["runs"]],
            ["BRG-TEST-A", "BRG-TEST-B", "BRG-TEST-C"],
        )

    def test_invalid_multi_run_member_prevents_entire_ledger_write(self) -> None:
        run_b = self.make_run("BRG-TEST-B")
        observation_path = run_b / "observation.json"
        observation = json.loads(observation_path.read_text(encoding="utf-8"))
        observation["run_id"] = "BRG-WRONG"
        observation_path.write_text(json.dumps(observation) + "\n", encoding="utf-8")
        before = self.ledger_path.read_bytes()
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.finalize(self.run_dir, run_b)
        self.assertEqual(raised.exception.code, "OBSERVATION_RUN_MISMATCH")
        self.assertEqual(self.ledger_path.read_bytes(), before)

    def test_exact_repeat_is_byte_stable_noop(self) -> None:
        self.finalize()
        before = self.ledger_path.read_bytes()
        self.finalize()
        self.assertEqual(self.ledger_path.read_bytes(), before)

    def test_non_task_entries_and_existing_order_are_preserved(self) -> None:
        non_task = self.make_run("BRG-EXISTING")
        existing = self.summary(non_task)
        self.write_ledger([existing])
        before_entry = yaml.safe_load(yaml.safe_dump(existing))
        self.finalize()
        entries = self.ledger()["runs"]
        self.assertEqual(entries[0], before_entry)
        self.assertEqual([entry["run_id"] for entry in entries], ["BRG-EXISTING", "BRG-TEST-A"])

    def test_duplicate_supplied_run_id_fails_without_write(self) -> None:
        before = self.ledger_path.read_bytes()
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.finalize(self.run_dir, self.run_dir)
        self.assertEqual(raised.exception.code, "RUN_INPUT_DUPLICATE_ID")
        self.assertEqual(self.ledger_path.read_bytes(), before)

    def test_duplicate_existing_run_id_fails_without_write(self) -> None:
        summary = self.summary(self.run_dir)
        self.write_ledger([summary, summary])
        before = self.ledger_path.read_bytes()
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.finalize()
        self.assertEqual(raised.exception.code, "RUN_LEDGER_DUPLICATE_ID")
        self.assertEqual(self.ledger_path.read_bytes(), before)

    def test_malformed_ledger_fails_without_replacement(self) -> None:
        self.ledger_path.write_text("schema_version: '1.0'\nruns: nope\n", encoding="utf-8")
        before = self.ledger_path.read_bytes()
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.finalize()
        self.assertEqual(raised.exception.code, "RUN_LEDGER_INVALID")
        self.assertEqual(self.ledger_path.read_bytes(), before)

    def test_stale_expected_digest_fails_without_write(self) -> None:
        before = self.ledger_path.read_bytes()
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.finalize(expected_ledger_sha256="0" * 64)
        self.assertEqual(raised.exception.code, "RUN_LEDGER_STALE")
        self.assertEqual(self.ledger_path.read_bytes(), before)

    def test_same_id_with_different_identity_fails_without_write(self) -> None:
        summary = self.summary(self.run_dir)
        summary["domain"] = "other"
        summary["path"] = "experiments/other/BRG-TEST-A"
        self.write_ledger([summary])
        before = self.ledger_path.read_bytes()
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.finalize()
        self.assertEqual(raised.exception.code, "RUN_LEDGER_IDENTITY_COLLISION")
        self.assertEqual(self.ledger_path.read_bytes(), before)

    def test_same_identity_has_deterministic_bounded_replacement(self) -> None:
        stale = self.summary(self.run_dir)
        stale["title"] = "Old title"
        stale["status"] = "INGESTED"
        stale["updated_at"] = "2026-08-30T00:00:00+09:00"
        self.write_ledger([stale])
        self.finalize()
        self.assertEqual(self.ledger()["runs"], [self.summary(self.run_dir)])

    def test_post_write_explorer_failure_restores_exact_previous_bytes(self) -> None:
        before = self.ledger_path.read_bytes()
        with patch.object(registration, "build_research_index", side_effect=RuntimeError("boom")):
            with self.assertRaises(registration.RunRegistrationError) as raised:
                self.finalize()
        self.assertEqual(raised.exception.code, "INDEX_REGENERATION_FAILED")
        self.assertEqual(self.ledger_path.read_bytes(), before)

    def test_require_registered_detects_missing_registration(self) -> None:
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.check(require_registered=True)
        self.assertEqual(raised.exception.code, "RUN_REGISTRATION_MISSING")

    def test_require_registered_accepts_exact_registration(self) -> None:
        self.finalize()
        result = self.check(require_registered=True)
        self.assertFalse(result["registered"])
        self.assertEqual(result["run_id"], "BRG-TEST-A")

    def test_sequential_a_then_a_b_then_a_b_c_loses_no_registration(self) -> None:
        run_b = self.make_run("BRG-TEST-B")
        run_c = self.make_run("BRG-TEST-C")
        self.finalize(self.run_dir)
        self.finalize(self.run_dir, run_b)
        self.finalize(self.run_dir, run_b, run_c)
        self.assertEqual(
            [entry["run_id"] for entry in self.ledger()["runs"]],
            ["BRG-TEST-A", "BRG-TEST-B", "BRG-TEST-C"],
        )

    def test_ledger_only_advancement_does_not_regenerate_run_artifacts(self) -> None:
        run_b = self.make_run("BRG-TEST-B")
        artifacts = [
            self.run_dir / "manifest.yaml",
            self.run_dir / "observation.json",
            self.run_dir / "source" / "rubric.yaml",
            run_b / "manifest.yaml",
            run_b / "observation.json",
            run_b / "source" / "rubric.yaml",
        ]
        before = {path: path.read_bytes() for path in artifacts}
        self.finalize(self.run_dir)
        self.finalize(run_b)
        self.assertEqual({path: path.read_bytes() for path in artifacts}, before)
        self.assertEqual(
            [entry["run_id"] for entry in self.ledger()["runs"]],
            ["BRG-TEST-A", "BRG-TEST-B"],
        )

    def test_existing_single_run_check_api_remains_compatible(self) -> None:
        result = registration.register_run(self.project, self.run_dir, check_only=True)
        self.assertFalse(result["registered"])
        self.assertEqual(result["run_path"], "experiments/bridge/BRG-TEST-A")

    def test_prompt_blind_authoring_emits_one_owner_and_exact_references(self) -> None:
        runs, owner_input, digests = self.make_prompt_blind_group()
        metadata_paths = [run / "source" / f"{run.name}_metadata.yaml" for run in runs]
        prefixes = {path: path.read_bytes() for path in metadata_paths}
        ledger_before = self.ledger_path.read_bytes()

        result = self.bind_prompt_blind(runs, owner_input)

        self.assertEqual(result["owner_run_id"], "CAM-TEST-A")
        self.assertEqual(len(result["changed_metadata_paths"]), 3)
        self.assertFalse(result["ledger_mutated"])
        self.assertEqual(self.ledger_path.read_bytes(), ledger_before)
        for path in metadata_paths:
            self.assertTrue(path.read_bytes().startswith(prefixes[path]))
        owner = yaml.safe_load(metadata_paths[0].read_text(encoding="utf-8"))[
            "prompt_blind_record_owner"
        ]
        expected_reference = {
            "owner_path": owner["owner_path"],
            "observer_input_sha256": digests["observer_input"],
            "freeze_sha256": digests["freeze"],
            "mapping_sha256": digests["mapping"],
        }
        for path in metadata_paths[1:]:
            metadata = yaml.safe_load(path.read_text(encoding="utf-8"))
            self.assertEqual(metadata["prompt_blind_record_reference"], expected_reference)
        self.assertFalse(self.check(runs[1])["registered"])

        before_repeat = {path: path.read_bytes() for path in metadata_paths}
        repeated = self.bind_prompt_blind(runs, owner_input)
        self.assertEqual(repeated["changed_metadata_paths"], [])
        self.assertEqual({path: path.read_bytes() for path in metadata_paths}, before_repeat)

    def test_prompt_blind_missing_dependent_reference_fails_closed(self) -> None:
        runs, owner_input, _digests = self.make_prompt_blind_group()
        self.bind_prompt_blind(runs, owner_input)
        path = runs[1] / "source" / "CAM-TEST-B_metadata.yaml"
        metadata = yaml.safe_load(path.read_text(encoding="utf-8"))
        del metadata["prompt_blind_record_reference"]
        path.write_text(yaml.safe_dump(metadata, allow_unicode=True, sort_keys=False), encoding="utf-8")

        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.check(runs[2])
        self.assertEqual(raised.exception.code, "PROMPT_BLIND_PROVENANCE_INVALID")
        self.assertIn("CAM-TEST-B", raised.exception.message)

    def test_prompt_blind_declared_group_must_include_validated_run(self) -> None:
        runs, _owner_input, _digests = self.make_prompt_blind_group()
        other_runs, other_owner_input, _other_digests = self.make_prompt_blind_group(
            ("CAM-OTHER-A", "CAM-OTHER-B", "CAM-OTHER-C")
        )
        self.bind_prompt_blind(other_runs, other_owner_input, owner_run_id="CAM-OTHER-A")
        path = runs[0] / "source" / "CAM-TEST-A_metadata.yaml"
        metadata = yaml.safe_load(path.read_text(encoding="utf-8"))
        metadata["matched_seed_contract"]["run_ids"] = [run.name for run in other_runs]
        path.write_text(yaml.safe_dump(metadata, allow_unicode=True, sort_keys=False), encoding="utf-8")

        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.check(runs[0])
        self.assertEqual(raised.exception.code, "PROMPT_BLIND_PROVENANCE_INVALID")
        self.assertIn("absent", raised.exception.message)

    def test_prompt_blind_mismatched_reference_hash_fails_closed(self) -> None:
        runs, owner_input, _digests = self.make_prompt_blind_group()
        self.bind_prompt_blind(runs, owner_input)
        path = runs[2] / "source" / "CAM-TEST-C_metadata.yaml"
        metadata = yaml.safe_load(path.read_text(encoding="utf-8"))
        metadata["prompt_blind_record_reference"]["freeze_sha256"] = "0" * 64
        path.write_text(yaml.safe_dump(metadata, allow_unicode=True, sort_keys=False), encoding="utf-8")

        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.check(runs[0])
        self.assertEqual(raised.exception.code, "PROMPT_BLIND_PROVENANCE_INVALID")

    def test_prompt_blind_owner_payload_and_path_are_verified(self) -> None:
        runs, owner_input, _digests = self.make_prompt_blind_group()
        owner = yaml.safe_load(owner_input.read_text(encoding="utf-8"))
        owner["owner_path"] = "research/sd-prompt-research/experiments/camera/OTHER/source/owner.yaml"
        owner_input.write_text(yaml.safe_dump(owner, sort_keys=False), encoding="utf-8")
        before = {
            path: path.read_bytes()
            for path in (run / "source" / f"{run.name}_metadata.yaml" for run in runs)
        }
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.bind_prompt_blind(runs, owner_input)
        self.assertEqual(raised.exception.code, "PROMPT_BLIND_PROVENANCE_INVALID")
        self.assertEqual(
            {
                path: path.read_bytes()
                for path in (run / "source" / f"{run.name}_metadata.yaml" for run in runs)
            },
            before,
        )

        owner["owner_path"] = registration._repository_relative_path(
            self.project, runs[0] / "source" / "CAM-TEST-A_metadata.yaml"
        )
        owner["freeze"]["utf8_payload"] += "tampered"
        owner_input.write_text(yaml.safe_dump(owner, sort_keys=False), encoding="utf-8")
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.bind_prompt_blind(runs, owner_input)
        self.assertEqual(raised.exception.code, "PROMPT_BLIND_PROVENANCE_INVALID")

    def test_missing_prompt_blind_owner_input_returns_structured_error(self) -> None:
        runs, _owner_input, _digests = self.make_prompt_blind_group()
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.bind_prompt_blind(runs, self.project / "missing-owner.yaml")
        self.assertEqual(raised.exception.code, "PROMPT_BLIND_PROVENANCE_INVALID")
        self.assertIn("cannot be resolved", raised.exception.message)

    def test_prompt_blind_freshness_race_never_overwrites_external_bytes(self) -> None:
        runs, owner_input, _digests = self.make_prompt_blind_group()
        paths = [run / "source" / f"{run.name}_metadata.yaml" for run in runs]
        originals = {path: path.read_bytes() for path in paths}
        externally_changed = originals[paths[1]] + b"# concurrent external change\n"
        original_guard = registration._require_metadata_fresh
        calls = 0

        def introduce_change(path: Path, expected: bytes) -> None:
            nonlocal calls
            calls += 1
            if calls == 5:
                paths[1].write_bytes(externally_changed)
            original_guard(path, expected)

        with patch.object(registration, "_require_metadata_fresh", side_effect=introduce_change):
            with self.assertRaises(registration.RunRegistrationError) as raised:
                self.bind_prompt_blind(runs, owner_input)
        self.assertEqual(raised.exception.code, "PROMPT_BLIND_PROVENANCE_STALE")
        self.assertEqual(paths[0].read_bytes(), originals[paths[0]])
        self.assertEqual(paths[1].read_bytes(), externally_changed)
        self.assertEqual(paths[2].read_bytes(), originals[paths[2]])
        self.assertFalse(any(path.with_name(path.name + ".prompt-blind.tmp").exists() for path in paths))

    def test_prompt_blind_duplicate_owner_is_rejected(self) -> None:
        runs, owner_input, _digests = self.make_prompt_blind_group()
        self.bind_prompt_blind(runs, owner_input)
        owner_metadata = yaml.safe_load(
            (runs[0] / "source" / "CAM-TEST-A_metadata.yaml").read_text(encoding="utf-8")
        )
        path = runs[1] / "source" / "CAM-TEST-B_metadata.yaml"
        metadata = yaml.safe_load(path.read_text(encoding="utf-8"))
        del metadata["prompt_blind_record_reference"]
        metadata["prompt_blind_record_owner"] = owner_metadata["prompt_blind_record_owner"]
        path.write_text(yaml.safe_dump(metadata, allow_unicode=True, sort_keys=False), encoding="utf-8")
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.check(runs[0])
        self.assertEqual(raised.exception.code, "PROMPT_BLIND_PROVENANCE_INVALID")

    def test_run_and_aggregate_mismatches_write_nothing(self) -> None:
        observation_path = self.run_dir / "observation.json"
        original = json.loads(observation_path.read_text(encoding="utf-8"))
        before = self.ledger_path.read_bytes()

        mismatched = dict(original)
        mismatched["run_id"] = "BRG-OTHER"
        observation_path.write_text(json.dumps(mismatched) + "\n", encoding="utf-8")
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.finalize()
        self.assertEqual(raised.exception.code, "OBSERVATION_RUN_MISMATCH")
        self.assertEqual(self.ledger_path.read_bytes(), before)

        aggregate_mismatch = json.loads(json.dumps(original))
        aggregate = aggregate_mismatch["computed_aggregate"]["primary_morphology_counts"]
        aggregate[next(iter(aggregate))] += 1
        observation_path.write_text(json.dumps(aggregate_mismatch) + "\n", encoding="utf-8")
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.finalize()
        self.assertEqual(raised.exception.code, "OBSERVATION_AGGREGATE_MISMATCH")
        self.assertEqual(self.ledger_path.read_bytes(), before)

    def test_registered_artifacts_remain_visible_through_companion_api(self) -> None:
        result = self.finalize()
        frontend = self.project / "frontend"
        frontend.mkdir()
        (frontend / "index.html").write_text('<div id="root"></div>', encoding="utf-8")
        server = explorer.create_companion_server(
            self.project,
            frontend,
            host="127.0.0.1",
            port=0,
            session_token="registration-test-token",
        )
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            connection = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=10)
            connection.request("GET", "/")
            response = connection.getresponse()
            response.read()
            cookie = response.getheader("Set-Cookie").split(";", 1)[0]
            connection.close()

            connection = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=10)
            connection.request("GET", "/api/research/index", headers={"Cookie": cookie})
            response = connection.getresponse()
            index = json.loads(response.read())
            self.assertEqual(response.status, 200)
            snapshot = index["index_snapshot_id"]
            connection.close()

            connection = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=10)
            connection.request(
                "GET",
                f'/api/research/artifacts/{result["observation_artifact_id"]}',
                headers={"Cookie": cookie, explorer.SNAPSHOT_HEADER: snapshot},
            )
            response = connection.getresponse()
            body = response.read()
            self.assertEqual(response.status, 200)
            self.assertEqual(json.loads(body)["run_id"], "BRG-TEST-A")
            connection.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
