"""Tests for the Processor framework and core processors."""

from __future__ import annotations

import pytest

from conduit.engine.processors.base import BaseProcessor, ProcessorMeta, processor
from conduit.engine.processors.registry import ProcessorRegistry


# ─── Framework Tests ────────────────────────────────────────────────


class TestBaseProcessor:
    """Test the BaseProcessor ABC and decorator."""

    def test_processor_decorator_sets_meta(self):
        @processor(type="test_proc", name="Test", category="core", description="A test")
        class TestProc(BaseProcessor):
            def process(self, records):
                return records

        assert hasattr(TestProc, "meta")
        assert TestProc.meta.type == "test_proc"
        assert TestProc.meta.name == "Test"
        assert TestProc.meta.category == "core"

    def test_processor_meta_to_dict(self):
        meta = ProcessorMeta(type="x", name="X", category="core", description="desc")
        d = meta.to_dict()
        assert d["type"] == "x"
        assert d["description"] == "desc"

    def test_processor_init_with_config(self):
        @processor(type="cfg", name="Cfg", category="core")
        class CfgProc(BaseProcessor):
            def process(self, records):
                return records

        p = CfgProc({"key": "value"})
        assert p._config["key"] == "value"

    def test_processor_init_without_config(self):
        @processor(type="no_cfg", name="NoCfg", category="core")
        class NoCfgProc(BaseProcessor):
            def process(self, records):
                return records

        p = NoCfgProc()
        assert p._config == {}


class TestProcessorRegistry:
    """Test the ProcessorRegistry auto-discovery."""

    def setup_method(self):
        ProcessorRegistry.reset()

    def test_discover_finds_processors(self):
        ProcessorRegistry.discover()
        all_meta = ProcessorRegistry.list_all()
        # Should find our 8 core processors
        assert len(all_meta) >= 8, f"Expected >= 8 processors, got {len(all_meta)}"

    def test_get_existing_processor(self):
        ProcessorRegistry.discover()
        cls = ProcessorRegistry.get("filter")
        assert issubclass(cls, BaseProcessor)

    def test_get_unknown_raises(self):
        ProcessorRegistry.discover()
        with pytest.raises(KeyError, match="Unknown processor"):
            ProcessorRegistry.get("nonexistent")

    def test_create_processor(self):
        ProcessorRegistry.discover()
        p = ProcessorRegistry.create("filter", {"column": "x", "operator": "eq", "value": 1})
        assert isinstance(p, BaseProcessor)

    def test_list_all_returns_meta(self):
        ProcessorRegistry.discover()
        all_meta = ProcessorRegistry.list_all()
        types = {m.type for m in all_meta}
        assert "filter" in types
        assert "rename" in types
        assert "sort" in types


# ─── Core Processor Tests ───────────────────────────────────────────


class TestFilterProcessor:
    def _make(self, **config):
        ProcessorRegistry.discover()
        return ProcessorRegistry.create("filter", config)

    def test_filter_eq(self):
        p = self._make(column="status", operator="eq", value="active")
        result = p.process([
            {"id": 1, "status": "active"},
            {"id": 2, "status": "inactive"},
            {"id": 3, "status": "active"},
        ])
        assert len(result) == 2
        assert all(r["status"] == "active" for r in result)

    def test_filter_gt(self):
        p = self._make(column="age", operator="gt", value=25)
        result = p.process([
            {"name": "A", "age": 20},
            {"name": "B", "age": 30},
            {"name": "C", "age": 25},
        ])
        assert len(result) == 1
        assert result[0]["name"] == "B"

    def test_filter_is_null(self):
        p = self._make(column="email", operator="is_null")
        result = p.process([
            {"name": "A", "email": "a@b.com"},
            {"name": "B", "email": None},
        ])
        assert len(result) == 1
        assert result[0]["name"] == "B"

    def test_filter_contains(self):
        p = self._make(column="name", operator="contains", value="oh")
        result = p.process([
            {"name": "John"},
            {"name": "Jane"},
        ])
        assert len(result) == 1
        assert result[0]["name"] == "John"

    def test_filter_invalid_operator(self):
        p = self._make(column="x", operator="INVALID")
        with pytest.raises(ValueError, match="Unknown operator"):
            p.process([{"x": 1}])


