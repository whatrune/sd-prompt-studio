from __future__ import annotations

import copy
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import claim_draft_pipeline as pipeline  # noqa: E402
import observation_to_claim as cli  # noqa: E402
from validate_research_claims import load_current_documents  # noqa: E402


OBSERVATION = ROOT / "experiments" / "bridge" / "BRG-009-A" / "observation.json"
BRG008_POSE = ROOT / "experiments" / "bridge" / "BRG-008-A" / "observation.json"
BRG008_FACE = ROOT / "experiments" / "bridge" / "BRG-008-A" / "face-observation.json"


@contextmanager
def temporary_directory_with_native_cleanup(*, dir: Path | None = None):
    root = Path(tempfile.mkdtemp(dir=dir))
    try:
        yield str(root)
    finally:
        native_root = f"\\\\?\\{root.resolve()}" if sys.platform == "win32" else str(root)
        shutil.rmtree(native_root)
        if root.exists():
            raise OSError(f"Temporary directory cleanup left residue: {root}")


def hair_observation() -> dict:
    axes = {
        "hair_length_extent": [
            "above_neck", "neck_to_shoulder", "below_shoulder",
            "waist_or_longer", "unclear", "not_visible",
        ],
        "neck_hair_overlap": ["absent", "present", "present", "present", "unclear", "not_visible"],
        "shoulder_hair_overlap": ["absent", "absent", "present", "present", "unclear", "not_visible"],
        "hair_identity_clarity": [
            "distinct", "distinct", "distinct", "ambiguous_with_clothing",
            "ambiguous_with_background", "not_visible",
        ],
    }
    panels = []
    for index in range(6):
        panels.append(
            {
                "panel_id": index + 1,
                **{axis: values[index] for axis, values in axes.items()},
                "evidence_notes": [f"Panel {index + 1} visible hair evidence."],
                "confidence": "high",
            }
        )
    result = {
        "schema_version": "1.0",
        "run_id": "HAIR-TEST-A",
        "blind_condition_label": "Condition A",
        "panel_count": 6,
        "hair_observation": {
            "enabled": True,
            "active_axis_order": list(axes),
            "panels": panels,
        },
    }
    result["computed_aggregate"] = pipeline.compute_hair_aggregate(result)
    return result


