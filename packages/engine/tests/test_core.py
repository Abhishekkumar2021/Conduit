import pytest
from conduit.engine.core.graph import Node, Graph
from conduit.engine.core.runner import LocalRunner
from unittest.mock import MagicMock, patch


def test_graph_cycle_detection():
    n1 = Node(id="1", key="s1", label="Extract", kind="extract")
    n2 = Node(id="2", key="s2", label="Transform", kind="transform")

    # Cyclic edges
    edges = [{"source_id": "1", "target_id": "2"}, {"source_id": "2", "target_id": "1"}]

    graph = Graph([n1, n2], edges)
    assert graph.validate() is False
    with pytest.raises(ValueError, match="Cycle detected"):
        graph.topological_sort()


def test_topological_sort_linear():
    n1 = Node(id="1", key="s1", label="E", kind="extract")
    n2 = Node(id="2", key="s2", label="T", kind="transform")
    n3 = Node(id="3", key="s3", label="L", kind="load")

    edges = [{"source_id": "1", "target_id": "2"}, {"source_id": "2", "target_id": "3"}]

    graph = Graph([n1, n2, n3], edges)
    assert graph.topological_sort() == ["1", "2", "3"]


def test_graph_roots_and_leaves():
    n1 = Node(id="1", key="s1", label="E", kind="extract")
    n2 = Node(id="2", key="s2", label="L", kind="load")
    graph = Graph([n1, n2], [{"source_id": "1", "target_id": "2"}])
    assert graph.get_roots() == ["1"]
    assert graph.get_leaves() == ["2"]


def test_runner_basic_flow():
    # Mock adapters and registry
    n1 = Node(
        id="1",
        key="s1",
        label="E",
        kind="postgresql_extract",
        integration_id="int1",
        config={"asset": "users"},
    )
    n2 = Node(
        id="2",
        key="s2",
        label="L",
        kind="postgresql_load",
        integration_id="int2",
        config={"asset": "users_clean"},
    )

    graph = Graph([n1, n2], [{"source_id": "1", "target_id": "2"}])

    mock_adapter = MagicMock()

    # Mock the read generator: Generator[list[dict], None, None]
    def mock_read(*args, **kwargs):
        yield [{"id": 1, "name": "Alice"}]
        yield [{"id": 2, "name": "Bob"}]

    mock_adapter.read.side_effect = mock_read
    mock_adapter.write.return_value = 1
    mock_adapter.session.return_value.__enter__.return_value = mock_adapter

    with patch(
        "conduit.engine.core.runner.AdapterRegistry.create", return_value=mock_adapter
    ):
        runner = LocalRunner(graph, {"int1": {}, "int2": {}}, run_id="test-run")
        result = runner.run()

        assert result["status"] == "success"
        assert len(result["steps"]) == 2
        # Verify write was called twice (once per batch)
        assert mock_adapter.write.call_count == 2


def test_runner_with_transform():
    n1 = Node(
        id="1",
        key="s1",
        label="E",
        kind="extract",
        integration_id="int1",
        config={"asset": "in"},
    )
    n2 = Node(id="2", key="s2", label="T", kind="transform")
    n3 = Node(
        id="3",
        key="s3",
        label="L",
        kind="load",
        integration_id="int2",
        config={"asset": "out"},
    )

    graph = Graph(
        [n1, n2, n3],
        [{"source_id": "1", "target_id": "2"}, {"source_id": "2", "target_id": "3"}],
    )

    mock_adapter = MagicMock()
    mock_adapter.read.side_effect = lambda *a, **k: (yield [{"val": 10}, {"val": 20}])
    mock_adapter.write.return_value = 2
    mock_adapter.session.return_value.__enter__.return_value = mock_adapter

    # Patch apply_logic to double the values
    with patch("conduit.engine.core.runner.LocalRunner._apply_logic") as mock_logic:
        mock_logic.side_effect = lambda node, batch: [
            {"val": r["val"] * 2} for r in batch
        ]
        with patch(
            "conduit.engine.core.runner.AdapterRegistry.create",
            return_value=mock_adapter,
        ):
            runner = LocalRunner(graph, {"int1": {}, "int2": {}})
            runner.run()

            # Verify write was called with doubled values
            args, kwargs = mock_adapter.write.call_args
            assert args[1] == [{"val": 20}, {"val": 40}]