class TestRenameProcessor:
    def _make(self, **config):
        ProcessorRegistry.discover()
        return ProcessorRegistry.create("rename", config)

    def test_rename_columns(self):
        p = self._make(mapping={"old_name": "new_name", "foo": "bar"})
        result = p.process([{"old_name": 1, "foo": 2, "keep": 3}])
        assert result == [{"new_name": 1, "bar": 2, "keep": 3}]

    def test_rename_no_mapping_raises(self):
        p = self._make()
        with pytest.raises(ValueError, match="requires 'mapping'"):
            p.process([])


class TestDropProcessor:
    def _make(self, **config):
        ProcessorRegistry.discover()
        return ProcessorRegistry.create("drop", config)

    def test_drop_columns(self):
        p = self._make(columns=["secret", "temp"])
        result = p.process([
            {"id": 1, "name": "A", "secret": "x", "temp": "y"},
        ])
        assert result == [{"id": 1, "name": "A"}]

    def test_drop_missing_column_is_safe(self):
        p = self._make(columns=["nonexistent"])
        result = p.process([{"id": 1}])
        assert result == [{"id": 1}]


class TestCastProcessor:
    def _make(self, **config):
        ProcessorRegistry.discover()
        return ProcessorRegistry.create("cast", config)

    def test_cast_to_int(self):
        p = self._make(columns={"age": "int"})
        result = p.process([{"age": "25"}])
        assert result[0]["age"] == 25

    def test_cast_to_bool(self):
        p = self._make(columns={"active": "bool"})
        result = p.process([{"active": "true"}, {"active": "no"}])
        assert result[0]["active"] is True
        assert result[1]["active"] is False

    def test_cast_preserves_none(self):
        p = self._make(columns={"x": "int"})
        result = p.process([{"x": None}])
        assert result[0]["x"] is None

    def test_cast_invalid_type_raises(self):
        p = self._make(columns={"x": "unknown_type"})
        with pytest.raises(ValueError, match="Unknown type"):
            p.process([{"x": 1}])


class TestSortProcessor:
    def _make(self, **config):
        ProcessorRegistry.discover()
        return ProcessorRegistry.create("sort", config)

    def test_sort_ascending(self):
        p = self._make(by=["age"])
        result = p.process([
            {"name": "C", "age": 30},
            {"name": "A", "age": 10},
            {"name": "B", "age": 20},
        ])
        assert [r["name"] for r in result] == ["A", "B", "C"]

    def test_sort_descending(self):
        p = self._make(by=["age"], descending=True)
        result = p.process([
            {"name": "A", "age": 10},
            {"name": "C", "age": 30},
        ])
        assert result[0]["name"] == "C"


class TestDeduplicateProcessor:
    def _make(self, **config):
        ProcessorRegistry.discover()
        return ProcessorRegistry.create("deduplicate", config)

    def test_deduplicate_all_columns(self):
        p = self._make()
        result = p.process([
            {"a": 1, "b": 2},
            {"a": 1, "b": 2},
            {"a": 3, "b": 4},
        ])
        assert len(result) == 2

    def test_deduplicate_by_column(self):
        p = self._make(columns=["email"])
        result = p.process([
            {"name": "A", "email": "x@y.com"},
            {"name": "B", "email": "x@y.com"},
            {"name": "C", "email": "z@y.com"},
        ])
        assert len(result) == 2
        assert result[0]["name"] == "A"

    def test_deduplicate_keep_last(self):
        p = self._make(columns=["email"], keep="last")
        result = p.process([
            {"name": "A", "email": "x@y.com"},
            {"name": "B", "email": "x@y.com"},
        ])
        assert result[0]["name"] == "B"


class TestFillNullsProcessor:
    def _make(self, **config):
        ProcessorRegistry.discover()
        return ProcessorRegistry.create("fill_nulls", config)

    def test_fill_with_value(self):
        p = self._make(columns=["score"], strategy="value", value=0)
        result = p.process([
            {"name": "A", "score": None},
            {"name": "B", "score": 85},
        ])
        assert result[0]["score"] == 0
        assert result[1]["score"] == 85

    def test_fill_forward(self):
        p = self._make(columns=["val"], strategy="forward")
        result = p.process([
            {"val": 10},
            {"val": None},
            {"val": None},
            {"val": 20},
        ])
        assert [r["val"] for r in result] == [10, 10, 10, 20]

    def test_fill_backward(self):
        p = self._make(columns=["val"], strategy="backward")
        result = p.process([
            {"val": None},
            {"val": None},
            {"val": 30},
        ])
        assert [r["val"] for r in result] == [30, 30, 30]


