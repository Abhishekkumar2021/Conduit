import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";
import type { Node, Edge, NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2, Network } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { ADAPTER_UI_MAP, DEFAULT_ADAPTER, INTEGRATION_STATUS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { useWorkspaceLineage } from "@/hooks/useLineage";
import { useTheme } from "@/hooks/useTheme";
import type { LineageEdge, LineageGraph } from "@/types/api";

const COL_GAP_X = 56;
const ROW_GAP_Y = 48;
const CELL_W = 260;
const CELL_H = 132;

type LineageNodeData = {
  name: string;
  adapterType?: string;
  status?: string;
  pipelineCount: number;
};

function resolveAdapterUi(adapterType?: string) {
  const raw = adapterType?.toLowerCase().replace(/-/g, "_") ?? "";
  if (ADAPTER_UI_MAP[raw]) return ADAPTER_UI_MAP[raw];
  if (raw.includes("postgres")) return ADAPTER_UI_MAP.postgresql;
  return DEFAULT_ADAPTER;
}

function statusVariant(
  status?: string,
): "success" | "warning" | "danger" | "default" {
  const s = status?.toLowerCase();
  if (s === "healthy") return "success";
  if (s === "degraded") return "warning";
  if (s === "unreachable") return "danger";
  return "default";
}

function integrationStatusLabel(status?: string): string {
  const s = status?.toLowerCase();
  if (s === "healthy") return INTEGRATION_STATUS.healthy.label;
  if (s === "degraded") return INTEGRATION_STATUS.degraded.label;
  if (s === "unreachable") return INTEGRATION_STATUS.unreachable.label;
  return status?.trim() ? status : "Unknown";
}

function countIncidentPipelines(nodeId: string, edges: LineageEdge[]): number {
  const ids = new Set<string>();
  for (const e of edges) {
    if (e.source === nodeId || e.target === nodeId) ids.add(e.pipeline_id);
  }
  return ids.size;
}

function graphToFlow(graph: LineageGraph): { nodes: Node[]; edges: Edge[] } {
  const n = graph.nodes.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));

  const nodes: Node<LineageNodeData, "lineageIntegration">[] = graph.nodes.map(
    (node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const pipelineCount =
        node.pipelines?.length ?? countIncidentPipelines(node.id, graph.edges);

      return {
        id: node.id,
        type: "lineageIntegration",
        position: {
          x: col * (CELL_W + COL_GAP_X),
          y: row * (CELL_H + ROW_GAP_Y),
        },
        data: {
          name: node.name ?? node.id,
          adapterType: node.adapter_type,
          status: node.status,
          pipelineCount,
        },
      };
    },
  );

  const edges: Edge[] = graph.edges.map((e, i) => ({
    id: `${e.source}-${e.target}-${e.pipeline_id}-${i}`,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    animated: true,
    label: e.pipeline_name,
    style: {
      stroke: "var(--primary)",
      strokeWidth: 1.75,
      strokeOpacity: 0.55,
    },
    labelStyle: {
      fill: "var(--foreground)",
      fontWeight: 600,
      fontSize: 11,
    },
    labelBgStyle: {
      fill: "var(--card)",
      fillOpacity: 0.92,
    },
    labelBgPadding: [6, 4] as [number, number],
    interactionWidth: 24,
  }));

  return { nodes, edges };
}

function LineageIntegrationNode({ data, selected }: NodeProps) {
  const ui = resolveAdapterUi(data.adapterType as string | undefined);
  const Icon = ui.icon;
  const variant = statusVariant(data.status as string | undefined);
  const statusLabel = integrationStatusLabel(data.status as string | undefined);

  return (
    <div
      className={cn(
        "relative w-[240px] rounded-xl border bg-card p-3.5 shadow-sm transition-all duration-150",
        selected
          ? "border-primary/50 ring-2 ring-primary/20 shadow-md"
          : "border-border hover:shadow-md hover:border-border/80",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground transition-transform duration-200 hover:scale-110"
      />

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border",
            ui.color,
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-medium text-foreground">
              {data.name as string}
            </h3>
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full shadow-sm transition-colors duration-200",
                variant === "success" && "bg-success",
                variant === "warning" && "bg-warning",
                variant === "danger" && "bg-destructive",
                variant === "default" && "bg-muted-foreground",
              )}
              title={statusLabel}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {(data.adapterType as string) || "Integration"}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Badge variant="default">
              {(data.adapterType as string) || "adapter"}
            </Badge>
            <span className="text-xs tabular-nums text-muted-foreground">
              {data.pipelineCount as number}{" "}
              {(data.pipelineCount as number) === 1 ? "pipeline" : "pipelines"}
            </span>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground transition-transform duration-200 hover:scale-110"
      />
    </div>
  );
}

