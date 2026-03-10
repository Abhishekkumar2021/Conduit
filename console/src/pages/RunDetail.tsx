import { Link, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Activity,
  Info,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
// import { Card } from "@/components/ui/Card";
// import { RUN_STATUS } from "@/lib/constants";
import { useRunDetail } from "@/hooks/queries/useRuns";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { usePipelines } from "@/hooks/queries/usePipelines";

function formatDuration(durationMs?: number) {
  if (!durationMs) return "—";
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatDate(ts?: string) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export function RunDetail() {
  const { id = "" } = useParams();
  const { data: run, isLoading } = useRunDetail(id);
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";
  const { data: pipelines } = usePipelines(workspaceId);
  const pipelineName =
    pipelines?.find((pipeline) => pipeline.id === run?.pipeline_id)?.name ||
    "Unknown Pipeline";

  if (isLoading) {
    return (
      <div className="fade-in p-4 sm:p-6 lg:p-8 space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full max-w-[1000px]" />
        <Skeleton className="h-72 w-full max-w-[1000px]" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="fade-in p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Run Not Found"
          description="This run may have been deleted or is not accessible."
          actions={
            <Link to="/runs">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Runs
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="fade-in p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={`Run #${run.id.slice(0, 8)}`}
        description="Execution details and stage outcomes"
        actions={
          <Link to="/runs">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 text-xs font-semibold text-muted-foreground/60 hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-2" />
              Back to Runs
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-x-12 gap-y-4 px-1 pb-6 mb-8 border-b border-border/20">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-bold">
            Status
          </span>
          <div className="flex items-center gap-2">
            {run.status === "succeeded" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : run.status === "failed" ? (
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            <span className="text-[13px] font-semibold text-foreground/80 capitalize">
              {run.status}
            </span>
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-bold">
            Duration
          </span>
          <p className="text-[13px] font-semibold text-foreground/80 tabular-nums">
            {formatDuration(run.duration_ms)}
          </p>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-bold">
            Pipeline
          </span>
          <p className="text-[13px] font-semibold text-foreground/80">
            {pipelineName}
          </p>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-bold">
            Trigger
          </span>
          <p className="text-[13px] font-semibold text-foreground/80 capitalize">
            {run.trigger_type}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Timeline/Steps Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground/40 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" />
              Execution Flow
            </h3>
            <span className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-tight">
              {run.steps.length} Stages
            </span>
          </div>

          <div className="space-y-1 relative before:absolute before:left-[15.5px] before:top-4 before:bottom-4 before:w-px before:bg-border/20">
            {run.steps.length === 0 ? (
              <div className="rounded-lg p-12 text-center text-muted-foreground/30 bg-muted/5 border border-dashed border-border/20">
                No stages recorded for this run.
              </div>
            ) : (
              run.steps.map((step) => {
                return (
                  <div
                    key={step.id}
                    className="group relative flex gap-6 py-3 transition-all"
                  >
                    <div
                      className={cn(
                        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/10 transition-all shadow-xs",
                        step.status === "succeeded"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : step.status === "failed"
                            ? "bg-rose-500/10 text-rose-500"
                            : "bg-muted/30 text-muted-foreground/30",
                      )}
                    >
                      {step.status === "succeeded" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : step.status === "failed" ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <h4 className="text-[13.5px] font-semibold text-foreground/90 leading-tight">
                            {step.stage_key}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-tight">
                              {step.stage_kind}
                            </span>
                            <span className="text-[10px] text-muted-foreground/20">
                              •
                            </span>
                            <span className="text-[11px] text-muted-foreground/40 font-medium tabular-nums">
                              {formatDuration(step.duration_ms)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-[11px] tabular-nums text-muted-foreground/50 font-bold uppercase tracking-tight">
                          <div className="flex flex-col items-end min-w-[32px]">
                            <span className="text-[8px] opacity-40">In</span>
                            <span>{step.records_in}</span>
                          </div>
                          <div className="flex flex-col items-end min-w-[32px]">
                            <span className="text-[8px] opacity-40">Out</span>
                            <span>{step.records_out}</span>
                          </div>
                          {step.records_failed > 0 && (
                            <div className="flex flex-col items-end min-w-[32px] text-rose-500/60">
                              <span className="text-[8px] opacity-40">
                                Fail
                              </span>
                              <span>{step.records_failed}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {step.error_message && (
                        <div className="mt-3 rounded-lg bg-rose-500/5 border border-rose-500/10 p-3.5 text-[12px] text-rose-600/80 leading-relaxed flex gap-2.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-60" />
                          <span className="font-medium">
                            {step.error_message}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-8 px-1">
          <div className="space-y-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Timeline Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground/70 font-medium">
                  Started At
                </span>
                <span className="font-semibold text-foreground/90">
                  {formatDate(run.started_at)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground/70 font-medium">
                  Finished At
                </span>
                <span className="font-semibold text-foreground/90">
                  {formatDate(run.finished_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-border/20 space-y-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Technical Info
            </h3>
            <div className="p-3 rounded-lg bg-muted/5 border border-border/20 flex items-center justify-between group">
              <div className="min-w-0">
                <p className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-1">
                  Execution ID
                </p>
                <p className="text-[10px] font-mono text-muted-foreground/70 truncate">
                  {run.id}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-foreground/60 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Info className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {run.error_message && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-5 space-y-3">
              <div className="flex items-center gap-2 text-rose-500/70">
                <AlertTriangle className="h-4 w-4" />
                <h3 className="text-[12px] font-bold uppercase tracking-wider">
                  Critical Failure
                </h3>
              </div>
              <p className="text-[12px] text-rose-600/80 leading-relaxed font-medium italic">
                "{run.error_message}"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
