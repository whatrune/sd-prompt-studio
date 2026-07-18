#!/usr/bin/env python3
"""Pure Evidence Rule evaluation for the PR85 v0.1.0 contract.

``evaluate_evidence_rule`` is the only public evaluation entry point.  It
validates the supplied Rule Set and selected Rule before evaluating any
Visibility Condition, so a validation result cannot be reused for a different
or subsequently modified Rule Set.

The module consumes an already-resolved ``RubricBindingResult``.  It performs
no file I/O, Rubric path or hash resolution, natural-language Evidence Policy
interpretation, Observation mutation, external Diagnostic emission, or result
persistence.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Mapping, Sequence


EVIDENCE_RULE_INVALID = "EVIDENCE_RULE_INVALID"
EVIDENCE_RUBRIC_MAPPING_INVALID = "EVIDENCE_RUBRIC_MAPPING_INVALID"
EVIDENCE_OBSERVATION_OVERCLAIM = "EVIDENCE_OBSERVATION_OVERCLAIM"
EVIDENCE_VISIBILITY_INSUFFICIENT = "EVIDENCE_VISIBILITY_INSUFFICIENT"

DIAGNOSTIC_PRIORITY = {
    EVIDENCE_RULE_INVALID: 0,
    EVIDENCE_RUBRIC_MAPPING_INVALID: 1,
    EVIDENCE_OBSERVATION_OVERCLAIM: 2,
    EVIDENCE_VISIBILITY_INSUFFICIENT: 3,
}

VISIBILITY_STATES = frozenset({"visible", "partial", "unclear", "not_visible"})


class EvaluationStatus(str, Enum):
    SATISFIED = "satisfied"
    UNSATISFIED = "unsatisfied"
    NOT_EVALUATED = "not_evaluated"


class OverclaimStatus(str, Enum):
    VIOLATION = "violation"
    NO_VIOLATION = "no_violation"
    NOT_EVALUATED = "not_evaluated"


class PolicyEvaluationStatus(str, Enum):
    """Result supplied by a separately contracted Evidence Policy evaluator."""

    VIOLATION = "violation"
    NO_VIOLATION = "no_violation"
    NOT_EVALUATED = "not_evaluated"


class RubricBindingStatus(str, Enum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class Severity(str, Enum):
    ERROR = "error"
    WARNING = "warning"


@dataclass(frozen=True)
class Diagnostic:
    code: str
    severity: Severity
    message: str


@dataclass(frozen=True)
class ConditionEvaluation:
    region: str
    status: EvaluationStatus
    actual_state: str | None


@dataclass(frozen=True)
class VisibilityEvaluation:
    status: EvaluationStatus
    conditions: tuple[ConditionEvaluation, ...]
    not_evaluated_reason: str | None = None


@dataclass(frozen=True)
class OverclaimEvaluation:
    status: OverclaimStatus
    not_evaluated_reason: str | None = None


@dataclass(frozen=True)
class RubricBindingResult:
    """Closed input supplied by a Rubric resolver outside PR86.

    ``succeeded`` requires nonempty, unique ``allowed_values`` and a Policy
    status.  ``failed`` forbids both fields because neither result is available.
    """

    status: RubricBindingStatus
    allowed_values: tuple[str, ...] | None = None
    policy_status: PolicyEvaluationStatus | None = None


@dataclass(frozen=True)
class EvidenceEvaluation:
    """Canonical result returned by :func:`evaluate_evidence_rule`.

    Diagnostics live only at this level so nested evaluation results cannot
    disagree with the aggregate result.
    """

    visibility: VisibilityEvaluation
    overclaim: OverclaimEvaluation
    diagnostics: tuple[Diagnostic, ...]


@dataclass(frozen=True)
class _RuleSetValidationResult:
    rule: Mapping[str, Any] | None
    diagnostics: tuple[Diagnostic, ...]


def _diagnostic(code: str, message: str) -> Diagnostic:
    severity = (
        Severity.WARNING
        if code == EVIDENCE_VISIBILITY_INSUFFICIENT
        else Severity.ERROR
    )
    return Diagnostic(code=code, severity=severity, message=message)


def _ordered_diagnostics(*items: Diagnostic) -> tuple[Diagnostic, ...]:
    unique: dict[tuple[str, str], Diagnostic] = {}
    for item in items:
        unique[(item.code, item.message)] = item
    return tuple(
        sorted(
            unique.values(),
            key=lambda item: (DIAGNOSTIC_PRIORITY.get(item.code, 99), item.message),
        )
    )


def _rule_diagnostic(message: str) -> Diagnostic:
    return _diagnostic(EVIDENCE_RULE_INVALID, message)


def _condition_list(
    rule: Mapping[str, Any],
) -> tuple[str, Sequence[Mapping[str, Any]]] | None:
    prerequisite = rule.get("visibility_prerequisite")
    if not isinstance(prerequisite, Mapping):
        return None
    present = [name for name in ("all_of", "any_of") if name in prerequisite]
    if len(present) != 1:
        return None
    branch = present[0]
    conditions = prerequisite[branch]
    if (
        not isinstance(conditions, Sequence)
        or isinstance(conditions, (str, bytes))
        or not conditions
        or not all(isinstance(item, Mapping) for item in conditions)
    ):
        return None
    return branch, conditions


def _string_values(value: Any, field_name: str) -> tuple[tuple[str, ...] | None, str | None]:
    if (
        not isinstance(value, Sequence)
        or isinstance(value, (str, bytes))
        or not value
        or not all(isinstance(item, str) and item for item in value)
    ):
        return None, f"{field_name} must be a nonempty string array"
    values = tuple(value)
    if len(set(values)) != len(values):
        return None, f"{field_name} contains duplicate values"
    return values, None


def _validate_regions(conditions: Sequence[Mapping[str, Any]]) -> str | None:
    regions: set[str] = set()
    for condition in conditions:
        region = condition.get("region")
        allowed_states = condition.get("allowed_states")
        if not isinstance(region, str) or not region:
            return "Condition region is missing or invalid"
        if region in regions:
            return f"Region '{region}' is defined more than once"
        regions.add(region)
        states, error = _string_values(allowed_states, f"Region '{region}' allowed_states")
        if error:
            return error
        if not set(states or ()).issubset(VISIBILITY_STATES):
            return f"Region '{region}' has an unsupported visibility State"
    return None


def _validate_rule_semantics(rule: Mapping[str, Any]) -> tuple[Diagnostic, ...]:
    diagnostics: list[Diagnostic] = []
    rule_id = rule.get("rule_id")
    if not isinstance(rule_id, str) or not rule_id:
        diagnostics.append(_rule_diagnostic("Rule has a missing or invalid rule_id"))

    parsed = _condition_list(rule)
    if parsed is None:
        diagnostics.append(
            _rule_diagnostic(
                "visibility_prerequisite must contain exactly one nonempty branch"
            )
        )
    else:
        _, conditions = parsed
        region_error = _validate_regions(conditions)
        if region_error:
            diagnostics.append(_rule_diagnostic(region_error))

    prerequisite_values, prerequisite_error = _string_values(
        rule.get("observation_values_requiring_prerequisite"),
        "observation_values_requiring_prerequisite",
    )
    if prerequisite_error:
        diagnostics.append(_rule_diagnostic(prerequisite_error))

    policy = rule.get("insufficient_visibility_policy")
    fallback_values: tuple[str, ...] | None = None
    if not isinstance(policy, Mapping):
        diagnostics.append(
            _rule_diagnostic("insufficient_visibility_policy is missing or invalid")
        )
    else:
        fallback_values, fallback_error = _string_values(
            policy.get("allowed_fallback_values"),
            "allowed_fallback_values",
        )
        if fallback_error:
            diagnostics.append(_rule_diagnostic(fallback_error))

    if prerequisite_values is not None and fallback_values is not None:
        overlap = set(prerequisite_values).intersection(fallback_values)
        if overlap:
            diagnostics.append(
                _rule_diagnostic(
                    "Rule values overlap prerequisite and fallback sets: "
                    + ", ".join(sorted(overlap))
                )
            )
    return _ordered_diagnostics(*diagnostics)


def _validate_rule_set_semantics(
    rule_set: Mapping[str, Any],
    *,
    rule_id: str,
) -> _RuleSetValidationResult:
    rules = rule_set.get("rules") if isinstance(rule_set, Mapping) else None
    if (
        not isinstance(rules, Sequence)
        or isinstance(rules, (str, bytes))
        or not rules
        or not all(isinstance(item, Mapping) for item in rules)
    ):
        return _RuleSetValidationResult(
            rule=None,
            diagnostics=(_rule_diagnostic("Rule Set rules must be a nonempty Rule array"),),
        )

    diagnostics: list[Diagnostic] = []
    by_id: dict[str, Mapping[str, Any]] = {}
    for rule in rules:
        current_id = rule.get("rule_id")
        if isinstance(current_id, str) and current_id in by_id:
            qualifier = "different content" if by_id[current_id] != rule else "duplicate content"
            diagnostics.append(
                _rule_diagnostic(
                    f"rule_id '{current_id}' is defined more than once with {qualifier}"
                )
            )
        elif isinstance(current_id, str):
            by_id[current_id] = rule
        diagnostics.extend(_validate_rule_semantics(rule))

    selected = by_id.get(rule_id)
    if selected is None:
        diagnostics.append(_rule_diagnostic(f"rule_id '{rule_id}' was not found uniquely"))
    if diagnostics:
        return _RuleSetValidationResult(
            rule=None,
            diagnostics=_ordered_diagnostics(*diagnostics),
        )
    return _RuleSetValidationResult(rule=selected, diagnostics=())


def _bind_available_panel(
    metadata: Mapping[str, Any] | None,
    *,
    run_id: str,
    panel_id: int,
) -> tuple[Mapping[str, Any] | None, str | None]:
    if metadata is None:
        return None, "visibility_metadata_missing"
    if metadata.get("run_id") != run_id:
        return None, "run_binding_failed"
    if metadata.get("visibility_status") != "available":
        return None, "visibility_root_unavailable"
    panels = metadata.get("panels")
    if not isinstance(panels, Sequence) or isinstance(panels, (str, bytes)):
        return None, "panel_binding_failed"
    matches = [
        panel
        for panel in panels
        if isinstance(panel, Mapping) and panel.get("panel_id") == panel_id
    ]
    if len(matches) != 1:
        return None, "panel_binding_ambiguous" if matches else "panel_binding_failed"
    panel = matches[0]
    if panel.get("visibility_status") != "available":
        return None, "visibility_panel_unavailable"
    return panel, None


def _aggregate(
    branch: str,
    conditions: Sequence[ConditionEvaluation],
) -> EvaluationStatus:
    statuses = {item.status for item in conditions}
    if branch == "all_of":
        if EvaluationStatus.UNSATISFIED in statuses:
            return EvaluationStatus.UNSATISFIED
        if statuses == {EvaluationStatus.SATISFIED}:
            return EvaluationStatus.SATISFIED
        return EvaluationStatus.NOT_EVALUATED
    if EvaluationStatus.SATISFIED in statuses:
        return EvaluationStatus.SATISFIED
    if statuses == {EvaluationStatus.UNSATISFIED}:
        return EvaluationStatus.UNSATISFIED
    return EvaluationStatus.NOT_EVALUATED


def _evaluate_visibility_prerequisite(
    rule: Mapping[str, Any],
    metadata: Mapping[str, Any] | None,
    *,
    run_id: str,
    panel_id: int,
) -> VisibilityEvaluation:
    """Evaluate a semantically valid Rule against one exactly bound Panel."""

    parsed = _condition_list(rule)
    if parsed is None:  # The public entry point makes this unreachable.
        raise ValueError("Rule must be validated before Condition evaluation")
    branch, conditions = parsed
    panel, binding_reason = _bind_available_panel(
        metadata,
        run_id=run_id,
        panel_id=panel_id,
    )
    if panel is None:
        results = tuple(
            ConditionEvaluation(
                region=str(condition["region"]),
                status=EvaluationStatus.NOT_EVALUATED,
                actual_state=None,
            )
            for condition in sorted(conditions, key=lambda item: str(item["region"]))
        )
        return VisibilityEvaluation(
            status=EvaluationStatus.NOT_EVALUATED,
            conditions=results,
            not_evaluated_reason=binding_reason,
        )

    visible_regions = panel.get("visible_regions")
    if not isinstance(visible_regions, Mapping):
        visible_regions = {}

    results: list[ConditionEvaluation] = []
    for condition in conditions:
        region = str(condition["region"])
        actual_state = visible_regions.get(region)
        if not isinstance(actual_state, str) or actual_state not in VISIBILITY_STATES:
            status = EvaluationStatus.NOT_EVALUATED
            actual_state = None
        elif actual_state in condition["allowed_states"]:
            status = EvaluationStatus.SATISFIED
        else:
            status = EvaluationStatus.UNSATISFIED
        results.append(
            ConditionEvaluation(
                region=region,
                status=status,
                actual_state=actual_state,
            )
        )

    ordered = tuple(sorted(results, key=lambda item: item.region))
    aggregate = _aggregate(branch, ordered)
    reason = "required_region_missing" if aggregate is EvaluationStatus.NOT_EVALUATED else None
    return VisibilityEvaluation(
        status=aggregate,
        conditions=ordered,
        not_evaluated_reason=reason,
    )


def _rubric_binding_error(binding: RubricBindingResult) -> str | None:
    if not isinstance(binding, RubricBindingResult):
        return "Rubric binding input has an invalid type"
    if binding.status is RubricBindingStatus.FAILED:
        if binding.allowed_values is not None or binding.policy_status is not None:
            return "Failed Rubric binding must not provide values or Policy status"
        return "Rubric binding failed"
    if binding.status is not RubricBindingStatus.SUCCEEDED:
        return "Rubric binding status is invalid"
    if not isinstance(binding.allowed_values, tuple):
        return "Successful Rubric binding requires immutable allowed_values"
    values, values_error = _string_values(binding.allowed_values, "rubric_allowed_values")
    if values_error:
        return values_error
    if values is None or not isinstance(
        binding.policy_status,
        PolicyEvaluationStatus,
    ):
        return "Successful Rubric binding requires a Policy evaluation status"
    return None


def _evaluate_overclaim(
    visibility: VisibilityEvaluation,
    *,
    observed_value: str | None,
    prerequisite_values: Sequence[str],
    fallback_values: Sequence[str],
    rubric_binding: RubricBindingResult,
) -> tuple[OverclaimEvaluation, tuple[Diagnostic, ...]]:
    """Combine resolved inputs without interpreting a Rubric Policy."""

    if observed_value is None:
        return (
            OverclaimEvaluation(
                status=OverclaimStatus.NOT_EVALUATED,
                not_evaluated_reason="observation_value_missing",
            ),
            (),
        )
    if visibility.status is EvaluationStatus.NOT_EVALUATED:
        return (
            OverclaimEvaluation(
                status=OverclaimStatus.NOT_EVALUATED,
                not_evaluated_reason="visibility_not_evaluated",
            ),
            (),
        )

    binding_error = _rubric_binding_error(rubric_binding)
    if binding_error:
        return _mapping_failure(binding_error)

    allowed_values = rubric_binding.allowed_values or ()
    if observed_value not in allowed_values:
        return _mapping_failure("Observed value is not declared by the Rubric axis")
    if rubric_binding.policy_status is PolicyEvaluationStatus.NOT_EVALUATED:
        return _mapping_failure("Rubric Evidence Policy is not machine-evaluable")

    in_prerequisite = observed_value in prerequisite_values
    in_fallback = observed_value in fallback_values

    if visibility.status is EvaluationStatus.SATISFIED:
        if rubric_binding.policy_status is PolicyEvaluationStatus.NO_VIOLATION:
            return OverclaimEvaluation(status=OverclaimStatus.NO_VIOLATION), ()
        return _mapping_failure("Policy result conflicts with satisfied visibility")

    if in_fallback:
        if rubric_binding.policy_status is PolicyEvaluationStatus.NO_VIOLATION:
            return OverclaimEvaluation(status=OverclaimStatus.NO_VIOLATION), ()
        return _mapping_failure("Policy result conflicts with an allowed fallback value")

    if (
        in_prerequisite
        and rubric_binding.policy_status is PolicyEvaluationStatus.VIOLATION
    ):
        diagnostics = _ordered_diagnostics(
            _diagnostic(
                EVIDENCE_OBSERVATION_OVERCLAIM,
                "Observation value exceeds its confirmed evidence boundary",
            ),
            _diagnostic(
                EVIDENCE_VISIBILITY_INSUFFICIENT,
                "Visibility prerequisite is unsatisfied for the Observation value",
            ),
        )
        return OverclaimEvaluation(status=OverclaimStatus.VIOLATION), diagnostics

    return _mapping_failure("Rule, value, and Policy result do not form a defined evaluation case")


def _mapping_failure(
    message: str,
) -> tuple[OverclaimEvaluation, tuple[Diagnostic, ...]]:
    return (
        OverclaimEvaluation(
            status=OverclaimStatus.NOT_EVALUATED,
            not_evaluated_reason="rubric_mapping_invalid",
        ),
        (_diagnostic(EVIDENCE_RUBRIC_MAPPING_INVALID, message),),
    )


def _invalid_evaluation(diagnostics: tuple[Diagnostic, ...]) -> EvidenceEvaluation:
    return EvidenceEvaluation(
        visibility=VisibilityEvaluation(
            status=EvaluationStatus.NOT_EVALUATED,
            conditions=(),
            not_evaluated_reason="rule_invalid",
        ),
        overclaim=OverclaimEvaluation(
            status=OverclaimStatus.NOT_EVALUATED,
            not_evaluated_reason="rule_invalid",
        ),
        diagnostics=diagnostics,
    )


def evaluate_evidence_rule(
    rule_set: Mapping[str, Any],
    metadata: Mapping[str, Any] | None,
    *,
    rule_id: str,
    run_id: str,
    panel_id: int,
    observed_value: str | None,
    rubric_binding: RubricBindingResult,
) -> EvidenceEvaluation:
    """Validate and evaluate one Rule without mutating or persisting inputs.

    Rule Set and Rule semantic checks always complete before the internal
    Condition evaluator runs.  Rubric resolution remains an upstream concern;
    this function validates only the closed ``RubricBindingResult`` supplied to
    it and preserves an independently calculated Visibility status when Rubric
    binding or Policy evaluation cannot complete.
    """

    validation = _validate_rule_set_semantics(rule_set, rule_id=rule_id)
    if validation.diagnostics or validation.rule is None:
        diagnostics = validation.diagnostics or (
            _rule_diagnostic("Rule Set validation did not select a Rule"),
        )
        return _invalid_evaluation(diagnostics)

    rule = validation.rule
    visibility = _evaluate_visibility_prerequisite(
        rule,
        metadata,
        run_id=run_id,
        panel_id=panel_id,
    )
    policy = rule["insufficient_visibility_policy"]
    overclaim, diagnostics = _evaluate_overclaim(
        visibility,
        observed_value=observed_value,
        prerequisite_values=rule["observation_values_requiring_prerequisite"],
        fallback_values=policy["allowed_fallback_values"],
        rubric_binding=rubric_binding,
    )
    return EvidenceEvaluation(
        visibility=visibility,
        overclaim=overclaim,
        diagnostics=diagnostics,
    )
