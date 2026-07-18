from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import evidence_evaluation as evaluation  # noqa: E402


RULE_ID = "evidence_rule.fixture.contact"
RUN_ID = "BRG-TEST-A"


def condition(region: str, *states: str) -> dict:
    return {"region": region, "allowed_states": list(states)}


def rule(
    branch: str,
    *conditions: dict,
    rule_id: str = RULE_ID,
    prerequisite_values: tuple[str, ...] = ("supporting",),
    fallback_values: tuple[str, ...] = ("unclear",),
) -> dict:
    return {
        "rule_id": rule_id,
        "visibility_prerequisite": {branch: list(conditions)},
        "observation_values_requiring_prerequisite": list(prerequisite_values),
        "insufficient_visibility_policy": {
            "allowed_fallback_values": list(fallback_values),
        },
    }


def rule_set(*rules: dict) -> dict:
    return {"rule_set_id": "fixture", "rules": list(rules)}


def panel(panel_id: int = 1, **regions: str) -> dict:
    return {
        "panel_id": panel_id,
        "visibility_status": "available",
        "visible_regions": regions,
    }


def metadata(*panels: dict, run_id: str = RUN_ID, available: bool = True) -> dict:
    return {
        "run_id": run_id,
        "visibility_status": "available" if available else "unavailable",
        "panels": list(panels),
    }


def succeeded_binding(
    *allowed_values: str,
    policy: evaluation.PolicyEvaluationStatus = evaluation.PolicyEvaluationStatus.NO_VIOLATION,
) -> evaluation.RubricBindingResult:
    values = allowed_values or ("supporting", "unclear")
    return evaluation.RubricBindingResult(
        status=evaluation.RubricBindingStatus.SUCCEEDED,
        allowed_values=tuple(values),
        policy_status=policy,
    )


def failed_binding() -> evaluation.RubricBindingResult:
    return evaluation.RubricBindingResult(
        status=evaluation.RubricBindingStatus.FAILED,
    )