class ClaimDraftPipelineTests(unittest.TestCase):
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

    def generate(self, output: Path) -> pipeline.GenerationResult:
        return pipeline.generate_draft(ROOT, [(OBSERVATION, "pose")], output_root=output)

    def write_hair_run(self, parent: Path, run_id: str = "BRG-008-A") -> Path:
        run_dir = parent / f"HAIR-{run_id}"
        run_dir.mkdir(parents=True, exist_ok=True)
        observation_path = run_dir / "hair-observation.json"
        observation = hair_observation()
        observation["run_id"] = run_id
        observation_path.write_text(json.dumps(observation), encoding="utf-8")
        (run_dir / "manifest.yaml").write_text(
            f"run_id: {run_id}\ndomain: bridge\nmodel:\n  checkpoint: novaAnimeXL_ilV190\n",
            encoding="utf-8",
        )
        return observation_path

    def resolution_for(self, result: pipeline.GenerationResult) -> dict:
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
            "selected_assertion_id": "assertion.brg009.lying_arch.001",
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
                    "applies_to": "assertion.brg009.lying_arch.001",
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
            "decided_at": "2026-07-16T11:00:00Z",
        }

    def temporary_project(self, directory: str) -> Path:
        project_root = Path(directory) / "research" / "sd-prompt-research"
        project_root.mkdir(parents=True)
        for name in ("schemas", "knowledge", "concepts", "templates"):
            shutil.copytree(ROOT / name, project_root / name)
        destination_run = project_root / "experiments" / "bridge" / "BRG-009-A"
        destination_run.parent.mkdir(parents=True)
        shutil.copytree(ROOT / "experiments" / "bridge" / "BRG-009-A", destination_run)
        return project_root

    def candidate_for(
        self, project_root: Path, output: Path
    ) -> tuple[pipeline.GenerationResult, pipeline.CandidateResult]:
        observation = (
            project_root / "experiments" / "bridge" / "BRG-009-A" / "observation.json"
            if project_root != ROOT
            else OBSERVATION
        )
        result = pipeline.generate_draft(
            project_root, [(observation, "pose")], output_root=output
        )
        (result.draft_dir / "human-resolution.yaml").write_bytes(
            pipeline.yaml_bytes(self.resolution_for(result))
        )
        with patch.object(pipeline, "_integrated_validate"):
            candidate = pipeline.generate_candidate(project_root, result.draft_dir)
        return result, candidate

    def test_initial_module_registry_is_closed_and_versioned(self) -> None:
        registry, modules, content_hash = pipeline.load_module_registry(ROOT)
        self.assertEqual(registry["schema_version"], "0.1.0")
        self.assertEqual(set(modules), {"pose", "face", "hair", "clothing", "camera", "object", "other"})
        self.assertRegex(content_hash, r"^[a-f0-9]{64}$")

    def test_generation_is_deterministic_and_idempotent(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as directory:
            first = self.generate(Path(directory))
            second = self.generate(Path(directory))
            self.assertEqual(first.draft_id, second.draft_id)
            self.assertEqual(first.draft, second.draft)
            self.assertTrue(second.idempotent)
            text = (first.draft_dir / "pre-schema-draft.yaml").read_text(encoding="utf-8")
            self.assertNotIn("&id", text)
            self.assertNotIn("*id", text)

    def test_draft_tampering_is_detected_from_generation_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = self.generate(Path(directory))
            tampered = copy.deepcopy(result.draft)
            tampered["unresolved_fields"][0]["reason_code"] = "TAMPERED"
            (result.draft_dir / "pre-schema-draft.yaml").write_bytes(pipeline.yaml_bytes(tampered))
            with self.assertRaises(pipeline.PipelineError) as raised:
                pipeline._load_and_verify_draft(ROOT, result.draft_dir)
            self.assertEqual(raised.exception.code, "DRAFT_TAMPERED")

    def test_evidence_id_projection_and_content_hash_are_consistent(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = self.generate(Path(directory))
            ids = set()
            for evidence in result.draft["staged_evidence"]:
                self.assertEqual(
                    pipeline.semantic_hash(evidence["evidence_id_projection"]),
                    evidence["evidence_id_projection_hash"],
                )
                self.assertRegex(evidence["evidence_id"], r"^evidence\.brg_009_a\.pose\..+\.[a-f0-9]{16}$")
                self.assertNotIn(evidence["evidence_id"], ids)
                ids.add(evidence["evidence_id"])

    def test_optional_face_module_remains_separate_from_pose(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = pipeline.generate_draft(
                ROOT,
                [(BRG008_POSE, "pose"), (BRG008_FACE, "face")],
                output_root=Path(directory),
            )
            modules = {item["canonical_module_slug"] for item in result.draft["used_module_compatibility"]}
            evidence_modules = {item["canonical_fact"]["observation_module"] for item in result.draft["staged_evidence"]}
            self.assertEqual(modules, {"pose", "face"})
            self.assertEqual(evidence_modules, {"pose", "face"})

    def test_legacy_pose_and_face_artifacts_remain_byte_identical(self) -> None:
        cases = (
            (
                [(BRG008_POSE, "pose")],
                "85306bdbb72283592bd8d08f4be351f5503170e111febe842d26826e0ef53f21",
                "48c24dfefbeb87f5e76389bf00e4061ffa8249113bc36a33b446c22b6b2ce7fc",
                "draft.51418dbc805a067f47105b5e27a1f433d6bccb81e737e9ca75267187b74fec30",
            ),
            (
                [(BRG008_POSE, "pose"), (BRG008_FACE, "face")],
                "23b95e1b1b37a41d78135f6a4b2633aeadca5af4843f090d7c2c6818572882c1",
                "ab8720891732a1a5cf2cc51a85e6fafdde7d792958d3fba400ab07077895a42b",
                "draft.95d311faba6454cfea0a5f7688db59894c6ee7a49db0baf014c5a35e7a70fab9",
            ),
        )
        for sources, draft_hash, report_hash, draft_id in cases:
            with self.subTest(sources=sources), tempfile.TemporaryDirectory() as directory:
                result = pipeline.generate_draft(ROOT, sources, output_root=Path(directory))
                self.assertEqual(draft_id, result.draft_id)
                self.assertEqual(
                    draft_hash,
                    hashlib.sha256(pipeline.yaml_bytes(result.draft)).hexdigest(),
                )
                self.assertEqual(
                    report_hash,
                    hashlib.sha256(pipeline.json_bytes(result.report)).hexdigest(),
                )
                self.assertEqual(
                    pipeline.OBSERVATION_VALIDATOR_VERSION,
                    result.draft["draft_input_identity"]["observation_validator_version"],
                )

    def test_optional_hair_module_emits_all_bounded_counts_with_provenance(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as source_dir, tempfile.TemporaryDirectory() as output_dir:
            hair_path = self.write_hair_run(Path(source_dir))
            result = pipeline.generate_draft(
                ROOT,
                [(BRG008_POSE, "pose"), (hair_path, "hair")],
                output_root=Path(output_dir),
            )
            modules = {item["canonical_module_slug"] for item in result.draft["used_module_compatibility"]}
            hair_evidence = [
                item for item in result.draft["staged_evidence"]
                if item["canonical_fact"]["observation_module"] == "hair"
            ]
            self.assertEqual({"pose", "hair"}, modules)
            self.assertEqual(19, len(hair_evidence))
            self.assertEqual({6}, {item["canonical_fact"]["total"] for item in hair_evidence})
            self.assertIn(0, {item["canonical_fact"]["count"] for item in hair_evidence})
            self.assertEqual(
                pipeline.HAIR_OBSERVATION_VALIDATOR_VERSION,
                result.draft["draft_input_identity"]["observation_validator_version"],
            )
            source_roles = {
                (item["module"], item["source_role"], item["run_id"])
                for item in result.draft["draft_input_identity"]["source_files"]
            }
            self.assertIn(("hair", "optional_module_observation", "BRG-008-A"), source_roles)
            self.assertIn(("hair", "rubric", "BRG-008-A"), source_roles)
            self.assertIn(("hair", "observation_schema", "not_applicable"), source_roles)
            schema = pipeline._load_json(ROOT / "templates" / "hair-observation-schema.json")
            expected_content_hash = pipeline.semantic_hash(schema)
            bound = result.draft["used_schema_compatibility"]
            self.assertEqual(bound, result.draft["draft_input_identity"]["used_schema_compatibility"])
            self.assertEqual(bound, result.report["schema_compatibility"])
            self.assertEqual(1, len(bound))
            self.assertEqual("hair", bound[0]["module"])
            self.assertEqual("observation_schema", bound[0]["source_role"])
            self.assertEqual("jcs_sha256_v1", bound[0]["hash_algorithm"])
            self.assertEqual(expected_content_hash, bound[0]["content_hash"])
            self.assertEqual(
                result.draft["draft_input_identity_hash"],
                pipeline.semantic_hash(result.draft["draft_input_identity"]),
            )
            compatibility = pipeline.check_registry_compatibility(ROOT, result.draft_dir)
            self.assertEqual("unchanged", compatibility.classification)
            schema_result = compatibility.receipt["payload"]["schema_results"][0]
            self.assertEqual("unchanged", schema_result["result"])
            self.assertEqual(bound[0]["content_hash"], schema_result["generation_content_hash"])
            self.assertEqual(bound[0]["compatibility_hash"], schema_result["generation_compatibility_hash"])

    def test_hair_schema_drift_is_incompatible_without_replacing_bound_identity(self) -> None:
        with tempfile.TemporaryDirectory() as project_dir, temporary_directory_with_native_cleanup() as output_dir:
            project_root = self.temporary_project(project_dir)
            bridge_root = project_root / "experiments" / "bridge"
            shutil.copytree(ROOT / "experiments" / "bridge" / "BRG-008-A", bridge_root / "BRG-008-A")
            hair_path = self.write_hair_run(bridge_root)
            pose_path = bridge_root / "BRG-008-A" / "observation.json"
            result = pipeline.generate_draft(
                project_root,
                [(pose_path, "pose"), (hair_path, "hair")],
                output_root=Path(output_dir),
            )
            (result.draft_dir / "human-resolution.yaml").write_bytes(
                pipeline.yaml_bytes(self.resolution_for(result))
            )
            with patch.object(pipeline, "_integrated_validate"):
                candidate = pipeline.generate_candidate(project_root, result.draft_dir)
            bound = copy.deepcopy(result.draft["used_schema_compatibility"][0])
            schema_path = project_root / "templates" / "hair-observation-schema.json"
            schema = pipeline._load_json(schema_path)
            schema["title"] += " drift"
            schema_path.write_bytes(pipeline.json_bytes(schema))
            compatibility = pipeline.check_registry_compatibility(project_root, result.draft_dir)
            self.assertEqual("incompatible", compatibility.classification)
            schema_result = compatibility.receipt["payload"]["schema_results"][0]
            self.assertEqual("incompatible", schema_result["result"])
            self.assertEqual(bound["content_hash"], schema_result["generation_content_hash"])
            self.assertNotEqual(bound["content_hash"], schema_result["current_content_hash"])
            self.assertEqual(bound, result.draft["used_schema_compatibility"][0])
            self.assertEqual(bound, result.report["schema_compatibility"][0])
            regenerated = pipeline.generate_draft(
                project_root,
                [(pose_path, "pose"), (hair_path, "hair")],
                output_root=Path(output_dir),
            )
            self.assertNotEqual(result.draft_id, regenerated.draft_id)
            self.assertEqual(
                schema_result["current_content_hash"],
                regenerated.draft["used_schema_compatibility"][0]["content_hash"],
            )
            with self.assertRaises(pipeline.PipelineError) as raised:
                pipeline.generate_candidate(project_root, result.draft_dir)
            self.assertEqual("DRAFT_REGISTRY_INCOMPATIBLE", raised.exception.code)
            with self.assertRaises(pipeline.PipelineError) as finalize_raised:
                pipeline.finalize_candidate(
                    project_root,
                    result.draft_dir,
                    candidate_id=candidate.candidate_id,
                    explicit_finalize=True,
                )
            self.assertEqual("DRAFT_REGISTRY_INCOMPATIBLE", finalize_raised.exception.code)

    def test_hair_rubric_drift_remains_incompatible(self) -> None:
        with tempfile.TemporaryDirectory() as project_dir, temporary_directory_with_native_cleanup() as output_dir:
            project_root = self.temporary_project(project_dir)
            bridge_root = project_root / "experiments" / "bridge"
            shutil.copytree(ROOT / "experiments" / "bridge" / "BRG-008-A", bridge_root / "BRG-008-A")
            hair_path = self.write_hair_run(bridge_root)
            result = pipeline.generate_draft(
                project_root,
                [(bridge_root / "BRG-008-A" / "observation.json", "pose"), (hair_path, "hair")],
                output_root=Path(output_dir),
            )
            bound_rubric = next(
                source
                for source in result.draft["draft_input_identity"]["source_files"]
                if source["module"] == "hair" and source["source_role"] == "rubric"
            )
            rubric_path = project_root / "templates" / "hair-observation-rubric.yaml"
            rubric = pipeline._load_yaml(rubric_path)
            rubric["active_hair_axes"] = list(reversed(rubric["active_hair_axes"]))
            rubric_path.write_bytes(pipeline.yaml_bytes(rubric))
            compatibility = pipeline.check_registry_compatibility(project_root, result.draft_dir)
            self.assertEqual("incompatible", compatibility.classification)
            rubric_result = compatibility.receipt["payload"]["rubric_results"][0]
            self.assertEqual("incompatible", rubric_result["result"])
            self.assertEqual(bound_rubric["hash_value"], rubric_result["generation_hash"])
            self.assertNotEqual(bound_rubric["hash_value"], rubric_result["current_hash"])
            with self.assertRaises(pipeline.PipelineError) as raised:
                pipeline.generate_candidate(project_root, result.draft_dir)
            self.assertEqual("DRAFT_REGISTRY_INCOMPATIBLE", raised.exception.code)

    def test_hair_draft_missing_schema_provenance_fails_closed(self) -> None:
        draft = {
            "used_module_compatibility": [{"canonical_module_slug": "hair"}],
            "draft_input_identity": {"source_files": []},
        }
        with self.assertRaises(pipeline.PipelineError) as raised:
            pipeline._bound_schema_compatibility(draft)
        self.assertEqual("DRAFT_SCHEMA_PROVENANCE_MISSING", raised.exception.code)

    def test_invalid_optional_hair_is_rejected_while_core_draft_continues(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as source_dir, tempfile.TemporaryDirectory() as output_dir:
            hair_path = self.write_hair_run(Path(source_dir))
            (hair_path.parent / "manifest.yaml").write_text("run_id: HAIR-TEST-B\n", encoding="utf-8")
            result = pipeline.generate_draft(
                ROOT,
                [(BRG008_POSE, "pose"), (hair_path, "hair")],
                output_root=Path(output_dir),
            )
            modules = {
                item["canonical_module_slug"]
                for item in result.draft["used_module_compatibility"]
            }
            self.assertEqual({"pose"}, modules)
            self.assertFalse(
                [
                    item
                    for item in result.draft["staged_evidence"]
                    if item["canonical_fact"]["observation_module"] == "hair"
                ]
            )
            self.assertNotIn("used_schema_compatibility", result.draft)
            self.assertEqual(
                pipeline.HAIR_OBSERVATION_VALIDATOR_VERSION,
                result.draft["draft_input_identity"]["observation_validator_version"],
            )
            self.assertEqual(
                ["OBSERVATION_SCHEMA_INVALID"],
                [item["code"] for item in result.report["diagnostics"]],
            )
            self.assertEqual("warning", result.report["diagnostics"][0]["severity"])
            rejected = [
                item
                for item in result.draft["draft_input_identity"]["source_files"]
                if item["module"] == "hair"
            ]
            self.assertEqual(1, len(rejected))
            self.assertEqual("optional_module_observation", rejected[0]["source_role"])
            self.assertEqual("not_applicable", rejected[0]["run_id"])

    def test_repeated_hair_runs_share_one_schema_source_and_preserve_run_sources(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as source_dir, tempfile.TemporaryDirectory() as output_dir:
            hair_a = self.write_hair_run(Path(source_dir), "BRG-008-A")
            hair_b = self.write_hair_run(Path(source_dir), "BRG-008-B")
            result = pipeline.generate_draft(
                ROOT,
                [(BRG008_POSE, "pose"), (hair_a, "hair"), (hair_b, "hair")],
                output_root=Path(output_dir),
            )
            sources = result.draft["draft_input_identity"]["source_files"]
            schema_sources = [
                item
                for item in sources
                if item["module"] == "hair" and item["source_role"] == "observation_schema"
            ]
            observation_sources = [
                item
                for item in sources
                if item["module"] == "hair"
                and item["source_role"] == "optional_module_observation"
            ]
            rubric_sources = [
                item
                for item in sources
                if item["module"] == "hair" and item["source_role"] == "rubric"
            ]
            self.assertEqual(1, len(schema_sources))
            self.assertEqual("not_applicable", schema_sources[0]["run_id"])
            self.assertEqual({"BRG-008-A", "BRG-008-B"}, {item["run_id"] for item in observation_sources})
            self.assertEqual({"BRG-008-A", "BRG-008-B"}, {item["run_id"] for item in rubric_sources})
            self.assertEqual(1, len(result.draft["used_schema_compatibility"]))
            bound_rubric = pipeline._bound_hair_rubric_source(result.draft)
            self.assertEqual("hair", bound_rubric["module"])
            self.assertEqual("rubric", bound_rubric["source_role"])

    def test_repeated_hair_runs_with_conflicting_schema_identity_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as source_dir, tempfile.TemporaryDirectory() as output_dir:
            hair_a = self.write_hair_run(Path(source_dir), "BRG-008-A")
            hair_b = self.write_hair_run(Path(source_dir), "BRG-008-B")
            original = pipeline._observation_source
            hair_calls = 0

            def conflicting_schema(*args, **kwargs):
                nonlocal hair_calls
                loaded, extracted, evidence, manifest = original(*args, **kwargs)
                if args[2] == "hair":
                    hair_calls += 1
                    if hair_calls == 2:
                        loaded = copy.deepcopy(loaded)
                        entry = loaded["schema_compatibility"][0]
                        entry["content_hash"] = "0" * 64
                        entry["compatibility_hash"] = pipeline.semantic_hash(
                            {key: value for key, value in entry.items() if key != "compatibility_hash"}
                        )
                        schema_source = next(
                            source
                            for source in loaded["source_files"]
                            if source["source_role"] == "observation_schema"
                        )
                        schema_source["hash_value"] = "0" * 64
                return loaded, extracted, evidence, manifest

            with patch.object(pipeline, "_observation_source", side_effect=conflicting_schema):
                with self.assertRaises(pipeline.PipelineError) as raised:
                    pipeline.generate_draft(
                        ROOT,
                        [(BRG008_POSE, "pose"), (hair_a, "hair"), (hair_b, "hair")],
                        output_root=Path(output_dir),
                    )
            self.assertEqual("DUPLICATE_SCHEMA_COMPATIBILITY_ENTRY", raised.exception.code)

    def test_hair_draft_to_candidate_assertion_succeeds(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as source_dir, temporary_directory_with_native_cleanup() as output_dir:
            hair_path = self.write_hair_run(Path(source_dir))
            result = pipeline.generate_draft(
                ROOT,
                [(BRG008_POSE, "pose"), (hair_path, "hair")],
                output_root=Path(output_dir),
            )
            evidence = next(
                item for item in result.draft["staged_evidence"]
                if item["canonical_fact"]["metric"].endswith("hair_length_extent.below_shoulder")
            )
            resolution = self.resolution_for(result)
            resolution.update(
                {
                    "selected_assertion_id": "assertion.hair_test.length_extent.001",
                    "selected_subject": {
                        "kind": "phrase_surface",
                        "phrase": "hair test observation",
                        "locale": "en",
                        "normalized_phrase": "hair test observation",
                    },
                    "selected_claim_statement": {
                        "statement": "In BRG-008-A, below-shoulder hair extent was observed."
                    },
                    "selected_evidence_bindings": [
                        {
                            "evidence_ref_id": evidence["evidence_id"],
                            "evidence_role": "supports",
                            "applies_to": "assertion.hair_test.length_extent.001",
                            "evidence_quality": {
                                "coverage": "full",
                                "directness": "direct",
                                "consistency": "high",
                            },
                        }
                    ],
                    "selected_scope": {
                        "model_scope": "single_model",
                        "context_scope": "single_context",
                        "domain_scope": "hair",
                        "generalization_scope": "local",
                    },
                }
            )
            (result.draft_dir / "human-resolution.yaml").write_bytes(pipeline.yaml_bytes(resolution))
            candidate = pipeline.generate_candidate(ROOT, result.draft_dir)
            canonical = candidate.wrapper["canonical_assertion"]
            self.assertEqual({"hair"}, set(canonical["axis_registry_refs"]))
            assertion = canonical["assertions"][0]
            self.assertEqual("draft", assertion["status"])
            self.assertEqual("no_promotion", assertion["promotion"]["action"])
            bound = result.draft["used_schema_compatibility"][0]
            schema_ref = assertion["observation_schema_refs"]["hair"]
            self.assertEqual(bound["schema_id"], schema_ref["schema_id"])
            self.assertEqual(bound["schema_version"], schema_ref["schema_version"])
            self.assertEqual(bound["content_hash"], schema_ref["hash_value"])
            rubric_source = next(
                source
                for source in result.draft["draft_input_identity"]["source_files"]
                if source["module"] == "hair" and source["source_role"] == "rubric"
            )
            self.assertEqual(
                rubric_source["hash_value"],
                canonical["axis_registry_refs"]["hair"]["sha256"],
            )
            original_hash = pipeline._assertion_content_v1_hash(ROOT, canonical)
            changed = copy.deepcopy(canonical)
            changed["assertions"][0]["observation_schema_refs"]["hair"]["hash_value"] = "0" * 64
            self.assertNotEqual(original_hash, pipeline._assertion_content_v1_hash(ROOT, changed))

    def test_hair_failure_report_preserves_hair_module_identity(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as source_dir, tempfile.TemporaryDirectory() as output_dir:
            source = Path(source_dir) / "hair-observation.json"
            source.write_bytes(b"{\xff")
            error = pipeline.PipelineError("SOURCE_INVALID_UTF8", "invalid")
            failure_dir = pipeline.persist_generation_failure(
                ROOT,
                error,
                output_root=Path(output_dir),
                source_paths=[source],
                source_modules={source: "hair"},
            )
            report = json.loads((failure_dir / "generation-report.json").read_text(encoding="utf-8"))
            self.assertEqual("hair", report["sources"]["source_files"][0]["module"])
            self.assertEqual(
                pipeline.HAIR_OBSERVATION_VALIDATOR_VERSION,
                report["observation_validation"]["validator_version"],
            )

    def test_failure_report_uses_raw_bytes_for_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory(dir=ROOT) as source_dir, tempfile.TemporaryDirectory() as output_dir:
            source = Path(source_dir) / "broken.json"
            source.write_bytes(b"{\xff")
            error = pipeline.PipelineError("SOURCE_INVALID_UTF8", "invalid")
            failure_dir = pipeline.persist_generation_failure(
                ROOT, error, output_root=Path(output_dir), source_paths=[source]
            )
            report = json.loads((failure_dir / "generation-report.json").read_text(encoding="utf-8"))
            self.assertEqual(report["report_type"], "generation_failure")
            self.assertNotIn("draft_id", report["identity"])
            self.assertEqual(report["sources"]["source_files"][0]["hash_algorithm"], "raw_bytes_sha256_v1")

    def test_human_resolution_hash_excludes_audit_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = self.generate(Path(directory))
            resolution = self.resolution_for(result)
            changed = copy.deepcopy(resolution)
            changed["resolution_id"] = pipeline.uuid7_text()
            changed["decided_by"] = "another-human"
            changed["decided_at"] = "2026-07-16T12:00:00Z"
            self.assertEqual(
                pipeline.human_resolution_hash(resolution), pipeline.human_resolution_hash(changed)
            )

    def test_candidate_wrapper_does_not_leak_metadata_into_canonical_assertion(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as directory:
            result = self.generate(Path(directory))
            resolution = self.resolution_for(result)
            (result.draft_dir / "human-resolution.yaml").write_bytes(pipeline.yaml_bytes(resolution))
            with patch.object(pipeline, "_integrated_validate"):
                candidate = pipeline.generate_candidate(ROOT, result.draft_dir)
            canonical = candidate.wrapper["canonical_assertion"]
            for field in ("candidate_id", "human_resolution_hash", "generator_version"):
                self.assertNotIn(field, canonical)
            pipeline.validate_artifact(ROOT, "observation-to-claim-candidate.schema.json", candidate.wrapper)

    def test_existing_canonical_evidence_is_referenced_without_duplication(self) -> None:
        with tempfile.TemporaryDirectory() as project_dir, tempfile.TemporaryDirectory(dir=Path.home()) as first_output, tempfile.TemporaryDirectory(dir=Path.home()) as second_output:
            project_root = self.temporary_project(project_dir)
            observation = project_root / "experiments" / "bridge" / "BRG-009-A" / "observation.json"
            first = pipeline.generate_draft(
                project_root, [(observation, "pose")], output_root=Path(first_output)
            )
            selected = next(
                item
                for item in first.draft["staged_evidence"]
                if item["canonical_fact"]["metric"].endswith("primary_morphology_counts.lying_arch")
            )
            existing_path = project_root / "knowledge" / "assertions" / "existing-evidence-fixture.yaml"
            existing_path.write_bytes(
                pipeline.yaml_bytes({"evidence_refs": [selected["canonical_fact"]]})
            )
            second = pipeline.generate_draft(
                project_root, [(observation, "pose")], output_root=Path(second_output)
            )
            resolution = self.resolution_for(second)
            (second.draft_dir / "human-resolution.yaml").write_bytes(pipeline.yaml_bytes(resolution))
            with patch.object(pipeline, "_integrated_validate"):
                candidate = pipeline.generate_candidate(project_root, second.draft_dir)
            canonical = candidate.wrapper["canonical_assertion"]
            self.assertEqual(canonical["evidence_refs"], [])
            self.assertEqual(
                canonical["assertions"][0]["observed_metrics"][0]["evidence_ref_ids"],
                [selected["evidence_id"]],
            )

    def test_candidate_identity_changes_with_generator_version(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = self.generate(Path(directory))
            resolution_hash = pipeline.human_resolution_hash(self.resolution_for(result))
            first = pipeline._candidate_identity(result.draft, resolution_hash)[0]
            with patch.object(pipeline, "GENERATOR_VERSION", "0.2.0"):
                second = pipeline._candidate_identity(result.draft, resolution_hash)[0]
            self.assertNotEqual(first, second)

    def test_registry_compatibility_receipt_is_closed_and_unchanged(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = self.generate(Path(directory))
            compatibility = pipeline.check_registry_compatibility(ROOT, result.draft_dir)
            self.assertEqual(compatibility.classification, "unchanged")
            self.assertEqual(compatibility.receipt["receipt_type"], "registry_compatibility_check")
            pipeline.validate_artifact(ROOT, "observation-to-claim-receipt.schema.json", compatibility.receipt)

    def test_finalize_requires_explicit_human_action(self) -> None:
        with self.assertRaisesRegex(pipeline.PipelineError, "explicit human action") as raised:
            pipeline.finalize_candidate(ROOT, Path("unused"), explicit_finalize=False)
        self.assertEqual(raised.exception.code, "EXPLICIT_FINALIZE_REQUIRED")

    def test_finalize_postvalidation_failure_rolls_back_and_records_receipt(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as output_dir, tempfile.TemporaryDirectory() as project_dir:
            result = self.generate(Path(output_dir))
            resolution = self.resolution_for(result)
            (result.draft_dir / "human-resolution.yaml").write_bytes(pipeline.yaml_bytes(resolution))
            with patch.object(pipeline, "_integrated_validate"):
                candidate = pipeline.generate_candidate(ROOT, result.draft_dir)

            project_root = self.temporary_project(project_dir)
            completed = subprocess.CompletedProcess(
                args=[], returncode=1, stdout=json.dumps({"errors": [{"code": "TEST"}]}), stderr=""
            )
            with patch.object(pipeline, "_integrated_validate"), patch.object(
                pipeline.subprocess, "run", return_value=completed
            ):
                with self.assertRaises(pipeline.PipelineError) as raised:
                    pipeline.finalize_candidate(
                        project_root,
                        result.draft_dir,
                        candidate_id=candidate.candidate_id,
                        explicit_finalize=True,
                    )
            self.assertEqual(raised.exception.code, "POST_VALIDATION_FAILED")
            destination = project_root / "knowledge" / "assertions" / "assertion-brg009-lying-arch-001.yaml"
            self.assertFalse(destination.exists())
            receipts = [
                json.loads(path.read_text(encoding="utf-8"))
                for path in (candidate.candidate_dir / "generation-receipts").glob("*.json")
            ]
            self.assertTrue(any(item["receipt_type"] == "finalize_attempt" for item in receipts))
            self.assertTrue(any(item["receipt_type"] == "rollback" for item in receipts))
            rollback = next(item for item in receipts if item["receipt_type"] == "rollback")
            identity = rollback["payload"]["candidate_identity"]
            for key in (
                "candidate_wrapper_artifact_hash_v1",
                "canonical_assertion_artifact_hash_v1",
                "assertion_content_v1_hash",
            ):
                self.assertEqual(identity[key], candidate.receipt["payload"]["candidate_identity"][key])
            self.assertEqual(
                rollback["related_artifact_hashes"]["claim_candidate"]["algorithm"],
                "normalized_text_file_sha256_v1",
            )
            self.assertEqual(
                rollback["related_artifact_hashes"]["canonical_assertion"]["algorithm"],
                "normalized_text_file_sha256_v1",
            )

    def test_finalize_success_installs_only_canonical_assertion(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as output_dir, tempfile.TemporaryDirectory() as project_dir:
            result = self.generate(Path(output_dir))
            resolution = self.resolution_for(result)
            (result.draft_dir / "human-resolution.yaml").write_bytes(pipeline.yaml_bytes(resolution))
            with patch.object(pipeline, "_integrated_validate"):
                candidate = pipeline.generate_candidate(ROOT, result.draft_dir)
            project_root = self.temporary_project(project_dir)
            completed = self.successful_validator_process()
            with patch.object(pipeline, "_integrated_validate"), patch.object(
                pipeline.subprocess, "run", return_value=completed
            ):
                finalized = pipeline.finalize_candidate(
                    project_root,
                    result.draft_dir,
                    candidate_id=candidate.candidate_id,
                    explicit_finalize=True,
                )
            installed = pipeline._load_yaml(finalized.destination)
            self.assertEqual(installed, candidate.wrapper["canonical_assertion"])
            self.assertNotIn("candidate_id", installed)
            self.assertEqual(finalized.receipt["result"], "succeeded")

    def test_finalize_rejects_schema_valid_canonical_assertion_tampering(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as output_dir:
            result, candidate = self.candidate_for(ROOT, Path(output_dir))
            wrapper = copy.deepcopy(candidate.wrapper)
            wrapper["canonical_assertion"]["assertions"][0]["claim"]["statement"] += " Tampered."
            candidate.candidate_path.write_bytes(pipeline.yaml_bytes(wrapper))
            with self.assertRaises(pipeline.PipelineError) as raised:
                pipeline.finalize_candidate(
                    ROOT,
                    result.draft_dir,
                    candidate_id=candidate.candidate_id,
                    explicit_finalize=True,
                )
            self.assertIn(
                raised.exception.code,
                {"CANDIDATE_TAMPERED", "CANONICAL_ASSERTION_HASH_MISMATCH"},
            )

    def test_finalize_rejects_wrapper_metadata_tampering(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as output_dir:
            result, candidate = self.candidate_for(ROOT, Path(output_dir))
            wrapper = copy.deepcopy(candidate.wrapper)
            wrapper["generator_version"] = "0.2.0"
            candidate.candidate_path.write_bytes(pipeline.yaml_bytes(wrapper))
            with self.assertRaises(pipeline.PipelineError) as raised:
                pipeline.finalize_candidate(
                    ROOT,
                    result.draft_dir,
                    candidate_id=candidate.candidate_id,
                    explicit_finalize=True,
                )
            self.assertEqual(raised.exception.code, "CANDIDATE_TAMPERED")

    def test_finalize_preflight_schema_failure_writes_failed_receipt(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as output_dir:
            result, candidate = self.candidate_for(ROOT, Path(output_dir))
            wrapper = copy.deepcopy(candidate.wrapper)
            wrapper["generator_version"] = "invalid-version"
            candidate.candidate_path.write_bytes(pipeline.yaml_bytes(wrapper))
            with self.assertRaises(pipeline.PipelineError) as raised:
                pipeline.finalize_candidate(
                    ROOT,
                    result.draft_dir,
                    candidate_id=candidate.candidate_id,
                    explicit_finalize=True,
                )
            self.assertEqual(raised.exception.code, "CANDIDATE_SCHEMA_INVALID")
            receipts = [
                json.loads(path.read_text(encoding="utf-8"))
                for path in candidate.candidate_dir.joinpath("generation-receipts").glob("*.json")
            ]
            failed = [
                item
                for item in receipts
                if item["receipt_type"] == "finalize_attempt"
                and item["result"] == "failed"
            ]
            self.assertEqual(len(failed), 1)
            self.assertEqual(failed[0]["payload"]["failed_step"], "candidate_schema_validation")
            self.assertEqual(failed[0]["payload"]["error_code"], "CANDIDATE_SCHEMA_INVALID")
            self.assertEqual(failed[0]["payload"]["candidate_identity"]["status"], "not_available")

    def test_canonical_yaml_serialization_uses_explicit_root_order(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as output_dir:
            _result, candidate = self.candidate_for(ROOT, Path(output_dir))
            canonical = candidate.wrapper["canonical_assertion"]

            def reverse_objects(value):
                if isinstance(value, dict):
                    return {
                        key: reverse_objects(item)
                        for key, item in reversed(list(value.items()))
                    }
                if isinstance(value, list):
                    return [reverse_objects(item) for item in value]
                return value

            payload = pipeline.canonical_assertion_bytes(
                reverse_objects(canonical)
            ).decode("utf-8")
            self.assertEqual(
                payload.encode("utf-8"),
                pipeline.canonical_assertion_bytes(canonical),
            )
            root_keys = [
                line.split(":", 1)[0].strip('"')
                for line in payload.splitlines()
                if line and not line.startswith((" ", "-"))
            ]
            self.assertEqual(
                root_keys,
                list(pipeline.CANONICAL_ASSERTION_ROOT_KEY_ORDER),
            )
            self.assertTrue(payload.endswith("\n"))
            self.assertNotIn("\r", payload)

    def test_validator_infrastructure_failure_is_not_success(self) -> None:
        completed = subprocess.CompletedProcess(
            args=[],
            returncode=2,
            stdout=json.dumps(
                {
                    "validation_completed": False,
                    "passed": False,
                    "valid": False,
                    "exit_code": 2,
                    "error_count": 0,
                    "infrastructure_error_count": 1,
                    "errors": [],
                    "infrastructure_errors": [{"code": "TEST"}],
                }
            ),
            stderr="",
        )
        with self.assertRaises(pipeline.PipelineError) as raised:
            pipeline._require_successful_validator_result(
                completed, "CANDIDATE_INTEGRATION_FAILED"
            )
        self.assertEqual(raised.exception.code, "CANDIDATE_INTEGRATION_FAILED")

    def test_validator_incomplete_json_is_not_success(self) -> None:
        completed = self.successful_validator_process()
        report = json.loads(completed.stdout)
        report["validation_completed"] = False
        completed.stdout = json.dumps(report)
        with self.assertRaises(pipeline.PipelineError):
            pipeline._require_successful_validator_result(
                completed, "POST_VALIDATION_FAILED"
            )

    def test_human_resolutions_create_separate_immutable_candidates(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as output_dir:
            result = self.generate(Path(output_dir))
            first_resolution = self.resolution_for(result)
            resolution_path = result.draft_dir / "human-resolution.yaml"
            resolution_path.write_bytes(pipeline.yaml_bytes(first_resolution))
            with patch.object(pipeline, "_integrated_validate"):
                first = pipeline.generate_candidate(ROOT, result.draft_dir)
            original = first.candidate_path.read_bytes()
            second_resolution = copy.deepcopy(first_resolution)
            second_resolution["selected_claim_statement"]["statement"] += " Alternative."
            resolution_path.write_bytes(pipeline.yaml_bytes(second_resolution))
            with patch.object(pipeline, "_integrated_validate"):
                second = pipeline.generate_candidate(ROOT, result.draft_dir)
            self.assertNotEqual(first.candidate_id, second.candidate_id)
            self.assertNotEqual(first.candidate_dir, second.candidate_dir)
            self.assertEqual(first.candidate_path.read_bytes(), original)

    def test_same_candidate_id_with_changed_content_is_collision(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as output_dir:
            result, candidate = self.candidate_for(ROOT, Path(output_dir))
            candidate.candidate_path.write_bytes(candidate.candidate_path.read_bytes() + b"\n")
            with patch.object(pipeline, "_integrated_validate"):
                with self.assertRaises(pipeline.PipelineError) as raised:
                    pipeline.generate_candidate(ROOT, result.draft_dir)
            self.assertEqual(raised.exception.code, "CANDIDATE_ID_COLLISION")

    def test_finalize_cli_requires_explicit_candidate_selection(self) -> None:
        with self.assertRaises(SystemExit):
            cli.parser(ROOT).parse_args(
                ["finalize", "--draft-dir", "draft", "--explicit-finalize"]
            )

    def test_finalize_rejects_candidate_id_path_mismatch(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as output_dir:
            result, candidate = self.candidate_for(ROOT, Path(output_dir))
            with self.assertRaises(pipeline.PipelineError) as raised:
                pipeline.finalize_candidate(
                    ROOT,
                    result.draft_dir,
                    candidate_id="candidate." + "0" * 64,
                    explicit_finalize=True,
                )
            self.assertEqual(raised.exception.code, "CANDIDATE_SELECTION_INVALID")

    def test_candidate_projection_uses_schema_version_field(self) -> None:
        with tempfile.TemporaryDirectory() as output_dir:
            result = self.generate(Path(output_dir))
            resolution_hash = pipeline.human_resolution_hash(self.resolution_for(result))
            _candidate_id, _hash, projection = pipeline._candidate_identity(
                result.draft, resolution_hash
            )
            self.assertEqual(
                set(projection),
                {
                    "source_draft_id",
                    "source_draft_identity_hash",
                    "human_resolution_hash",
                    "candidate_schema_version",
                    "generator_version",
                },
            )

    def test_candidate_schema_rejects_non_semver_generator(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as output_dir:
            _result, candidate = self.candidate_for(ROOT, Path(output_dir))
            invalid = copy.deepcopy(candidate.wrapper)
            invalid["generator_version"] = "not-semver"
            with self.assertRaises(pipeline.PipelineError) as raised:
                pipeline._validate_candidate_schema(ROOT, invalid)
            self.assertEqual(raised.exception.code, "CANDIDATE_SCHEMA_INVALID")

    def test_candidate_and_finalize_receipts_bind_same_three_hashes(self) -> None:
        with tempfile.TemporaryDirectory(dir=Path.home()) as output_dir, tempfile.TemporaryDirectory() as project_dir:
            result, candidate = self.candidate_for(ROOT, Path(output_dir))
            project_root = self.temporary_project(project_dir)
            with patch.object(pipeline, "_integrated_validate"), patch.object(
                pipeline.subprocess,
                "run",
                return_value=self.successful_validator_process(),
            ):
                finalized = pipeline.finalize_candidate(
                    project_root,
                    result.draft_dir,
                    candidate_id=candidate.candidate_id,
                    explicit_finalize=True,
                )
            first = candidate.receipt["payload"]["candidate_identity"]
            second = finalized.receipt["payload"]["candidate_identity"]
            for key in (
                "candidate_wrapper_artifact_hash_v1",
                "canonical_assertion_artifact_hash_v1",
                "assertion_content_v1_hash",
            ):
                self.assertEqual(first[key], second[key])

    def test_existing_evidence_full_observation_hash_collision_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as project_dir, tempfile.TemporaryDirectory(dir=Path.home()) as output_dir:
            project_root = self.temporary_project(project_dir)
            observation = project_root / "experiments" / "bridge" / "BRG-009-A" / "observation.json"
            result = pipeline.generate_draft(
                project_root, [(observation, "pose")], output_root=Path(output_dir)
            )
            staged = next(
                item
                for item in result.draft["staged_evidence"]
                if item["canonical_fact"]["metric"].endswith(
                    "primary_morphology_counts.lying_arch"
                )
            )
            other = project_root / "experiments" / "bridge" / "OTHER" / "observation.json"
            other.parent.mkdir(parents=True)
            changed = pipeline._load_json(observation)
            changed["run_id"] = "OTHER"
            other.write_bytes(pipeline.json_bytes(changed))
            existing = copy.deepcopy(staged["canonical_fact"])
            existing["observation_path"] = other.relative_to(project_root.parent.parent).as_posix()
            (project_root / "knowledge" / "assertions" / "collision-fixture.yaml").write_bytes(
                pipeline.yaml_bytes({"evidence_refs": [existing]})
            )
            (result.draft_dir / "human-resolution.yaml").write_bytes(
                pipeline.yaml_bytes(self.resolution_for(result))
            )
            with patch.object(pipeline, "_integrated_validate"):
                with self.assertRaises(pipeline.PipelineError) as raised:
                    pipeline.generate_candidate(project_root, result.draft_dir)
            self.assertEqual(raised.exception.code, "EVIDENCE_ID_COLLISION")

    def test_deprecated_used_module_is_incompatible(self) -> None:
        with tempfile.TemporaryDirectory() as project_dir, tempfile.TemporaryDirectory(dir=Path.home()) as output_dir:
            project_root = self.temporary_project(project_dir)
            result, candidate = self.candidate_for(project_root, Path(output_dir))
            registry_path = project_root / "knowledge" / "registries" / "observation-modules.yaml"
            registry = pipeline._load_yaml(registry_path)
            next(item for item in registry["modules"] if item["slug"] == "pose")["status"] = "deprecated"
            registry_path.write_bytes(pipeline.yaml_bytes(registry))
            compatibility = pipeline.check_registry_compatibility(project_root, result.draft_dir)
            self.assertEqual(compatibility.classification, "incompatible")
            pose = next(
                item
                for item in compatibility.receipt["payload"]["module_results"]
                if item["canonical_module_slug"] == "pose"
            )
            self.assertEqual(pose["current_status"], "deprecated")
            with self.assertRaises(pipeline.PipelineError) as raised:
                pipeline.generate_candidate(project_root, result.draft_dir)
            self.assertEqual(raised.exception.code, "DRAFT_REGISTRY_INCOMPATIBLE")
            with self.assertRaises(pipeline.PipelineError) as finalize_raised:
                pipeline.finalize_candidate(
                    project_root,
                    result.draft_dir,
                    candidate_id=candidate.candidate_id,
                    explicit_finalize=True,
                )
            self.assertEqual(
                finalize_raised.exception.code, "DRAFT_REGISTRY_INCOMPATIBLE"
            )

    def test_module_registry_is_not_loaded_as_claim_yaml(self) -> None:
        documents = load_current_documents(ROOT / "knowledge")
        paths = set(documents)
        self.assertFalse(any(path.endswith("knowledge/registries/observation-modules.yaml") for path in paths))


if __name__ == "__main__":
    unittest.main()