const nodeTypes = { lineageIntegration: LineageIntegrationNode };

function AutoFitView({ nodeCount, edgeCount }: { nodeCount: number; edgeCount: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (nodeCount === 0) return;
    const id = requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 400 });
    });
    return () => cancelAnimationFrame(id);
  }, [nodeCount, edgeCount, fitView]);
  return null;
}

export function Lineage() {
  const { theme } = useTheme();
  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id;

  const lineage = useWorkspaceLineage(workspaceId);

  const loading =
    workspacesLoading || (!!workspaceId && lineage.isPending && !lineage.data);

  const flow = useMemo(
    () => (lineage.data ? graphToFlow(lineage.data) : { nodes: [], edges: [] }),
    [lineage.data],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges);

  useEffect(() => {
    setNodes(flow.nodes);
    setEdges(flow.edges);
  }, [flow.nodes, flow.edges, setNodes, setEdges]);

  const showEmpty =
    !loading &&
    (!workspaceId ||
      (lineage.data !== undefined && lineage.data.nodes.length === 0));

  return (
    <div className="fade-in flex min-h-0 flex-col p-6 lg:p-8">
      <PageHeader
        title="Data Lineage"
        description="Visualize data flow across integrations"
      />

      <Card
        padding={false}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {loading ? (
          <div className="relative flex h-[calc(100vh-200px)] w-full items-center justify-center">
            <Skeleton className="absolute inset-2 rounded-lg opacity-40" />
            <Loader2
              className="relative z-10 h-9 w-9 animate-spin text-primary motion-reduce:animate-none"
              strokeWidth={2}
            />
          </div>
        ) : showEmpty ? (
          <div className="flex h-[calc(100vh-200px)] w-full flex-col items-center justify-center gap-4 px-6 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted shadow-inner">
              <Network className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {!workspaceId
                ? "No workspace available yet. Create a workspace to explore lineage."
                : "No lineage data. Create pipelines connecting integrations to visualize data flow."}
            </p>
          </div>
        ) : (
          <div className="h-[calc(100vh-200px)] w-full animate-in fade-in duration-500">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2, duration: 400 }}
              minZoom={0.15}
              maxZoom={1.5}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              colorMode={theme === "dark" ? "dark" : "light"}
              className="dark:bg-background"
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{
                type: "smoothstep",
                animated: true,
              }}
            >
              <AutoFitView nodeCount={nodes.length} edgeCount={edges.length} />
              <Background
                variant={BackgroundVariant.Dots}
                gap={22}
                size={1.25}
                color="var(--muted-foreground)"
                className="opacity-[0.12]"
              />
              <MiniMap
                className="!bottom-3 !right-3 !rounded-xl !border !border-border !bg-card !shadow-lg overflow-hidden"
                position="bottom-right"
                maskColor="var(--background)"
                nodeColor="var(--primary)"
                pannable
                zoomable
              />
              <Controls
                showInteractive={false}
                position="bottom-left"
                className="!bottom-3 !left-3 m-0 overflow-hidden !rounded-xl !border !border-border !bg-card !shadow-lg [&>button]:!border-border [&>button]:!bg-card [&>button]:!rounded-lg [&>button]:!text-foreground hover:[&>button]:!bg-accent"
              />
            </ReactFlow>
          </div>
        )}
      </Card>
    </div>
  );
}
