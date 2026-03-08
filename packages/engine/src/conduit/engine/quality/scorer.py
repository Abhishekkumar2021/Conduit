"""
Conduit Engine — Quality scoring engine.

Scores individual records against user-defined rules.
Records above threshold pass downstream; below go to quarantine.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RuleResult:
    """Result of evaluating a single rule against a record."""

    rule_name: str
    column: str
    passed: bool
    weight: int
    message: str = ""


@dataclass(frozen=True)
class ScoredRecord:
    """A record with its quality score and rule evaluation results."""

    record: dict[str, Any]
    score: int  # 0-100
    passed: bool
    failed_rules: list[RuleResult]


class QualityScorer:
    """
    Scores records against a set of weighted rules.

    Rules are defined in gate stage config:
        {
            "rules": [
                {"column": "email", "check": "not_null", "weight": 30},
                {"column": "amount", "check": "range", "min": 0, "max": 1000000, "weight": 20}
            ],
            "pass_threshold": 70
        }
    """

    def __init__(self, rules: list[dict], pass_threshold: int = 70):
        self._rules = rules
        self._threshold = pass_threshold

    def score(self, record: dict[str, Any]) -> ScoredRecord:
        """Score a single record against all rules."""
        total_weight = sum(r.get("weight", 1) for r in self._rules)
        if total_weight == 0:
            return ScoredRecord(record=record, score=100, passed=True, failed_rules=[])

        earned = 0
        failed: list[RuleResult] = []

        for rule in self._rules:
            result = self._evaluate_rule(record, rule)
            if result.passed:
                earned += result.weight
            else:
                failed.append(result)

        score = round((earned / total_weight) * 100)
        return ScoredRecord(
            record=record,
            score=score,
            passed=score >= self._threshold,
            failed_rules=failed,
        )

    def score_batch(self, records: list[dict]) -> tuple[list[dict], list[ScoredRecord]]:
        """
        Score a batch of records.
        Returns (passed_records, quarantined_scored_records).
        """
        passed = []
        quarantined = []

        for record in records:
            result = self.score(record)
            if result.passed:
                passed.append(record)
            else:
                quarantined.append(result)

        return passed, quarantined

    def _evaluate_rule(self, record: dict, rule: dict) -> RuleResult:
        """Evaluate a single rule against a record."""
        column = rule.get("column", "")
        check = rule.get("check", "")
        weight = rule.get("weight", 1)
        value = record.get(column)

        match check:
            case "not_null":
                passed = value is not None and value != ""
                msg = "" if passed else f"'{column}' is null or empty"

            case "not_empty":
                passed = bool(value)
                msg = "" if passed else f"'{column}' is empty"

            case "range":
                min_val = rule.get("min", float("-inf"))
                max_val = rule.get("max", float("inf"))
                try:
                    passed = min_val <= float(value) <= max_val
                except (TypeError, ValueError):
                    passed = False
                msg = (
                    ""
                    if passed
                    else f"'{column}' value {value} not in [{min_val}, {max_val}]"
                )

            case "in_set":
                valid = set(rule.get("values", []))
                passed = value in valid
                msg = "" if passed else f"'{column}' value '{value}' not in allowed set"

            case "matches":
                import re

                pattern = rule.get("pattern", "")
                passed = bool(re.match(pattern, str(value or "")))
                msg = "" if passed else f"'{column}' does not match pattern '{pattern}'"

            case "type":
                expected = rule.get("expected", "string")
                type_map = {
                    "string": str,
                    "integer": int,
                    "float": float,
                    "boolean": bool,
                }
                passed = isinstance(value, type_map.get(expected, str))
                msg = "" if passed else f"'{column}' expected type {expected}"

            case _:
                passed = True
                msg = f"Unknown check type: {check}"

        return RuleResult(
            rule_name=check,
            column=column,
            passed=passed,
            weight=weight,
            message=msg,
        )