class TestMapProcessor:
    def _make(self, **config):
        ProcessorRegistry.discover()
        return ProcessorRegistry.create("map", config)

    def test_map_upper(self):
        p = self._make(column="name", function="upper")
        result = p.process([{"name": "hello"}, {"name": "world"}])
        assert result[0]["name"] == "HELLO"
        assert result[1]["name"] == "WORLD"

    def test_map_to_target_column(self):
        p = self._make(column="name", function="upper", target="name_upper")
        result = p.process([{"name": "hello"}])
        assert result[0]["name"] == "hello"
        assert result[0]["name_upper"] == "HELLO"

    def test_map_preserves_none(self):
        p = self._make(column="name", function="upper")
        result = p.process([{"name": None}])
        assert result[0]["name"] is None

    def test_map_invalid_function(self):
        p = self._make(column="x", function="INVALID")
        with pytest.raises(ValueError, match="Unknown function"):
            p.process([{"x": 1}])

    def test_map_missing_column_is_safe(self):
        p = self._make(column="nonexistent", function="upper")
        result = p.process([{"name": "hello"}])
        assert result == [{"name": "hello"}]

    def test_map_missing_column_config_raises(self):
        p = self._make(function="upper")
        with pytest.raises(ValueError, match="requires 'column'"):
            p.process([{"x": 1}])


# ─── Additional Coverage Tests ──────────────────────────────────────


class TestFillNullsCoverage:
    """Extra tests to cover mean, median, mode strategies and validation."""

    def _make(self, **config):
        ProcessorRegistry.discover()
        return ProcessorRegistry.create("fill_nulls", config)

    def test_fill_mean(self):
        p = self._make(columns=["score"], strategy="mean")
        result = p.process([
            {"score": 10},
            {"score": None},
            {"score": 30},
        ])
        assert result[1]["score"] == 20.0

    def test_fill_median_odd(self):
        p = self._make(columns=["val"], strategy="median")
        result = p.process([
            {"val": 10},
            {"val": None},
            {"val": 30},
            {"val": 20},
        ])
        assert result[1]["val"] == 20

    def test_fill_median_even(self):
        p = self._make(columns=["val"], strategy="median")
        result = p.process([
            {"val": 10},
            {"val": None},
            {"val": 20},
        ])
        assert result[1]["val"] == 15.0

    def test_fill_mode(self):
        p = self._make(columns=["color"], strategy="mode")
        result = p.process([
            {"color": "red"},
            {"color": "blue"},
            {"color": "red"},
            {"color": None},
        ])
        assert result[3]["color"] == "red"

    def test_fill_missing_columns_raises(self):
        p = self._make(strategy="value", value=0)
        with pytest.raises(ValueError, match="requires 'columns'"):
            p.process([{"x": 1}])

    def test_fill_invalid_strategy_raises(self):
        p = self._make(columns=["x"], strategy="INVALID")
        with pytest.raises(ValueError, match="Unknown strategy"):
            p.process([{"x": None}])

    def test_fill_mean_no_numeric_values(self):
        p = self._make(columns=["name"], strategy="mean")
        result = p.process([
            {"name": "Alice"},
            {"name": None},
        ])
        # No numeric values, so null stays None (fill_with_value fallback)
        assert result[1]["name"] is None


class TestSortCoverage:
    """Extra tests for sort validation and mixed-type fallback."""

    def _make(self, **config):
        ProcessorRegistry.discover()
        return ProcessorRegistry.create("sort", config)

    def test_sort_missing_by_raises(self):
        p = self._make()
        with pytest.raises(ValueError, match="requires 'by'"):
            p.process([{"x": 1}])

    def test_sort_mixed_types_fallback(self):
        p = self._make(by=["val"])
        result = p.process([
            {"val": "hello"},
            {"val": None},
            {"val": 42},
        ])
        # Should not crash — uses string fallback
        assert len(result) == 3

    def test_sort_multi_column(self):
        p = self._make(by=["group", "score"])
        result = p.process([
            {"group": "B", "score": 2},
            {"group": "A", "score": 3},
            {"group": "A", "score": 1},
        ])
        assert result[0]["group"] == "A"
        assert result[0]["score"] == 1
        assert result[1]["score"] == 3


