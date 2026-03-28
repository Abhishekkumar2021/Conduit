import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Clock,
  Settings,
  CheckCircle2,
  Loader2,
  Pencil,
  Upload,
  MoreHorizontal,
  Copy,
  Download,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import { PipelineGraph } from "@/components/pipeline-builder/PipelineGraph";
import { PipelineSidebar } from "@/components/pipeline-builder/PipelineSidebar";
import { NodePropertiesPanel } from "@/components/pipeline-builder/NodePropertiesPanel";
import { usePipeline } from "@/hooks/queries/usePipelines";
import {
  useLatestRevision,
  usePipelineRuns,
  useTriggerRun,
  useCreateRevision,
  usePublishRevision,
} from "@/hooks/queries/usePipelineDetails";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import {
  usePipelineSchedule,
  useUpdateSchedule,
  useClearSchedule,
} from "@/hooks/useSchedule";
import {
  useClonePipeline,
  useExportPipeline,
  useImportPipeline,
} from "@/hooks/usePipelineOps";
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
  const { mutate: publishRevision, isPending: isPublishing } =
    usePublishRevision(id || "");

  const { data: workspaces } = useWorkspaces();
  const { data: scheduleInfo } = usePipelineSchedule(id || "");
  const { mutate: updateSchedule, isPending: isUpdatingSchedule } =
    useUpdateSchedule();
  const { mutate: clearSchedule, isPending: isClearingSchedule } =
    useClearSchedule();
  const { mutate: clonePipeline, isPending: isCloning } = useClonePipeline();
  const { mutate: exportPipeline, isPending: isExporting } =
    useExportPipeline();
  const { mutate: importPipeline, isPending: isImporting } =
    useImportPipeline();

  const [isEditing, setIsEditing] = useState(false);
  const [schedulePanelOpen, setSchedulePanelOpen] = useState(false);
  const [scheduleCronDraft, setScheduleCronDraft] = useState("");
  const [scheduleFreq, setScheduleFreq] = useState<string>("daily");
  const [scheduleMinute, setScheduleMinute] = useState("0");
  const [scheduleHour, setScheduleHour] = useState("9");
  const [scheduleDay, setScheduleDay] = useState("1");
  const [scheduleInterval, setScheduleInterval] = useState("5");
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneDescription, setCloneDescription] = useState("");
  const schedulePanelRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!schedulePanelOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (schedulePanelRef.current?.contains(t)) return;
      if (t.closest("[data-radix-popper-content-wrapper]")) return;
      if (t.closest("[data-radix-select-viewport]")) return;
      setSchedulePanelOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [schedulePanelOpen]);

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
        config: {},
      },
    };

    setNodes((nds) => nds.concat(newNode));
  }, []);

  const handleUpdateNode = useCallback(
    (id: string, newTargetData: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === id) {
            return { ...n, data: newTargetData };
          }
          return n;
        }),
      );
    },
    [],
  );

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }, []);

  const selectedNode = nodes.find((n) => n.selected);

  const handleSave = () => {
    // 1. Basic pre-save validation
    if (nodes.length === 0) {
      toast.error("Pipeline cannot be empty");
      return;
    }

    const unconfiguredNodes = nodes.filter((n) => {
      const isDataNode = n.data.kind === "extract" || n.data.kind === "load";
      if (isDataNode) {
        return !(n.data.config as Record<string, unknown>)?.integration_id;
      }
      return false;
    });

    if (unconfiguredNodes.length > 0) {
      toast.error(
        `Please configure integrations for: ${unconfiguredNodes.map((n) => n.data.label).join(", ")}`,
      );
      return;
    }

    const revision: RevisionCreate = {
      number: (latestRevision?.number ?? 0) + 1,
      summary: "Updated via Builder",
      stages: nodes.map((n) => {
        const cfg = ((n.data.config as Record<string, unknown>) || {}) as Record<
          string,
          string | number | boolean | null
        >;
        if (n.data.adapter) {
          cfg.adapter = n.data.adapter as string;
        }
        return {
          key: n.id,
          label: n.data.label as string,
          kind: n.data.kind as "extract" | "transform" | "load" | "gate",
          integration_id: (cfg.integration_id as string) || undefined,
          position_x: n.position.x,
          position_y: n.position.y,
          config: cfg,
        };
      }),
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
  const hasPublishedRevision = !!pipeline?.published_revision_id;
  const latestRevisionIsPublished =
    !!latestRevision && pipeline?.published_revision_id === latestRevision.id;

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
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
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
  const workspaceIdForImport =
    pipeline.workspace_id || workspaces?.[0]?.id || "";

  const nextFireLabel =
    scheduleInfo?.next_fire_at != null
      ? new Date(scheduleInfo.next_fire_at).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden fade-in relative">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 z-10 relative">
        <div className="flex items-center gap-3">
          <Link
            to="/pipelines"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="h-4 w-px bg-border mx-1"></div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-semibold">
                {pipeline.name}
              </h1>
              <Badge
                variant={isPipelineActive ? "success" : "default"}
                className={cn(
                  "h-6 text-xs px-2 py-0 flex items-center gap-1.5",
                  isPipelineActive &&
                    "text-emerald-600 dark:text-emerald-400",
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
                <Badge variant="warning">
                  <Pencil className="h-2.5 w-2.5" />
                  Editing
                </Badge>
              )}
              {isRunning && latestRun && (
                <Link to={`/runs/${latestRun.id}`}>
                  <Badge variant="info">
                    <Loader2
                      className="h-3 w-3 animate-spin"
                      strokeWidth={2.5}
                    />
                    {RUN_STATUS[latestRun.status as keyof typeof RUN_STATUS]
                      ?.label || latestRun.status}
                  </Badge>
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:flex items-center gap-4 mr-4 text-xs text-muted-foreground">
            <div className="relative" ref={schedulePanelRef}>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 -mx-1.5 transition-all duration-200 text-left border",
                  schedulePanelOpen
                    ? "bg-primary/10 text-primary border-primary/30"
                    : pipeline.schedule_cron
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40"
                      : "border-transparent hover:bg-accent hover:text-foreground",
                )}
                onClick={() => {
                  setSchedulePanelOpen((open) => {
                    if (!open) {
                      const cron = pipeline.schedule_cron ?? "";
                      setScheduleCronDraft(cron);
                      if (cron) {
                        const parts = cron.split(" ");
                        if (parts.length === 5) {
                          const [min, hr, , , dow] = parts;
                          if (min.startsWith("*/")) {
                            setScheduleFreq("minutes");
                            setScheduleInterval(min.replace("*/", ""));
                          } else if (hr === "*") {
                            setScheduleFreq("hourly");
                            setScheduleMinute(min);
                          } else if (dow !== "*") {
                            setScheduleFreq("weekly");
                            setScheduleHour(hr);
                            setScheduleDay(dow);
                          } else {
                            setScheduleFreq("daily");
                            setScheduleHour(hr);
                          }
                        }
                      }
                    }
                    return !open;
                  });
                }}
              >
                {pipeline.schedule_cron ? (
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-dot shrink-0" />
                ) : (
                  <Clock className="h-3 w-3 shrink-0" />
                )}
                <span className="max-w-[200px] truncate text-[11px] font-semibold">
                  {pipeline.schedule_cron
                    ? (() => {
                        const c = pipeline.schedule_cron;
                        if (c.startsWith("*/")) { const m = c.split(" ")[0].replace("*/", ""); return `Every ${m} min`; }
                        const [min, hr, , , dow] = c.split(" ");
                        if (hr === "*") return `Hourly :${min.padStart(2, "0")}`;
                        const h = Number(hr);
                        const ampm = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
                        if (dow !== "*") { const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]; return `${days[Number(dow)] ?? dow} ${ampm}`; }
                        return `Daily ${ampm}`;
                      })()
                    : "Manual"}
                </span>
              </button>
              {schedulePanelOpen && (() => {
                const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                const HOURS = Array.from({ length: 24 }, (_, i) => ({
                  value: String(i),
                  label: i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`,
                }));
                const FREQ_OPTIONS = [
                  { value: "minutes", label: "Every N minutes", icon: "⏱" },
                  { value: "hourly", label: "Hourly", icon: "🔄" },
                  { value: "daily", label: "Daily", icon: "📅" },
                  { value: "weekly", label: "Weekly", icon: "📆" },
                ];

                const buildCron = () => {
                  switch (scheduleFreq) {
                    case "minutes": return `*/${scheduleInterval} * * * *`;
                    case "hourly":  return `${scheduleMinute} * * * *`;
                    case "daily":   return `0 ${scheduleHour} * * *`;
                    case "weekly":  return `0 ${scheduleHour} * * ${scheduleDay}`;
                    default:        return scheduleCronDraft;
                  }
                };

                const describeSchedule = () => {
                  switch (scheduleFreq) {
                    case "minutes": return `Runs every ${scheduleInterval} minutes`;
                    case "hourly":  return `Runs hourly at :${scheduleMinute.padStart(2, "0")}`;
                    case "daily":   { const h = HOURS.find(x => x.value === scheduleHour); return `Runs daily at ${h?.label ?? scheduleHour + ":00"}`; }
                    case "weekly":  { const h = HOURS.find(x => x.value === scheduleHour); return `Runs every ${DAYS_FULL[Number(scheduleDay)] ?? "day"} at ${h?.label ?? scheduleHour + ":00"}`; }
                    default: return "";
                  }
                };

                const handleSaveSchedule = () => {
                  updateSchedule(
                    { pipelineId: id!, schedule_cron: buildCron(), schedule_timezone: pipeline.schedule_timezone ?? undefined },
                    {
                      onSuccess: () => { toast.success("Schedule updated"); setSchedulePanelOpen(false); },
                      onError: (err: unknown) => { const error = err as { response?: { data?: { detail?: string } } }; toast.error(error.response?.data?.detail ?? "Failed to update schedule"); },
                    },
                  );
                };

                const handleClearSchedule = () => {
                  clearSchedule(id!, {
                    onSuccess: () => { toast.success("Schedule cleared"); setScheduleCronDraft(""); setSchedulePanelOpen(false); },
                    onError: (err: unknown) => { const error = err as { response?: { data?: { detail?: string } } }; toast.error(error.response?.data?.detail ?? "Failed to clear schedule"); },
                  });
                };

                return (
                  <div
                    className="absolute right-0 top-full z-60 mt-2 w-[360px] rounded-2xl border border-border bg-card shadow-2xl shadow-black/15 overflow-hidden scale-in"
                    role="dialog"
                    aria-label="Pipeline schedule"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Clock className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold">Schedule</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">Automate pipeline execution</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSchedulePanelOpen(false)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="p-5 space-y-5">
                      {/* Frequency Tabs */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Frequency</label>
                        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-secondary/60 border border-border/50">
                          {FREQ_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className={cn(
                                "flex flex-col items-center gap-0.5 rounded-lg py-2 text-center transition-all duration-200",
                                scheduleFreq === opt.value
                                  ? "bg-card text-foreground shadow-sm shadow-black/5 border border-border/50"
                                  : "text-muted-foreground hover:text-foreground border border-transparent",
                              )}
                              onClick={() => setScheduleFreq(opt.value)}
                            >
                              <span className="text-sm leading-none">{opt.icon}</span>
                              <span className="text-[10px] font-medium leading-tight">{opt.value === "minutes" ? "Interval" : opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Minutes interval */}
                      {scheduleFreq === "minutes" && (
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Run every</label>
                          <div className="grid grid-cols-5 gap-1.5">
                            {["5", "10", "15", "30", "60"].map((v) => (
                              <button
                                key={v}
                                type="button"
                                className={cn(
                                  "h-9 rounded-xl text-xs font-semibold border transition-all duration-200",
                                  scheduleInterval === v
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40",
                                )}
                                onClick={() => setScheduleInterval(v)}
                              >
                                {v === "60" ? "1h" : `${v}m`}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hourly — minute picker */}
                      {scheduleFreq === "hourly" && (
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">At minute</label>
                          <div className="grid grid-cols-6 gap-1.5">
                            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                              <button
                                key={m}
                                type="button"
                                className={cn(
                                  "h-8 rounded-xl text-xs font-semibold border transition-all duration-200",
                                  scheduleMinute === String(m)
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40",
                                )}
                                onClick={() => setScheduleMinute(String(m))}
                              >
                                :{String(m).padStart(2, "0")}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Daily / Weekly */}
                      {(scheduleFreq === "daily" || scheduleFreq === "weekly") && (
                        <div className="space-y-4">
                          {scheduleFreq === "weekly" && (
                            <div className="space-y-2">
                              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Day of week</label>
                              <div className="grid grid-cols-7 gap-1">
                                {DAYS.map((day, i) => (
                                  <button
                                    key={day}
                                    type="button"
                                    className={cn(
                                      "h-9 rounded-xl text-[11px] font-semibold border transition-all duration-200",
                                      scheduleDay === String(i)
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                                        : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40",
                                    )}
                                    onClick={() => setScheduleDay(String(i))}
                                  >
                                    {day}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Time</label>
                            <Select value={scheduleHour} onValueChange={setScheduleHour}>
                              <SelectTrigger className="h-9 text-[13px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {HOURS.map((h) => (
                                  <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {/* Preview */}
                      <div className="rounded-xl bg-secondary/60 border border-border/50 p-3.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Clock className="h-2.5 w-2.5" />
                          </div>
                          <p className="text-[13px] font-semibold text-foreground">{describeSchedule()}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono pl-7">{buildCron()}</p>
                        {nextFireLabel && (
                          <div className="flex items-center gap-1.5 pt-2 mt-1 border-t border-border/50 pl-7">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-dot" />
                            <p className="text-[11px] text-muted-foreground">
                              Next: <span className="font-medium text-foreground">{nextFireLabel}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3.5 border-t border-border flex items-center gap-2 bg-secondary/30">
                      <Button type="button" variant="primary" size="sm" className="h-8 flex-1 text-xs" disabled={isUpdatingSchedule} onClick={handleSaveSchedule}>
                        {isUpdatingSchedule && <Loader2 className="h-3 w-3 animate-spin" />}
                        Save Schedule
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" disabled={isClearingSchedule} onClick={handleClearSchedule}>
                        {isClearingSchedule ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        Clear
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
            <span className="opacity-60">ID: {pipeline.id.slice(0, 8)}</span>
          </div>

          {isEditing ? (
            <>
              <Button
                variant="secondary"
                size="sm"
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
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
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
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                Edit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={
                  isPublishing || !latestRevision || latestRevisionIsPublished
                }
                onClick={() => {
                  if (!latestRevision) {
                    toast.error("Save a revision before publishing");
                    return;
                  }
                  publishRevision(latestRevision.id, {
                    onSuccess: () =>
                      toast.success(
                        `Published revision v${latestRevision.number}`,
                      ),
                    onError: (err: unknown) => {
                      const error = err as {
                        response?: { data?: { detail?: string } };
                      };
                      toast.error(
                        error.response?.data?.detail ||
                          "Failed to publish revision",
                      );
                    },
                  });
                }}
              >
                {isPublishing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : latestRevisionIsPublished ? (
                  <CheckCircle2
                    className="h-3.5 w-3.5 mr-1.5"
                    strokeWidth={1.5}
                  />
                ) : (
                  <Upload className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                )}
                {latestRevisionIsPublished ? "Published" : "Publish"}
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isTriggering || !!isRunning || !hasPublishedRevision}
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
              <input
                ref={importFileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file || !workspaceIdForImport) {
                    if (!workspaceIdForImport) {
                      toast.error("No workspace available for import");
                    }
                    return;
                  }
                  importPipeline(
                    { workspaceId: workspaceIdForImport, file },
                    {
                      onError: (err: unknown) => {
                        const error = err as {
                          response?: { data?: { detail?: string } };
                        };
                        toast.error(
                          error.response?.data?.detail ??
                            "Failed to import pipeline",
                        );
                      },
                    },
                  );
                }}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label="More pipeline actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    onSelect={() => {
                      setCloneName(`Copy of ${pipeline.name}`);
                      setCloneDescription("");
                      setCloneDialogOpen(true);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-2" />
                    Clone Pipeline
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => exportPipeline(id!)}
                    disabled={isExporting}
                  >
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Export JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setTimeout(() => importFileRef.current?.click(), 0);
                    }}
                    disabled={isImporting || !workspaceIdForImport}
                  >
                    <Upload className="h-3.5 w-3.5 mr-2" />
                    Import Pipeline
                  </DropdownMenuItem>
                  {latestRun ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to={`/runs/${latestRun.id}`}>Latest Run</Link>
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </header>

      {cloneDialogOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setCloneDialogOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-lg bg-card shadow-2xl shadow-black/20 rounded-xl border border-border p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Copy className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">
                    Clone Pipeline
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create a copy with a new name
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCloneDialogOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!cloneName.trim()) return;
                clonePipeline(
                  {
                    pipelineId: id!,
                    name: cloneName.trim(),
                    description: cloneDescription.trim() || undefined,
                  },
                  {
                    onSuccess: (data: { id: string; name: string }) => {
                      setCloneDialogOpen(false);
                      navigate(`/pipelines/${data.id}`);
                    },
                    onError: (err: unknown) => {
                      const error = err as {
                        response?: { data?: { detail?: string } };
                      };
                      toast.error(
                        error.response?.data?.detail ?? "Failed to clone pipeline",
                      );
                    },
                  },
                );
              }}
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="clone-pipeline-name"
                  className="text-[13px] font-medium text-foreground"
                >
                  Name
                </label>
                <Input
                  id="clone-pipeline-name"
                  type="text"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="clone-pipeline-desc"
                  className="text-[13px] font-medium text-foreground"
                >
                  Description
                </label>
                <Textarea
                  id="clone-pipeline-desc"
                  placeholder="Optional"
                  value={cloneDescription}
                  onChange={(e) => setCloneDescription(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCloneDialogOpen(false)}
                  className="h-9 px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="h-9 px-5"
                  disabled={isCloning || !cloneName.trim()}
                >
                  {isCloning ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : null}
                  Clone Pipeline
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <main className="flex-1 w-full flex bg-muted/50 relative overflow-hidden">
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
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Settings className="h-6 w-6 text-muted-foreground" />
                </div>
                <h2 className="text-sm font-semibold">Empty Pipeline</h2>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  This pipeline has no stages yet. Open the builder to add
                  sources, processors, and destinations.
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

        {isEditing &&
          (selectedNode ? (
            <NodePropertiesPanel
              key={selectedNode.id}
              node={selectedNode}
              onUpdate={handleUpdateNode}
              onDelete={handleDeleteNode}
              onClose={() => {
                // Deselect via React Flow changes
                setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
              }}
            />
          ) : (
            <PipelineSidebar />
          ))}
      </main>
    </div>
  );
}
