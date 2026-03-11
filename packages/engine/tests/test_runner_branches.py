"""Additional branch coverage for conduit.engine.core.runner.LocalRunner."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from conduit.engine.core.graph import Graph, Node
from conduit.engine.core.runner import LocalRunner


def _one_node_graph(node: Node) -> Graph:
    return Graph(nodes=[node], edges=[])


def test_run_handles_failure_and_still_cleans_up():
    bad_extract = Node(id="n1", key="n1", label="Extract", kind="extract", config={})
    runner = LocalRunner(graph=_one_node_graph(bad_extract), integration_configs={})
    runner._cleanup_sessions = MagicMock()

    with pytest.raises(ValueError, match="missing integration_id"):
        runner.run()

    runner._cleanup_sessions.assert_called_once()


def test_cleanup_sessions_ignores_close_errors():
    runner = LocalRunner(graph=Graph(nodes=[], edges=[]), integration_configs={})

    bad_session = MagicMock()
    bad_session.__exit__.side_effect = RuntimeError("close failed")
    good_session = MagicMock()
    runner._active_sessions = [good_session, bad_session]

    runner._cleanup_sessions()
    assert runner._active_sessions == []
    good_session.__exit__.assert_called_once()
    bad_session.__exit__.assert_called_once()


def test_handle_extract_requires_asset():
    node = Node(
        id="n1",
        key="n1",
        label="Extract",
        kind="postgresql_extract",
        integration_id="int1",
        config={},  # missing asset
    )
    runner = LocalRunner(graph=_one_node_graph(node), integration_configs={"int1": {}})

    mock_adapter = MagicMock()
    mock_session = MagicMock()
    mock_adapter.session.return_value = mock_session

    with patch(
        "conduit.engine.core.runner.AdapterRegistry.create", return_value=mock_adapter
    ):
        with pytest.raises(ValueError, match="missing asset"):
            runner._handle_extract(node)


def test_handle_transform_requires_inputs_and_stream():
    no_input = Node(id="t1", key="t1", label="T1", kind="transform", inputs=[])
    runner = LocalRunner(graph=Graph(nodes=[no_input], edges=[]), integration_configs={})
    with pytest.raises(ValueError, match="has no inputs"):
        runner._handle_transform(no_input)

    with_input = Node(id="t2", key="t2", label="T2", kind="transform", inputs=["src"])
    with pytest.raises(ValueError, match="not found"):
        runner._handle_transform(with_input)


def test_handle_load_requires_inputs_stream_and_integration():
    runner = LocalRunner(graph=Graph(nodes=[], edges=[]), integration_configs={})

    no_input = Node(id="l1", key="l1", label="L1", kind="load", inputs=[])
    with pytest.raises(ValueError, match="has no inputs"):
        runner._handle_load(no_input)

    none_stream = Node(id="l2", key="l2", label="L2", kind="load", inputs=["src"])
    with pytest.raises(ValueError, match="is None"):
        runner._handle_load(none_stream)

    missing_integration = Node(
        id="l3",
        key="l3",
        label="L3",
        kind="load",
        inputs=["src"],
        integration_id=None,
        config={"asset": "public.tbl"},
    )
    runner._streams["src"] = iter([[{"id": 1}]])
    with pytest.raises(ValueError, match="missing integration_id"):
        runner._handle_load(missing_integration)


def test_apply_processor_passthrough_for_unknown_type():
    node = Node(id="t1", key="t1", label="T", kind="unknown_transform")
    runner = LocalRunner(graph=Graph(nodes=[node], edges=[]), integration_configs={})
    batch = [{"id": 1}]
    assert runner._apply_processor(node, batch) == batch