class TestCastCoverage:
    """Extra tests for cast failure handling and edge cases."""

    def _make(self, **config):
        ProcessorRegistry.discover()
        return ProcessorRegistry.create("cast", config)

    def test_cast_failure_keeps_original(self):
        p = self._make(columns={"age": "int"})
        result = p.process([{"age": "not_a_number"}])
        # Should keep original value on cast failure
        assert result[0]["age"] == "not_a_number"

    def test_cast_missing_columns_raises(self):
        p = self._make()
        with pytest.raises(ValueError, match="requires 'columns'"):
            p.process([{"x": 1}])

    def test_cast_to_float(self):
        p = self._make(columns={"price": "float"})
        result = p.process([{"price": "19.99"}])
        assert result[0]["price"] == 19.99

    def test_cast_to_string(self):
        p = self._make(columns={"id": "string"})
        result = p.process([{"id": 42}])
        assert result[0]["id"] == "42"


class TestDropCoverage:
    def _make(self, **config):
        ProcessorRegistry.discover()
        return ProcessorRegistry.create("drop", config)

    def test_drop_missing_config_raises(self):
        p = self._make()
        with pytest.raises(ValueError, match="requires 'columns'"):
            p.process([{"x": 1}])


class TestFilterCoverage:
    def _make(self, **config):
        ProcessorRegistry.discover()
        return ProcessorRegistry.create("filter", config)

    def test_filter_missing_column_config_raises(self):
        p = self._make(operator="eq", value=1)
        with pytest.raises(ValueError, match="requires 'column'"):
            p.process([{"x": 1}])

    def test_filter_in_operator(self):
        p = self._make(column="status", operator="in", value=["active", "pending"])
        result = p.process([
            {"status": "active"},
            {"status": "inactive"},
            {"status": "pending"},
        ])
        assert len(result) == 2

    def test_filter_not_in_operator(self):
        p = self._make(column="x", operator="not_in", value=[1, 2])
        result = p.process([{"x": 1}, {"x": 3}])
        assert len(result) == 1
        assert result[0]["x"] == 3

    def test_filter_is_not_null(self):
        p = self._make(column="val", operator="is_not_null")
        result = p.process([{"val": None}, {"val": 5}])
        assert len(result) == 1


class TestRegistryCoverage:
    def test_double_discover_is_noop(self):
        ProcessorRegistry.reset()
        ProcessorRegistry.discover()
        count1 = len(ProcessorRegistry.list_all())
        ProcessorRegistry.discover()
        count2 = len(ProcessorRegistry.list_all())
        assert count1 == count2

    def test_discover_with_missing_impl_dir(self, tmp_path, monkeypatch):
        """Covers the branch where impl/ dir doesn't exist."""
        ProcessorRegistry.reset()
        import conduit.engine.processors.registry as reg_mod
        original_file = reg_mod.__file__

        # Point __file__ to a temp dir with no impl/ subdirectory
        fake_registry = tmp_path / "registry.py"
        fake_registry.touch()
        monkeypatch.setattr(reg_mod, "__file__", str(fake_registry))

        ProcessorRegistry.discover()
        # Should succeed but find nothing (and set _discovered = True)
        assert ProcessorRegistry._discovered is True

        # Restore
        monkeypatch.setattr(reg_mod, "__file__", original_file)
        ProcessorRegistry.reset()

    def test_discover_handles_import_error(self, tmp_path, monkeypatch):
        """Covers the exception branch when a module fails to import."""
        ProcessorRegistry.reset()
        import conduit.engine.processors.registry as reg_mod

        # Create a fake impl dir with a broken module
        impl_dir = tmp_path / "impl"
        impl_dir.mkdir()
        broken = impl_dir / "broken_module.py"
        broken.write_text("raise RuntimeError('intentional break')")

        fake_registry = tmp_path / "registry.py"
        fake_registry.touch()
        monkeypatch.setattr(reg_mod, "__file__", str(fake_registry))

        # Should not crash — just logs the error
        ProcessorRegistry.discover()
        assert ProcessorRegistry._discovered is True

        ProcessorRegistry.reset()

