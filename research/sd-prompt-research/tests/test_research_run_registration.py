from __future__ import annotations

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
        self.run_id = "BRG-TEST-A"
        self.run_dir = self.project / "experiments" / "bridge" / self.run_id
        (self.run_dir / "source").mkdir(parents=True)
        (self.project / "templates").mkdir(parents=True)
        (self.project / "schemas").mkdir(parents=True)
        shutil.copy2(
            ROOT / "templates" / "observation-schema.json",
            self.project / "templates" / "observation-schema.json",
        )
        shutil.copy2(
            ROOT / "schemas" / "research-explorer-index.schema.json",
            self.project / "schemas" / "research-explorer-index.schema.json",
        )

        source = ROOT / "experiments" / "bridge" / "BRG-009-A"
        manifest = yaml.safe_load((source / "manifest.yaml").read_text(encoding="utf-8"))
        manifest["run_id"] = self.run_id
        manifest["domain"] = "bridge"
        manifest["title"] = self.run_id
        manifest["status"] = "OBSERVED"
        (self.run_dir / "manifest.yaml").write_text(
            yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False), encoding="utf-8"
        )

        observation = json.loads((source / "observation.json").read_text(encoding="utf-8"))
        observation["run_id"] = self.run_id
        (self.run_dir / "observation.json").write_text(
            json.dumps(observation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

        rubric = yaml.safe_load((source / "source" / "rubric.yaml").read_text(encoding="utf-8"))
        rubric["run_id"] = self.run_id
        (self.run_dir / "source" / "rubric.yaml").write_text(
            yaml.safe_dump(rubric, allow_unicode=True, sort_keys=False), encoding="utf-8"
        )

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def register(self, **kwargs: object) -> dict[str, object]:
        return registration.register_run(self.project, self.run_dir, **kwargs)

    def test_registers_run_and_observation_with_relationship_and_index(self) -> None:
        output = self.project / "tmp" / "research-explorer-index.json"
        result = self.register(index_output=output)
        self.assertTrue(result["registered"])
        self.assertEqual(result["run_id"], self.run_id)
        self.assertEqual(result["diagnostic_count"], 0)
        self.assertTrue(output.is_file())

        index = json.loads(output.read_text(encoding="utf-8"))
        run = next(item for item in index["artifacts"] if item["artifact_id"] == result["run_artifact_id"])
        observation = next(
            item for item in index["artifacts"] if item["artifact_id"] == result["observation_artifact_id"]
        )
        self.assertEqual(run["artifact_type"], "run")
        self.assertEqual(observation["artifact_type"], "observation")
        self.assertIn(
            {
                "relation": "observation_of",
                "target_entity_id": self.run_id,
                "target_artifact_id": run["artifact_id"],
            },
            observation["relationships"],
        )

        ledger = yaml.safe_load((self.project / "ledgers" / "run-index.yaml").read_text(encoding="utf-8"))
        self.assertEqual([item["run_id"] for item in ledger["runs"]], [self.run_id])
        self.assertEqual(ledger["runs"][0]["status"], "OBSERVED")

    def test_registration_is_idempotent_in_run_ledger(self) -> None:
        first = self.register()
        second = self.register()
        self.assertEqual(first["run_artifact_id"], second["run_artifact_id"])
        ledger = yaml.safe_load((self.project / "ledgers" / "run-index.yaml").read_text(encoding="utf-8"))
        self.assertEqual(len(ledger["runs"]), 1)

    def test_run_dir_is_resolved_from_research_project_root(self) -> None:
        result = registration.register_run(
            self.project,
            Path("experiments") / "bridge" / self.run_id,
        )
        self.assertEqual(result["run_path"], f"experiments/bridge/{self.run_id}")

    def test_check_only_validates_without_writing_ledger_or_index(self) -> None:
        output = self.project / "tmp" / "index.json"
        result = self.register(index_output=output, check_only=True)
        self.assertFalse(result["registered"])
        self.assertFalse((self.project / "ledgers" / "run-index.yaml").exists())
        self.assertFalse(output.exists())

    def test_run_id_mismatch_is_rejected_without_ledger_write(self) -> None:
        observation_path = self.run_dir / "observation.json"
        observation = json.loads(observation_path.read_text(encoding="utf-8"))
        observation["run_id"] = "BRG-OTHER"
        observation_path.write_text(json.dumps(observation) + "\n", encoding="utf-8")
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.register()
        self.assertEqual(raised.exception.code, "OBSERVATION_RUN_MISMATCH")
        self.assertFalse((self.project / "ledgers" / "run-index.yaml").exists())

    def test_aggregate_mismatch_is_rejected_without_ledger_write(self) -> None:
        observation_path = self.run_dir / "observation.json"
        observation = json.loads(observation_path.read_text(encoding="utf-8"))
        aggregate = observation["computed_aggregate"]["primary_morphology_counts"]
        first_key = next(iter(aggregate))
        aggregate[first_key] += 1
        observation_path.write_text(json.dumps(observation) + "\n", encoding="utf-8")
        with self.assertRaises(registration.RunRegistrationError) as raised:
            self.register()
        self.assertEqual(raised.exception.code, "OBSERVATION_AGGREGATE_MISMATCH")
        self.assertFalse((self.project / "ledgers" / "run-index.yaml").exists())

    def test_index_failure_restores_previous_ledger_bytes(self) -> None:
        self.register()
        ledger_path = self.project / "ledgers" / "run-index.yaml"
        before = ledger_path.read_bytes()
        manifest_path = self.run_dir / "manifest.yaml"
        manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
        manifest["title"] = "Changed title"
        manifest_path.write_text(
            yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False), encoding="utf-8"
        )
        with patch.object(registration, "build_research_index", side_effect=RuntimeError("boom")):
            with self.assertRaises(registration.RunRegistrationError) as raised:
                self.register()
        self.assertEqual(raised.exception.code, "INDEX_REGENERATION_FAILED")
        self.assertEqual(ledger_path.read_bytes(), before)

    def test_registered_artifacts_are_visible_through_existing_companion_api(self) -> None:
        result = self.register()
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
            self.assertEqual(json.loads(body)["run_id"], self.run_id)
            connection.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
