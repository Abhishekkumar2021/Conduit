import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Square,
  Copy,
  Check,
  XCircle,
  Clock,
  Zap,
  Database,
  ArrowRightLeft,
  Timer,
  Hash,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRunDetail } from "@/hooks/queries/useRuns";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { usePipelines } from "@/hooks/queries/usePipelines";
import { useRetryRun, useCancelRun } from "@/hooks/useRunOps";

const STATUS_META: Record<string, { icon: typeof CheckCircle2; label: string; color: string; badgeVariant: "success" | "danger" | "warning" | "default" }> = {
  succeeded: { icon: CheckCircle2, label: "Succeeded", color: "text-emerald-500", badgeVariant: "success" },
  failed:    { icon: XCircle,      label: "Failed",    color: "text-red-500",     badgeVariant: "danger" },
  cancelled: { icon: XCircle,      label: "Cancelled", color: "text-muted-foreground", badgeVariant: "default" },
  running:   { icon: Loader2,      label: "Running",   color: "text-blue-500",    badgeVariant: "info" as never },
  pending:   { icon: Clock,        label: "Pending",   color: "text-amber-500",   badgeVariant: "warning" },
  queued:    { icon: Clock,        label: "Queued",     color: "text-amber-500",   badgeVariant: "warning" },
};

const STAGE_ICON: Record<string, typeof Database> = {
  extract: Database,
  load: ArrowRightLeft,
  transform: Zap,
  processor: Zap,
  gate: Zap,
};

function formatDuration(ms?: number) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function formatDate(ts?: string) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function formatRelative(ts?: string) {
  if (!ts) return "";
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return "";
  }
}

