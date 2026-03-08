"""
Conduit Engine — Graph and Node definitions for DAG execution.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class Node:
    """Represents a single stage in the pipeline execution graph."""

    id: str
    key: str
    label: str
    kind: str
    config: Dict[str, Any] = field(default_factory=dict)
    inputs: List[str] = field(default_factory=list)
    outputs: List[str] = field(default_factory=list)
    integration_id: Optional[str] = None


class Graph:
    """
    Directed Acyclic Graph (DAG) representing the pipeline execution flow.
    """

    def __init__(self, nodes: List[Node], edges: List[Dict[str, str]]):
        self.nodes = {node.id: node for node in nodes}
        self.adj: Dict[str, List[str]] = {node.id: [] for node in nodes}
        self.in_degree: Dict[str, int] = {node.id: 0 for node in nodes}

        for edge in edges:
            u, v = edge["source_id"], edge["target_id"]
            if u in self.adj and v in self.adj:
                self.adj[u].append(v)
                self.in_degree[v] += 1
                self.nodes[u].outputs.append(v)
                self.nodes[v].inputs.append(u)

    def validate(self) -> bool:
        """Verify the graph is a DAG (no cycles)."""
        try:
            self.topological_sort()
            return True
        except ValueError:
            return False

    def topological_sort(self) -> List[str]:
        """
        Returns a list of node IDs in topological order using Kahn's algorithm.
        Raises ValueError if a cycle is detected.
        """
        in_degree = self.in_degree.copy()
        queue = [n for n, d in in_degree.items() if d == 0]
        result = []

        while queue:
            # Sort queue for deterministic execution order if nodes are at same level
            queue.sort()
            u = queue.pop(0)
            result.append(u)

            for v in self.adj[u]:
                in_degree[v] -= 1
                if in_degree[v] == 0:
                    queue.append(v)

        if len(result) != len(self.nodes):
            raise ValueError("Cycle detected in pipeline graph")

        return result

    def get_roots(self) -> List[str]:
        """Return nodes with no incoming edges (entry points)."""
        return [n for n, d in self.in_degree.items() if d == 0]

    def get_leaves(self) -> List[str]:
        """Return nodes with no outgoing edges (terminal points)."""
        return [n for n, l in self.adj.items() if not l]
