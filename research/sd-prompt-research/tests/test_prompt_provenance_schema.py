from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "schemas" / "prompt-provenance.schema.json"
FORMAT_ONLY_SHA256 = "0" * 64


def manual_method() -> dict:
    return {"kind": "manual"}


def valid_phrase(channel: str = "positive", position: int = 1) -> dict:
    return {
        "phrase_occurrence_id": f"phrase.{channel}.{position:03d}",
        "text": "silver hair",
        "position": position,
        "source_span": {"start": 0, "end": 11},
        "extraction_method": manual_method(),
        "primary_category": "hair",
        "category_candidates": [],
        "category_assignment_source": manual_method(),
        "category_confidence": "high",
    }


def valid_prompt(channel: str = "positive") -> dict:
    pointer = f"/ingested_metadata/generation/{channel}_prompt"
    return {
        "prompt_channel": channel,
        "prompt_stage": "embedded_generation_metadata",
        "effective_input_status": "unconfirmed",
        "source": {
            "source_artifact": "manifest.yaml",
            "source_pointer": pointer,
            "source_kind": "embedded_png_metadata",
            # This fixture validates lexical form only. It is not a computed hash.
            "source_prompt_hash": FORMAT_ONLY_SHA256,
            "hash_contract_version": "prompt_text_sha256_v1",
        },
        "span_offset_unit": "unicode_code_point",
        "extraction_coverage": {"status": "complete"},
        "phrases": [valid_phrase(channel)],
    }


def valid_available() -> dict:
    return {
        "schema_version": "0.1.0",
        "run_id": "BRG-013-A",
        "status": "available",
        "content_identity": {
            "contract": "prompt_provenance_content_v1",
            # This fixture validates lexical form only. It is not a JCS result.
            "sha256": FORMAT_ONLY_SHA256,
        },
        "provenance_generation": {
            "created_at": "2026-07-17T12:00:00Z",
            "generator": {"kind": "manual"},
        },
        "prompts": [valid_prompt()],
    }


class PromptProvenanceSchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(cls.schema)
        cls.validator = Draft202012Validator(
            cls.schema,
            format_checker=FormatChecker(),
        )

    def assert_valid(self, value: dict) -> None:
        errors = sorted(self.validator.iter_errors(value), key=lambda item: list(item.path))
        self.assertEqual([], errors)

    def assert_invalid(self, value: dict) -> None:
        self.assertTrue(list(self.validator.iter_errors(value)))

    def test_schema_is_valid_draft_2020_12(self) -> None:
        self.assertEqual(
            "https://json-schema.org/draft/2020-12/schema",
            self.schema["$schema"],
        )

    def test_available_artifact_accepts_positive_and_negative(self) -> None:
        artifact = valid_available()
        negative = valid_prompt("negative")
        negative["phrases"] = []
        artifact["prompts"].append(negative)
        self.assert_valid(artifact)

    def test_empty_prompt_phrase_array_is_structurally_valid(self) -> None:
        artifact = valid_available()
        artifact["prompts"][0]["phrases"] = []
        self.assert_valid(artifact)

    def test_unavailable_artifact_is_valid_without_prompts(self) -> None:
        artifact = valid_available()
        artifact["status"] = "unavailable"
        artifact["unavailable_reason"] = "source_missing"
        artifact.pop("prompts")
        self.assert_valid(artifact)

    def test_available_requires_prompts_and_forbids_unavailable_reason(self) -> None:
        artifact = valid_available()
        artifact.pop("prompts")
        self.assert_invalid(artifact)

        artifact = valid_available()
        artifact["unavailable_reason"] = "source_missing"
        self.assert_invalid(artifact)

    def test_unavailable_requires_reason_and_forbids_prompts(self) -> None:
        artifact = valid_available()
        artifact["status"] = "unavailable"
        self.assert_invalid(artifact)

        artifact["unavailable_reason"] = "source_missing"
        self.assert_invalid(artifact)

    def test_unknown_root_and_nested_fields_are_rejected(self) -> None:
        artifact = valid_available()
        artifact["unexpected"] = True
        self.assert_invalid(artifact)

        artifact = valid_available()
        artifact["prompts"][0]["source"]["unexpected"] = True
        self.assert_invalid(artifact)

    def test_content_identity_contract_and_hash_form_are_fixed(self) -> None:
        artifact = valid_available()
        artifact["content_identity"]["contract"] = "other_contract"
        self.assert_invalid(artifact)

        artifact = valid_available()
        artifact["content_identity"]["sha256"] = "A" * 64
        self.assert_invalid(artifact)

    def test_generator_version_conditions(self) -> None:
        cases = [
            ({"kind": "manual"}, True),
            ({"kind": "manual", "version": "1.0.0"}, False),
            ({"kind": "parser", "version": "1.0.0"}, True),
            ({"kind": "parser"}, False),
            ({"kind": "imported", "version": "2.1.0"}, True),
            ({"kind": "migration", "version": "not-semver"}, False),
        ]
        for generator, expected in cases:
            with self.subTest(generator=generator):
                artifact = valid_available()
                artifact["provenance_generation"]["generator"] = generator
                if expected:
                    self.assert_valid(artifact)
                else:
                    self.assert_invalid(artifact)

    def test_annotation_method_version_conditions(self) -> None:
        cases = [
            ({"kind": "manual"}, True),
            ({"kind": "manual", "contract_version": "1.0.0"}, False),
            ({"kind": "parser", "contract_version": "1.0.0"}, True),
            ({"kind": "parser"}, False),
            ({"kind": "deterministic_rule", "contract_version": "0.1.0"}, True),
        ]
        for method, expected in cases:
            with self.subTest(method=method):
                artifact = valid_available()
                phrase = artifact["prompts"][0]["phrases"][0]
                phrase["extraction_method"] = method
                phrase["category_assignment_source"] = copy.deepcopy(method)
                if expected:
                    self.assert_valid(artifact)
                else:
                    self.assert_invalid(artifact)

    def test_complete_forbids_unparsed_spans(self) -> None:
        artifact = valid_available()
        artifact["prompts"][0]["extraction_coverage"]["unparsed_spans"] = []
        self.assert_invalid(artifact)

    def test_partial_requires_nonempty_unparsed_spans(self) -> None:
        artifact = valid_available()
        artifact["prompts"][0]["extraction_coverage"] = {
            "status": "partial",
            "unparsed_spans": [],
        }
        self.assert_invalid(artifact)

        artifact["prompts"][0]["extraction_coverage"]["unparsed_spans"] = [
            {"start": 12, "end": 17, "reason": "control_directive"}
        ]
        self.assert_valid(artifact)

    def test_invalid_id_category_hash_pointer_and_path_are_rejected(self) -> None:
        mutations = [
            ("phrase_occurrence_id", "concept.hair.silver"),
            ("primary_category", "concept_module"),
        ]
        for field, value in mutations:
            with self.subTest(field=field):
                artifact = valid_available()
                artifact["prompts"][0]["phrases"][0][field] = value
                self.assert_invalid(artifact)

        artifact = valid_available()
        artifact["prompts"][0]["source"]["source_prompt_hash"] = "short"
        self.assert_invalid(artifact)

        artifact = valid_available()
        artifact["prompts"][0]["source"]["source_pointer"] = "/bad~2pointer"
        self.assert_invalid(artifact)

        for source_artifact in (
            "../manifest.yaml",
            "/absolute/manifest.yaml",
            "C:/absolute/manifest.yaml",
            "C:relative-manifest.yaml",
            "\\\\server\\share\\manifest.yaml",
            "https://example.invalid/manifest.yaml",
        ):
            with self.subTest(source_artifact=source_artifact):
                artifact = valid_available()
                artifact["prompts"][0]["source"]["source_artifact"] = source_artifact
                self.assert_invalid(artifact)

    def test_schema_does_not_claim_semantic_validation(self) -> None:
        artifact = valid_available()
        artifact["prompts"].append(copy.deepcopy(artifact["prompts"][0]))
        # Duplicate channels are a documented future semantic error, not a
        # Structural Schema responsibility in PR81.
        self.assert_valid(artifact)


if __name__ == "__main__":
    unittest.main()
