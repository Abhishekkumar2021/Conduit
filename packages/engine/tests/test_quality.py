"""
Tests for conduit.engine.quality.scorer — verify scoring logic.
"""

from conduit.engine.quality.scorer import QualityScorer


class TestQualityScorer:
    def setup_method(self):
        self.rules = [
            {"column": "email", "check": "not_null", "weight": 30},
            {
                "column": "email",
                "check": "matches",
                "pattern": r"^.+@.+\..+$",
                "weight": 30,
            },
            {
                "column": "amount",
                "check": "range",
                "min": 0,
                "max": 1000000,
                "weight": 20,
            },
            {
                "column": "country",
                "check": "in_set",
                "values": ["US", "GB", "IN"],
                "weight": 20,
            },
        ]
        self.scorer = QualityScorer(self.rules, pass_threshold=70)

    def test_perfect_record_passes(self):
        record = {"email": "user@example.com", "amount": 500, "country": "US"}
        result = self.scorer.score(record)
        assert result.score == 100
        assert result.passed is True
        assert result.failed_rules == []

    def test_null_email_fails(self):
        record = {"email": None, "amount": 500, "country": "US"}
        result = self.scorer.score(record)
        assert result.score < 100
        assert not result.passed  # loses 30 + 30 = 60 weight
        assert any(r.column == "email" for r in result.failed_rules)

    def test_invalid_country_reduces_score(self):
        record = {"email": "user@example.com", "amount": 500, "country": "FR"}
        result = self.scorer.score(record)
        assert result.score == 80  # 80/100 weight earned
        assert result.passed is True  # still above 70 threshold

    def test_amount_out_of_range(self):
        record = {"email": "user@example.com", "amount": -100, "country": "US"}
        result = self.scorer.score(record)
        assert result.score == 80

    def test_batch_scoring(self):
        records = [
            {"email": "good@test.com", "amount": 100, "country": "US"},
            {"email": None, "amount": -1, "country": "XX"},
            {"email": "ok@test.com", "amount": 500, "country": "GB"},
        ]
        passed, quarantined = self.scorer.score_batch(records)
        assert len(passed) == 2
        assert len(quarantined) == 1
        assert quarantined[0].record["email"] is None

    def test_empty_rules_gives_100(self):
        scorer = QualityScorer([], pass_threshold=70)
        result = scorer.score({"anything": "goes"})
        assert result.score == 100
        assert result.passed is True
