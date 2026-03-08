"""Extra branch tests for conduit.engine.quality.scorer."""

from conduit.engine.quality.scorer import QualityScorer


def test_not_empty_rule_fails_on_empty_string():
    scorer = QualityScorer([{"column": "name", "check": "not_empty", "weight": 5}])
    result = scorer.score({"name": ""})
    assert result.passed is False
    assert result.failed_rules[0].rule_name == "not_empty"


def test_type_rule_integer_passes_and_fails():
    scorer = QualityScorer([{"column": "age", "check": "type", "expected": "integer"}])
    assert scorer.score({"age": 10}).passed is True
    assert scorer.score({"age": "10"}).passed is False


def test_range_rule_handles_non_numeric_values():
    scorer = QualityScorer(
        [{"column": "amount", "check": "range", "min": 0, "max": 100, "weight": 10}]
    )
    result = scorer.score({"amount": "not-a-number"})
    assert result.passed is False
    assert "not in [0, 100]" in result.failed_rules[0].message


def test_unknown_rule_type_is_treated_as_pass_with_message():
    scorer = QualityScorer([{"column": "x", "check": "mystery_check", "weight": 10}])
    result = scorer.score({"x": 1})
    assert result.passed is True
    # Unknown checks are currently non-blocking by design.
    assert result.failed_rules == []