export function RunDetail() {
  const { id = "" } = useParams();
  const { data: run, isLoading } = useRunDetail(id);
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";
  const { data: pipelines } = usePipelines(workspaceId);
  const { mutate: retryRun, isPending: retryPending } = useRetryRun();
  const { mutate: cancelRun, isPending: cancelPending } = useCancelRun();
  const [idCopied, setIdCopied] = useState(false);

  const recordsTotals = useMemo(() => {
    if (!run?.steps) return { in: 0, out: 0, failed: 0 };
    return run.steps.reduce(
      (acc, s) => ({
        in: acc.in + s.records_in,
        out: acc.out + s.records_out,
        failed: acc.failed + s.records_failed,
      }),
      { in: 0, out: 0, failed: 0 },
    );
  }, [run]);

  const pipelineName =
    pipelines?.find((p) => p.id === run?.pipeline_id)?.name || "Unknown Pipeline";

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(run!.id);
      toast.success("Run ID copied");
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    } catch {
      toast.error("Could not copy run ID");
    }
  };

  if (isLoading) {
    return (
      <div className="fade-in max-w-5xl mx-auto p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="fade-in max-w-5xl mx-auto p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">Run not found</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">This run may have been deleted.</p>
          <Link to="/runs">
            <Button variant="secondary" size="sm" className="mt-5">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back to Runs
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const sm = STATUS_META[run.status] || STATUS_META.pending;
  const StatusIcon = sm.icon;
  const isTerminal = ["succeeded", "failed", "cancelled"].includes(run.status);

  return (
    <div className="fade-in max-w-5xl mx-auto p-6 lg:p-8 space-y-6">
      {/* Header */}
      <PageHeader
        title={`Run ${run.id.slice(0, 8)}`}
        preTitle={
          <Link
            to="/runs"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Runs
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={retryPending || (run.status !== "failed" && run.status !== "cancelled")}
              onClick={() => retryRun(run.id)}
            >
              {retryPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Retry
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={cancelPending || !["running", "pending", "queued"].includes(run.status)}
              onClick={() => cancelRun(run.id)}
            >
              {cancelPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
              Cancel
            </Button>
          </div>
        }
      />

      {/* Status + meta bar */}
      <div className="flex items-center gap-3 -mt-4 flex-wrap">
        <Badge variant={sm.badgeVariant} dot className="text-xs">
          {sm.label}
        </Badge>
        <Link to={`/pipelines/${run.pipeline_id}`} className="text-xs font-medium text-primary hover:underline">
          {pipelineName}
        </Link>
        <span className="text-xs text-muted-foreground capitalize">{run.trigger_type}</span>
        {run.started_at && (
          <span className="text-xs text-muted-foreground" title={formatDate(run.started_at)}>
            {formatRelative(run.started_at)}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", isTerminal ? (run.status === "succeeded" ? "bg-emerald-500/10 text-emerald-500" : run.status === "failed" ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground") : "bg-blue-500/10 text-blue-500")}>
              <StatusIcon className={cn("h-4 w-4", run.status === "running" && "animate-spin")} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Status</p>
              <p className="text-sm font-semibold capitalize">{sm.label}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
              <Timer className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Duration</p>
              <p className="text-sm font-semibold tabular-nums">{formatDuration(run.duration_ms)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Hash className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Records</p>
              <p className="text-sm font-semibold tabular-nums">{recordsTotals.out.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", recordsTotals.failed > 0 ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground")}>
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Failed</p>
              <p className={cn("text-sm font-semibold tabular-nums", recordsTotals.failed > 0 && "text-red-500")}>{recordsTotals.failed.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Error banner */}
      {run.error_message && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">Execution Error</p>
            <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1 leading-relaxed">{run.error_message}</p>
          </div>
        </div>
      )}

      {/* Execution steps */}
      <Card padding={false}>
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">Execution Steps</h3>
          <span className="text-xs text-muted-foreground">{run.steps.length} stage{run.steps.length !== 1 ? "s" : ""}</span>
        </div>
        {run.steps.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm text-muted-foreground">No stages recorded for this run.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {run.steps.map((step, idx) => {
              const isSuccess = step.status === "succeeded";
              const isFailed = step.status === "failed";
              const StageIcon = STAGE_ICON[step.stage_kind] || Zap;
              return (
                <div key={step.id} className="px-5 py-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Step number + icon */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg border",
                        isSuccess ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                        isFailed ? "bg-red-500/10 border-red-500/20 text-red-500" :
                        "bg-muted border-border text-muted-foreground",
                      )}>
                        {isSuccess ? <CheckCircle2 className="h-4 w-4" /> :
                         isFailed ? <XCircle className="h-4 w-4" /> :
                         <Loader2 className="h-4 w-4 animate-spin" />}
                      </div>
                      {idx < run.steps.length - 1 && (
                        <div className="w-px h-4 bg-border" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <StageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <h4 className="text-sm font-medium truncate">{step.stage_key}</h4>
                          <Badge variant="default" className="text-[10px] shrink-0 capitalize">{step.stage_kind}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {formatDuration(step.duration_ms)}
                        </span>
                      </div>

                      {/* Record counts */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <ChevronRight className="h-3 w-3 rotate-180" />
                          <strong className="text-foreground">{step.records_in.toLocaleString()}</strong> in
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <ChevronRight className="h-3 w-3" />
                          <strong className="text-foreground">{step.records_out.toLocaleString()}</strong> out
                        </span>
                        {step.records_failed > 0 && (
                          <span className="inline-flex items-center gap-1 tabular-nums text-red-500">
                            <AlertTriangle className="h-3 w-3" />
                            <strong>{step.records_failed.toLocaleString()}</strong> failed
                          </span>
                        )}
                      </div>

                      {/* Error */}
                      {step.error_message && (
                        <div className="mt-3 rounded-lg bg-red-500/5 border border-red-500/20 p-3 text-sm text-red-600 dark:text-red-400 leading-relaxed">
                          {step.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Details row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card padding={false}>
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="text-sm font-semibold">Timeline</h3>
          </div>
          <div className="divide-y divide-border text-sm">
            <div className="flex justify-between px-5 py-3">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" /> Started
              </span>
              <span className="font-medium">{formatDate(run.started_at)}</span>
            </div>
            <div className="flex justify-between px-5 py-3">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" /> Finished
              </span>
              <span className="font-medium">{formatDate(run.finished_at)}</span>
            </div>
            <div className="flex justify-between px-5 py-3">
              <span className="text-muted-foreground flex items-center gap-2">
                <Timer className="h-3.5 w-3.5" /> Duration
              </span>
              <span className="font-medium tabular-nums">{formatDuration(run.duration_ms)}</span>
            </div>
          </div>
        </Card>

        <Card padding={false}>
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="text-sm font-semibold">Details</h3>
          </div>
          <div className="divide-y divide-border text-sm">
            <div className="flex justify-between items-center px-5 py-3">
              <span className="text-muted-foreground">Pipeline</span>
              <Link to={`/pipelines/${run.pipeline_id}`} className="font-medium text-primary hover:underline">
                {pipelineName}
              </Link>
            </div>
            <div className="flex justify-between px-5 py-3">
              <span className="text-muted-foreground">Trigger</span>
              <span className="font-medium capitalize">{run.trigger_type}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3 group">
              <span className="text-muted-foreground">Run ID</span>
              <button
                onClick={copyId}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="truncate max-w-[140px]">{run.id}</span>
                {idCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
