import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Pause,
  Clock,
  Settings,
  CheckCircle2,
  Loader2,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PipelineGraph } from "@/components/pipeline-builder/PipelineGraph";
import { PipelineSidebar } from "@/components/pipeline-builder/PipelineSidebar";
import { usePipeline } from "@/hooks/queries/usePipelines";
import {
  useLatestRevision,
  usePipelineRuns,
  useTriggerRun,
  useCreateRevision,
} from "@/hooks/queries/usePipelineDetails";
import { toast } from "sonner";
import { RUN_STATUS } from "@/lib/constants";
import { useState, useCallback, useEffect, useRef } from "react";
import type {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
} from "@xyflow/react";
import { applyNodeChanges, applyEdgeChanges, addEdge } from "@xyflow/react";
import type { RevisionCreate } from "@/types/api";

export function PipelineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: pipeline, isLoading: isPipeLoading } = usePipeline(id || "");
  const { data: latestRevision, isLoading: isRevLoading } = useLatestRevision(
    id || "",
  );
  const { data: runs } = usePipelineRuns(id || "");
  const { mutate: triggerRun, isPending: isTriggering } = useTriggerRun(
    id || "",
  );
  const { mutate: createRevision, isPending: isSaving } = useCreateRevision(
    id || "",
  );

  const [isEditing, setIsEditing] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const lastSyncedRevisionId = useRef<string | null>(null);

  // Sync graph state from server revision data (only when not actively editing)
  useEffect(() => {
    if (
      latestRevision &&
      !isEditing &&
      lastSyncedRevisionId.current !== latestRevision.id
    ) {
      // Build a lookup map of stage DB UUID -> stage key
      // This is needed because React Flow nodes use the string `key` as their id,
      // but the backend edges return database UUIDs for source_id and target_id.
      const map = new Map<string, string>();
      latestRevision.stages.forEach((st) => {
        if (st.id && st.key) map.set(st.id, st.key);
      });

      // eslint-disable-next-line
      setNodes(
        latestRevision.stages.map((st) => ({
          id: st.key || st.id,
          type: "standard",
          position: { x: st.position_x, y: st.position_y },
          data: {
            label: st.label,
            kind: st.kind,
            adapter: st.config?.adapter || "postgresql",
          },
        })),
      );
      setEdges(
        latestRevision.edges.map((edge) => ({
          id: edge.id,
          source: map.get(edge.source_id) || edge.source_id,
          target: map.get(edge.target_id) || edge.target_id,
          type: "smoothstep",
        })),
      );
      lastSyncedRevisionId.current = latestRevision.id;
    }
  }, [latestRevision, isEditing]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, animated: true }, eds));
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const type = event.dataTransfer.getData("application/reactflow");
    const kind = event.dataTransfer.getData("application/kind");
    if (!type) return;

    // Use the cursor position relative to the canvas
    const bounds = (event.target as HTMLElement)
      .closest(".react-flow")
      ?.getBoundingClientRect();
    const position = bounds
      ? { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
      : { x: 200, y: 200 };

    const newNode: Node = {
      id: `${kind}-${Date.now()}`,
      type,
      position,
      data: {
        label: kind.charAt(0).toUpperCase() + kind.slice(1),
        kind,
      },
    };

    setNodes((nds) => nds.concat(newNode));
  }, []);

  const handleSave = () => {
    const revision: RevisionCreate = {
      number: (latestRevision?.number ?? 0) + 1,
      summary: "Updated via Builder",
      stages: nodes.map((n) => ({
        key: n.id,
        label: n.data.label as string,
        kind: n.data.kind as "extract" | "transform" | "load" | "gate",
        position_x: n.position.x,
        position_y: n.position.y,
        config: {},
      })),
      edges: edges.map((e) => ({
        source_key: e.source,
        target_key: e.target,
      })),
    };

    createRevision(revision, {
      onSuccess: () => {
        toast.success("Pipeline saved successfully");
        setIsEditing(false);
        lastSyncedRevisionId.current = null; // Force re-sync on next revision load
      },
      onError: () => toast.error("Failed to save pipeline"),
    });
  };

  const isLoading = isPipeLoading || isRevLoading;

  const latestRun = runs?.[0];
  const isRunning =
    latestRun && ["pending", "queued", "running"].includes(latestRun.status);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-medium text-muted-foreground">
            Loading pipeline...
          </p>
        </div>
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-8">
        <div className="text-center max-w-xs">
          <h2 className="text-sm font-semibold">Pipeline not found</h2>
          <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
            The pipeline might have been deleted or you may not have access to
            it.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-6 w-full"
            onClick={() => navigate("/pipelines")}
          >
            Back to Pipelines
          </Button>
        </div>
      </div>
    );
  }

  const isPipelineActive = pipeline.status === "active";

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden fade-in relative">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-card/60 backdrop-blur-xl px-4 z-10 relative">
        <div className="flex items-center gap-3">
          <Link
            to="/pipelines"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="h-4 w-px bg-border/60 mx-1"></div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[14px] font-semibold text-foreground tracking-tight">
                {pipeline.name}
              </h1>
              <Badge
                variant={isPipelineActive ? "success" : "default"}
                className={cn(
                  "h-6 text-[11px] px-2.5 py-0 rounded-full border border-border/50 bg-background/50 backdrop-blur-md flex items-center gap-1.5 font-medium shadow-sm transition-all",
                  isPipelineActive &&
                    "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-500",
                )}
              >
                {isPipelineActive ? (
                  <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
                ) : (
                  <Clock className="h-3 w-3" strokeWidth={2.5} />
                )}
                {pipeline.status
                  ? pipeline.status.charAt(0).toUpperCase() +
                    pipeline.status.slice(1)
                  : "Draft"}
              </Badge>
              {isEditing && (
                <Badge
                  variant="warning"
                  className="h-6 text-[11px] px-2.5 py-0 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium"
                >
                  <Pencil className="h-2.5 w-2.5" />
                  Editing
                </Badge>
              )}
              {isRunning && latestRun && (
                <Badge
                  variant="info"
                  className="h-6 text-[11px] px-2.5 py-0 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-500 flex items-center gap-1.5 font-medium shadow-sm"
                >
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} />
                  {RUN_STATUS[latestRun.status as keyof typeof RUN_STATUS]
                    ?.label || latestRun.status}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:flex items-center gap-4 mr-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />{" "}
              {pipeline.schedule_cron || "Manual Trigger"}
            </span>
            <span className="opacity-60">ID: {pipeline.id.slice(0, 8)}</span>
          </div>

          {isEditing ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 rounded-full px-3.5 text-xs bg-muted/50 hover:bg-muted border-border/50 transition-all font-medium text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setIsEditing(false);
                  lastSyncedRevisionId.current = null; // Reset to re-sync from server
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="h-8 rounded-full px-4 text-xs font-medium shadow-sm bg-emerald-600 hover:bg-emerald-500 border-none transition-all"
                onClick={handleSave}
                disabled={isSaving || nodes.length === 0}
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 rounded-full px-3.5 text-xs bg-muted/50 hover:bg-muted border-border/50 transition-all font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                Edit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 rounded-full px-3.5 text-xs bg-muted/50 hover:bg-muted border-border/50 transition-all font-medium text-muted-foreground hover:text-foreground"
              >
                <Pause className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                Pause
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="h-8 rounded-full px-4 text-xs font-medium shadow-sm bg-blue-600 hover:bg-blue-500 border-none transition-all"
                disabled={isTriggering || !!isRunning}
                onClick={() => {
                  triggerRun(undefined, {
                    onSuccess: () => toast.success("Pipeline run triggered"),
                    onError: (err: unknown) => {
                      const error = err as {
                        response?: { data?: { detail?: string } };
                      };
                      toast.error(
                        error.response?.data?.detail || "Failed to trigger run",
                      );
                    },
                  });
                }}
              >
                <Play
                  className={cn(
                    "h-3.5 w-3.5 mr-1.5 fill-current",
                    isTriggering && "animate-pulse",
                  )}
                  strokeWidth={2}
                />
                Run Now
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main Canvas Area */}
      <main className="flex-1 w-full flex bg-muted/10 relative overflow-hidden">
        <div className="flex-1 relative h-full">
          {nodes.length > 0 || isEditing ? (
            <PipelineGraph
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              readOnly={!isEditing}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-dots-pattern">
              <div className="max-w-md">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                  <Settings className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <h2 className="text-sm font-semibold">Empty Pipeline</h2>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  This pipeline has no stages yet. Open the builder to add
                  sources, transforms, and destinations.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-6"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Open Builder
                </Button>
              </div>
            </div>
          )}
        </div>

        {isEditing && <PipelineSidebar />}
      </main>
    </div>
  );
}
