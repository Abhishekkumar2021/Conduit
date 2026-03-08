import { useCallback, useState } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  BackgroundVariant,
} from "@xyflow/react";
import type {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { StandardNode } from "./nodes/StandardNode";
import { useTheme } from "@/hooks/useTheme";

const nodeTypes = {
  standard: StandardNode,
};

interface PipelineGraphProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  nodes?: Node[];
  edges?: Edge[];
  onNodesChange?: (changes: NodeChange[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  onConnect?: (connection: Connection) => void;
  onDrop?: (event: React.DragEvent) => void;
  readOnly?: boolean;
}

export function PipelineGraph({
  initialNodes = [],
  initialEdges = [],
  nodes: controlledNodes,
  edges: controlledEdges,
  onNodesChange: controlledOnNodesChange,
  onEdgesChange: controlledOnEdgesChange,
  onConnect: controlledOnConnect,
  onDrop,
  readOnly = false,
}: PipelineGraphProps) {
  const { theme } = useTheme();

  const [internalNodes, setInternalNodes] = useState<Node[]>(initialNodes);
  const [internalEdges, setInternalEdges] = useState<Edge[]>(initialEdges);

  const nodes = controlledNodes || internalNodes;
  const edges = controlledEdges || internalEdges;

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) return;
      if (controlledOnNodesChange) {
        controlledOnNodesChange(changes);
      } else {
        setInternalNodes((nds) => applyNodeChanges(changes, nds));
      }
    },
    [readOnly, controlledOnNodesChange],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) return;
      if (controlledOnEdgesChange) {
        controlledOnEdgesChange(changes);
      } else {
        setInternalEdges((eds) => applyEdgeChanges(changes, eds));
      }
    },
    [readOnly, controlledOnEdgesChange],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (readOnly) return;
      if (controlledOnConnect) {
        controlledOnConnect(params);
      } else {
        setInternalEdges((eds) => addEdge({ ...params, animated: true }, eds));
      }
    },
    [readOnly, controlledOnConnect],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  return (
    <div className="h-full w-full bg-background outline-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        colorMode={theme === "dark" ? "dark" : "light"}
        className="dark:bg-background"
        defaultEdgeOptions={{
          style: { strokeWidth: 2, stroke: "var(--muted-foreground)" },
          animated: true,
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="var(--muted-foreground)"
          className="opacity-15"
        />
        <MiniMap
          className="bg-card border-border rounded-lg shadow-sm"
          maskColor="var(--background)"
          nodeColor="var(--primary)"
        />
        <Controls
          showInteractive={false}
          className="border-border bg-card fill-foreground"
        />
      </ReactFlow>
    </div>
  );
}