class EvidenceEvaluationTests(unittest.TestCase):
    def evaluate(
        self,
        value: dict,
        artifact: dict | None,
        *,
        observed_value: str | None = "supporting",
        binding: evaluation.RubricBindingResult | None = None,
        rules: tuple[dict, ...] | None = None,
        selected_rule_id: str = RULE_ID,
    ) -> evaluation.EvidenceEvaluation:
        return evaluation.evaluate_evidence_rule(
            rule_set(*(rules or (value,))),
            artifact,
            rule_id=selected_rule_id,
            run_id=RUN_ID,
            panel_id=1,
            observed_value=observed_value,
            rubric_binding=binding or succeeded_binding(),
        )

    def test_condition_explicit_states_are_evaluable(self) -> None:
        for state, expected in (
            ("visible", evaluation.EvaluationStatus.SATISFIED),
            ("partial", evaluation.EvaluationStatus.SATISFIED),
            ("unclear", evaluation.EvaluationStatus.UNSATISFIED),
            ("not_visible", evaluation.EvaluationStatus.UNSATISFIED),
        ):
            with self.subTest(state=state):
                result = self.evaluate(
                    rule("all_of", condition("hands", "visible", "partial")),
                    metadata(panel(hands=state)),
                )
                self.assertEqual(expected, result.visibility.status)
                self.assertEqual(state, result.visibility.conditions[0].actual_state)

    def test_explicit_not_visible_can_satisfy_a_declared_rule(self) -> None:
        result = self.evaluate(
            rule("all_of", condition("hands", "not_visible")),
            metadata(panel(hands="not_visible")),
        )
        self.assertEqual(evaluation.EvaluationStatus.SATISFIED, result.visibility.status)

    def test_missing_region_is_not_evaluated_not_not_visible(self) -> None:
        result = self.evaluate(
            rule("all_of", condition("hands", "not_visible")),
            metadata(panel(feet="partial")),
        )
        self.assertEqual(evaluation.EvaluationStatus.NOT_EVALUATED, result.visibility.status)
        self.assertIsNone(result.visibility.conditions[0].actual_state)

    def test_unsupported_metadata_state_is_not_evaluated(self) -> None:
        result = self.evaluate(
            rule("all_of", condition("hands", "visible")),
            metadata(panel(hands="mostly_visible")),
        )
        self.assertEqual(evaluation.EvaluationStatus.NOT_EVALUATED, result.visibility.status)
        self.assertIsNone(result.visibility.conditions[0].actual_state)

    def test_all_of_truth_table(self) -> None:
        cases = (
            (metadata(panel(hands="visible", feet="visible")), evaluation.EvaluationStatus.SATISFIED),
            (metadata(panel(hands="partial", feet="visible")), evaluation.EvaluationStatus.UNSATISFIED),
            (metadata(panel(hands="visible")), evaluation.EvaluationStatus.NOT_EVALUATED),
        )
        value = rule("all_of", condition("hands", "visible"), condition("feet", "visible"))
        for artifact, expected in cases:
            with self.subTest(expected=expected):
                self.assertEqual(expected, self.evaluate(value, artifact).visibility.status)

    def test_any_of_truth_table(self) -> None:
        cases = (
            (metadata(panel(hands="visible", feet="partial")), evaluation.EvaluationStatus.SATISFIED),
            (metadata(panel(hands="partial", feet="partial")), evaluation.EvaluationStatus.UNSATISFIED),
            (metadata(panel(hands="partial")), evaluation.EvaluationStatus.NOT_EVALUATED),
        )
        value = rule("any_of", condition("hands", "visible"), condition("feet", "visible"))
        for artifact, expected in cases:
            with self.subTest(expected=expected):
                self.assertEqual(expected, self.evaluate(value, artifact).visibility.status)

    def test_all_conditions_are_reported_in_stable_region_order(self) -> None:
        first = rule("any_of", condition("hands", "visible"), condition("arms", "visible"))
        second = rule("any_of", condition("arms", "visible"), condition("hands", "visible"))
        artifact = metadata(panel(hands="visible"))
        first_result = self.evaluate(first, artifact)
        second_result = self.evaluate(second, artifact)
        self.assertEqual(first_result, second_result)
        self.assertEqual(
            ["arms", "hands"],
            [item.region for item in first_result.visibility.conditions],
        )

    def assert_rule_invalid_before_evaluation(self, invalid_rule: dict) -> None:
        with mock.patch.object(
            evaluation,
            "_evaluate_visibility_prerequisite",
            wraps=evaluation._evaluate_visibility_prerequisite,
        ) as condition_evaluator:
            result = self.evaluate(invalid_rule, metadata(panel(hands="visible")))
        condition_evaluator.assert_not_called()
        self.assertEqual(evaluation.EvaluationStatus.NOT_EVALUATED, result.visibility.status)
        self.assertEqual((), result.visibility.conditions)
        self.assertEqual(evaluation.OverclaimStatus.NOT_EVALUATED, result.overclaim.status)
        self.assertTrue(result.diagnostics)
        self.assertEqual(
            {evaluation.EVIDENCE_RULE_INVALID},
            {item.code for item in result.diagnostics},
        )

    def test_duplicate_region_stops_before_condition_evaluation(self) -> None:
        self.assert_rule_invalid_before_evaluation(
            rule(
                "all_of",
                condition("hands", "visible"),
                condition("hands", "partial"),
            )
        )

    def test_cross_array_overlap_stops_before_condition_evaluation(self) -> None:
        self.assert_rule_invalid_before_evaluation(
            rule(
                "all_of",
                condition("hands", "visible"),
                prerequisite_values=("supporting", "unclear"),
                fallback_values=("unclear",),
            )
        )

    def test_duplicate_rule_id_with_different_content_stops_evaluation(self) -> None:
        first = rule("all_of", condition("hands", "visible"))
        second = rule("all_of", condition("feet", "visible"))
        with mock.patch.object(
            evaluation,
            "_evaluate_visibility_prerequisite",
            wraps=evaluation._evaluate_visibility_prerequisite,
        ) as condition_evaluator:
            result = self.evaluate(first, metadata(panel(hands="visible")), rules=(first, second))
        condition_evaluator.assert_not_called()
        self.assertEqual(evaluation.EvaluationStatus.NOT_EVALUATED, result.visibility.status)
        self.assertEqual(evaluation.OverclaimStatus.NOT_EVALUATED, result.overclaim.status)
        self.assertEqual(
            {evaluation.EVIDENCE_RULE_INVALID},
            {item.code for item in result.diagnostics},
        )

    def test_invalid_or_empty_branch_stops_before_condition_evaluation(self) -> None:
        for prerequisite in ({}, {"all_of": []}, {"all_of": [], "any_of": []}):
            with self.subTest(prerequisite=prerequisite):
                invalid = rule("all_of", condition("hands", "visible"))
                invalid["visibility_prerequisite"] = prerequisite
                self.assert_rule_invalid_before_evaluation(invalid)

        self.assert_rule_invalid_before_evaluation(
            rule("all_of", condition("hands", "mostly_visible"))
        )

    def test_exact_run_and_unique_panel_binding(self) -> None:
        value = rule("all_of", condition("hands", "visible"))
        self.assertEqual(
            evaluation.EvaluationStatus.SATISFIED,
            self.evaluate(value, metadata(panel(hands="visible"))).visibility.status,
        )
        for artifact, reason in (
            (metadata(panel(hands="visible"), run_id="OTHER"), "run_binding_failed"),
            (metadata(panel(2, hands="visible")), "panel_binding_failed"),
            (metadata(panel(hands="visible"), panel(hands="visible")), "panel_binding_ambiguous"),
        ):
            with self.subTest(reason=reason):
                result = self.evaluate(value, artifact)
                self.assertEqual(evaluation.EvaluationStatus.NOT_EVALUATED, result.visibility.status)
                self.assertEqual(reason, result.visibility.not_evaluated_reason)
                self.assertEqual(evaluation.OverclaimStatus.NOT_EVALUATED, result.overclaim.status)

    def test_unavailable_root_or_panel_is_not_evaluated(self) -> None:
        value = rule("all_of", condition("hands", "visible"))
        unavailable_panel = panel(hands="visible")
        unavailable_panel["visibility_status"] = "unavailable"
        cases = (
            (None, "visibility_metadata_missing"),
            (metadata(panel(hands="visible"), available=False), "visibility_root_unavailable"),
            (metadata(unavailable_panel), "visibility_panel_unavailable"),
        )
        for artifact, reason in cases:
            with self.subTest(reason=reason):
                result = self.evaluate(value, artifact)
                self.assertEqual(evaluation.EvaluationStatus.NOT_EVALUATED, result.visibility.status)
                self.assertEqual(reason, result.visibility.not_evaluated_reason)

    def test_evaluation_does_not_mutate_inputs(self) -> None:
        value = rule("all_of", condition("hands", "visible"))
        rules = rule_set(value)
        artifact = metadata(panel(hands="visible"))
        binding = succeeded_binding()
        before_rules = copy.deepcopy(rules)
        before_artifact = copy.deepcopy(artifact)
        result = evaluation.evaluate_evidence_rule(
            rules,
            artifact,
            rule_id=RULE_ID,
            run_id=RUN_ID,
            panel_id=1,
            observed_value="supporting",
            rubric_binding=binding,
        )
        self.assertEqual(evaluation.EvaluationStatus.SATISFIED, result.visibility.status)
        self.assertEqual(before_rules, rules)
        self.assertEqual(before_artifact, artifact)

    def test_satisfied_visibility_with_clear_policy_is_no_violation(self) -> None:
        result = self.evaluate(
            rule("all_of", condition("hands", "visible")),
            metadata(panel(hands="visible")),
        )
        self.assertEqual(evaluation.OverclaimStatus.NO_VIOLATION, result.overclaim.status)
        self.assertEqual((), result.diagnostics)

    def test_unsatisfied_visibility_with_allowed_fallback_is_no_violation(self) -> None:
        result = self.evaluate(
            rule("all_of", condition("hands", "visible")),
            metadata(panel(hands="partial")),
            observed_value="unclear",
        )
        self.assertEqual(evaluation.OverclaimStatus.NO_VIOLATION, result.overclaim.status)

    def test_confirmed_assertive_overclaim_has_error_then_warning(self) -> None:
        result = self.evaluate(
            rule("all_of", condition("hands", "visible")),
            metadata(panel(hands="partial")),
            binding=succeeded_binding(
                "supporting",
                "unclear",
                policy=evaluation.PolicyEvaluationStatus.VIOLATION,
            ),
        )
        self.assertEqual(evaluation.OverclaimStatus.VIOLATION, result.overclaim.status)
        self.assertEqual(
            [evaluation.EVIDENCE_OBSERVATION_OVERCLAIM, evaluation.EVIDENCE_VISIBILITY_INSUFFICIENT],
            [item.code for item in result.diagnostics],
        )
        self.assertEqual(
            [evaluation.Severity.ERROR, evaluation.Severity.WARNING],
            [item.severity for item in result.diagnostics],
        )

    def test_missing_or_invalid_observation_value_is_not_evaluated(self) -> None:
        value = rule("all_of", condition("hands", "visible"))
        artifact = metadata(panel(hands="visible"))
        missing = self.evaluate(value, artifact, observed_value=None)
        self.assertEqual(evaluation.OverclaimStatus.NOT_EVALUATED, missing.overclaim.status)
        self.assertEqual((), missing.diagnostics)

        invalid = self.evaluate(value, artifact, observed_value="invented")
        self.assertEqual(evaluation.OverclaimStatus.NOT_EVALUATED, invalid.overclaim.status)
        self.assertEqual(evaluation.EVIDENCE_RUBRIC_MAPPING_INVALID, invalid.diagnostics[0].code)

    def test_failed_rubric_binding_preserves_visibility(self) -> None:
        result = self.evaluate(
            rule("all_of", condition("hands", "visible")),
            metadata(panel(hands="visible")),
            binding=failed_binding(),
        )
        self.assertEqual(evaluation.EvaluationStatus.SATISFIED, result.visibility.status)
        self.assertEqual(evaluation.OverclaimStatus.NOT_EVALUATED, result.overclaim.status)
        self.assertEqual(evaluation.EVIDENCE_RUBRIC_MAPPING_INVALID, result.diagnostics[0].code)

    def test_invalid_rubric_binding_combinations_are_not_evaluated(self) -> None:
        invalid_bindings = (
            evaluation.RubricBindingResult(
                status=evaluation.RubricBindingStatus.SUCCEEDED,
                allowed_values=None,
                policy_status=evaluation.PolicyEvaluationStatus.NO_VIOLATION,
            ),
            evaluation.RubricBindingResult(
                status=evaluation.RubricBindingStatus.FAILED,
                allowed_values=("supporting",),
            ),
            evaluation.RubricBindingResult(
                status=evaluation.RubricBindingStatus.FAILED,
                policy_status=evaluation.PolicyEvaluationStatus.NOT_EVALUATED,
            ),
            evaluation.RubricBindingResult(
                status=evaluation.RubricBindingStatus.SUCCEEDED,
                allowed_values=(),
                policy_status=evaluation.PolicyEvaluationStatus.NO_VIOLATION,
            ),
            evaluation.RubricBindingResult(
                status=evaluation.RubricBindingStatus.SUCCEEDED,
                allowed_values=("supporting", "supporting"),
                policy_status=evaluation.PolicyEvaluationStatus.NO_VIOLATION,
            ),
            evaluation.RubricBindingResult(
                status=evaluation.RubricBindingStatus.SUCCEEDED,
                allowed_values=("supporting",),
                policy_status="no_violation",  # type: ignore[arg-type]
            ),
        )
        value = rule("all_of", condition("hands", "visible"))
        artifact = metadata(panel(hands="visible"))
        for binding in invalid_bindings:
            with self.subTest(binding=binding):
                result = self.evaluate(value, artifact, binding=binding)
                self.assertEqual(evaluation.EvaluationStatus.SATISFIED, result.visibility.status)
                self.assertEqual(evaluation.OverclaimStatus.NOT_EVALUATED, result.overclaim.status)
                self.assertEqual(
                    evaluation.EVIDENCE_RUBRIC_MAPPING_INVALID,
                    result.diagnostics[0].code,
                )

    def test_policy_not_evaluated_is_normal_unavailable_state(self) -> None:
        result = self.evaluate(
            rule("all_of", condition("hands", "visible")),
            metadata(panel(hands="visible")),
            binding=succeeded_binding(
                policy=evaluation.PolicyEvaluationStatus.NOT_EVALUATED,
            ),
        )
        self.assertEqual(evaluation.EvaluationStatus.SATISFIED, result.visibility.status)
        self.assertEqual(evaluation.OverclaimStatus.NOT_EVALUATED, result.overclaim.status)
        self.assertEqual(evaluation.EVIDENCE_RUBRIC_MAPPING_INVALID, result.diagnostics[0].code)

    def test_result_contract_has_one_diagnostic_source(self) -> None:
        result = self.evaluate(
            rule("all_of", condition("hands", "visible")),
            metadata(panel(hands="visible")),
        )
        self.assertIsInstance(result, evaluation.EvidenceEvaluation)
        self.assertIsInstance(result.visibility, evaluation.VisibilityEvaluation)
        self.assertIsInstance(result.overclaim, evaluation.OverclaimEvaluation)
        self.assertIsInstance(result.diagnostics, tuple)
        self.assertFalse(hasattr(result.visibility, "diagnostics"))
        self.assertFalse(hasattr(result.overclaim, "diagnostics"))

    def test_internal_evaluators_are_not_public_legacy_entry_points(self) -> None:
        self.assertFalse(hasattr(evaluation, "evaluate_visibility_prerequisite"))
        self.assertFalse(hasattr(evaluation, "evaluate_overclaim"))
        self.assertTrue(callable(evaluation.evaluate_evidence_rule))


if __name__ == "__main__":
    unittest.main()
