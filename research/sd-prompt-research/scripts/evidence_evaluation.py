#!/usr/bin/env python3
"""Pure Evidence Rule evaluation for the PR85 v0.1.0 contract.

The module evaluates already-structured inputs.  It deliberately performs no
file I/O, Rubric natural-language interpretation, Observation mutation,
Diagnostic emission, or result persistence.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Collection, Mapping, Sequence


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
    diagnostics: tuple[Diagnostic, ...] = ()
    not_evaluated_reason: str | None = None


@dataclass(frozen=True)
class OverclaimEvaluation:
    status: OverclaimStatus
    diagnostics: tuple[Diagnostic, ...] = ()
    not_evaluated_reason: str | None = None


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


def _condition_list(rule: Mapping[str, Any]) -> tuple[str, Sequence[Mapping[str, Any]]] | None:
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


def _rule_error(message: str) -> VisibilityEvaluation:
    return VisibilityEvaluation(
        status=EvaluationStatus.NOT_EVALUATED,
        conditions=(),
        diagnostics=(_diagnostic(EVIDENCE_RULE_INVALID, message),),
        not_evaluated_reason="rule_invalid",
    )


def _validate_regions(conditions: Sequence[Mapping[str, Any]]) -> str | None:
    regions: set[str] = set()
    for condition in conditions:
        region = condition.get("region")
        allowed_states = condition.get("allowed_states")
        if not isinstance(region, str):
            return "Condition region is missing or invalid"
        if region in regions:
            return f"Region '{region}' is defined more than once"
        regions.add(region)
        if (
            not isinstance(allowed_states, Sequence)
            or isinstance(allowed_states, (str, bytes))
            or not allowed_states
            or not all(isinstance(state, str) for state in allowed_states)
        ):
            return f"Region '{region}' has invalid allowed_states"
        if not set(allowed_states).issubset(VISIBILITY_STATES):
            return f"Region '{region}' has an unsupported visibility State"
    return None


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


def evaluate_visibility_prerequisite(
    rule: Mapping[str, Any],
    metadata: Mapping[str, Any] | None,
    *,
    run_id: str,
    panel_id: int,
) -> VisibilityEvaluation:
    """Evaluate one PR84 Rule against one exactly bound Panel.

    Inputs are not mutated.  Structural Schema validation remains an upstream
    prerequisite; defensive shape checks return EVIDENCE_RULE_INVALID.
    """

    parsed = _condition_list(rule)
    if parsed is None:
        return _rule_error("visibility_prerequisite must contain exactly one nonempty branch")
    branch, conditions = parsed
    region_error = _validate_regions(conditions)
    if region_error:
        return _rule_error(region_error)

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


def evaluate_overclaim(
    visibility: VisibilityEvaluation,
    *,
    observed_value: str | None,
    rubric_allowed_values: Collection[str] | None,
    prerequisite_values: Collection[str],
    fallback_values: Collection[str],
    rubric_binding_succeeded: bool,
    policy_status: PolicyEvaluationStatus,
) -> OverclaimEvaluation:
    """Combine pre-evaluated inputs without interpreting a Rubric Policy.

    Combinations not defined by the Freeze contract remain not_evaluated.  The
    function never guesses policy meaning or modifies an Observation.
    """

    if any(item.code == EVIDENCE_RULE_INVALID for item in visibility.diagnostics):
        return OverclaimEvaluation(
            status=OverclaimStatus.NOT_EVALUATED,
            diagnostics=visibility.diagnostics,
            not_evaluated_reason="rule_invalid",
        )

    overlap = set(prerequisite_values).intersection(fallback_values)
    if overlap:
        message = "Rule values overlap prerequisite and fallback sets: " + ", ".join(sorted(overlap))
        return OverclaimEvaluation(
            status=OverclaimStatus.NOT_EVALUATED,
            diagnostics=(_diagnostic(EVIDENCE_RULE_INVALID, message),),
            not_evaluated_reason="rule_invalid",
        )

    if observed_value is None:
        return OverclaimEvaluation(
            status=OverclaimStatus.NOT_EVALUATED,
            not_evaluated_reason="observation_value_missing",
        )
    if visibility.status is EvaluationStatus.NOT_EVALUATED:
        return OverclaimEvaluation(
            status=OverclaimStatus.NOT_EVALUATED,
            diagnostics=visibility.diagnostics,
            not_evaluated_reason="visibility_not_evaluated",
        )
    if not rubric_binding_succeeded or rubric_allowed_values is None:
        return _mapping_failure("Rubric binding failed")
    if observed_value not in rubric_allowed_values:
        return _mapping_failure("Observed value is not declared by the Rubric axis")
    if policy_status is PolicyEvaluationStatus.NOT_EVALUATED:
        return _mapping_failure("Rubric Evidence Policy is not machine-evaluable")

    in_prerequisite = observed_value in prerequisite_values
    in_fallback = observed_value in fallback_values

    if visibility.status is EvaluationStatus.SATISFIED:
        if policy_status is PolicyEvaluationStatus.NO_VIOLATION:
            return OverclaimEvaluation(status=OverclaimStatus.NO_VIOLATION)
        return _mapping_failure("Policy result conflicts with satisfied visibility")

    if in_fallback:
        if policy_status is PolicyEvaluationStatus.NO_VIOLATION:
            return OverclaimEvaluation(status=OverclaimStatus.NO_VIOLATION)
        return _mapping_failure("Policy result conflicts with an allowed fallback value")

    if in_prerequisite and policy_status is PolicyEvaluationStatus.VIOLATION:
        return OverclaimEvaluation(
            status=OverclaimStatus.VIOLATION,
            diagnostics=_ordered_diagnostics(
                _diagnostic(
                    EVIDENCE_OBSERVATION_OVERCLAIM,
                    "Observation value exceeds its confirmed evidence boundary",
                ),
                _diagnostic(
                    EVIDENCE_VISIBILITY_INSUFFICIENT,
                    "Visibility prerequisite is unsatisfied for the Observation value",
                ),
            ),
        )

    return _mapping_failure("Rule, value, and Policy result do not form a defined evaluation case")


def _mapping_failure(message: str) -> OverclaimEvaluation:
    return OverclaimEvaluation(
        status=OverclaimStatus.NOT_EVALUATED,
        diagnostics=(_diagnostic(EVIDENCE_RUBRIC_MAPPING_INVALID, message),),
        not_evaluated_reason="rubric_mapping_invalid",
    )
