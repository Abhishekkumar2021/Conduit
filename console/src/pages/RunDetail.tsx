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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
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
    <div className="fade-in p-4 sm:p-5 lg:p-6 space-y-4">
      <PageHeader
        title={`Run #${run.id.slice(0, 8)}`}
        description="Execution details and stage outcomes"
        actions={
          <Link to="/runs">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Runs
            </Button>
          </Link>
        }
      />

      <div className="max-w-7xl flex flex-wrap items-center gap-x-8 gap-y-4 px-1 pb-4 border-b border-border/40">
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-bold px-0.5">
            Status
          </span>
          <div className="flex items-center gap-2">
            {run.status === "succeeded" ? (
              <CheckCircle2
                className="h-4 w-4 text-emerald-500"
                strokeWidth={2}
              />
            ) : run.status === "failed" ? (
              <AlertTriangle
                className="h-4 w-4 text-rose-500"
                strokeWidth={2}
              />
            ) : (
              <Loader2
                className="h-4 w-4 animate-spin text-primary"
                strokeWidth={2}
              />
            )}
            <span className="text-[13px] font-bold text-foreground/90 capitalize">
              {run.status}
            </span>
          </div>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-bold px-0.5">
            Duration
          </span>
          <p className="text-[13px] font-bold text-foreground/90 tabular-nums">
            {formatDuration(run.duration_ms)}
          </p>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-bold px-0.5">
            Pipeline
          </span>
          <p className="text-[13px] font-bold text-foreground/90">
            {pipelineName}
          </p>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-bold px-0.5">
            Trigger
          </span>
          <p className="text-[13px] font-bold text-foreground/90 capitalize">
            {run.trigger_type}
          </p>
        </div>
      </div>

      <div className="max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline/Steps Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[13px] font-bold text-foreground/80 flex items-center gap-2 tracking-tight">
              <Activity className="h-3.5 w-3.5 text-primary/60" />
              Execution Flow
            </h3>
            <Badge
              variant="info"
              dot
              className="px-1.5 py-0 h-4 text-[9px] font-bold border-none bg-transparent"
            >
              {run.steps.length} Stages
            </Badge>
          </div>

          <div className="space-y-2 relative before:absolute before:left-[17px] before:top-4 before:bottom-4 before:w-px before:bg-border/30">
            {run.steps.length === 0 ? (
              <div className="rounded-2xl p-12 text-center text-muted-foreground bg-muted/10">
                No stages recorded for this run.
              </div>
            ) : (
              run.steps.map((step, idx) => {
                return (
                  <div
                    key={step.id}
                    className="group relative flex gap-6 py-2 transition-all"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div
                      className={cn(
                        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/10 transition-all",
                        step.status === "succeeded"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : step.status === "failed"
                            ? "bg-rose-500/10 text-rose-600"
                            : "bg-muted/30 text-muted-foreground/40",
                      )}
                    >
                      {step.status === "succeeded" ? (
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                      ) : step.status === "failed" ? (
                        <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                      ) : (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          strokeWidth={2}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <h4 className="text-[14px] font-semibold text-foreground leading-none">
                            {step.stage_key}
                          </h4>
                          <span className="text-[11px] text-muted-foreground lowercase opacity-70">
                            {step.stage_kind} •{" "}
                            {formatDuration(step.duration_ms)}
                          </span>
                        </div>

                        <div className="flex items-center gap-6 text-[12px] tabular-nums text-muted-foreground font-medium">
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] uppercase tracking-tighter opacity-50">
                              In
                            </span>
                            <span>{step.records_in}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] uppercase tracking-tighter opacity-50">
                              Out
                            </span>
                            <span>{step.records_out}</span>
                          </div>
                          {step.records_failed > 0 && (
                            <div className="flex flex-col items-center text-rose-500">
                              <span className="text-[9px] uppercase tracking-tighter opacity-50">
                                Fail
                              </span>
                              <span>{step.records_failed}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {step.error_message && (
                        <div className="mt-2 rounded-lg bg-rose-500/5 border border-rose-500/10 p-3 text-[12px] text-rose-600 leading-relaxed flex gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{step.error_message}</span>
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
        <div className="space-y-6 px-1">
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Timeline
              </span>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Started</span>
                  <span className="font-medium">
                    {formatDate(run.started_at)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Finished</span>
                  <span className="font-medium">
                    {formatDate(run.finished_at)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/40 space-y-2.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-bold block px-0.5">
                Execution Details
              </span>
              <div className="flex items-center justify-between p-2 rounded-xl bg-muted/10 border border-border/40">
                <span className="text-[11px] font-mono text-muted-foreground/60 truncate pl-1">
                  {run.id}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground/30 hover:text-foreground transition-all"
                >
                  <Info className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {run.error_message && (
          <Card className="p-5! border-destructive/20 bg-destructive/5 space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <h3 className="text-[13px] font-bold">Critical Failure</h3>
            </div>
            <p className="text-[12px] text-destructive/90 leading-relaxed italic">
              "{run.error_message}"
            </p>
            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:bg-destructive/10"
              >
                View Documentation
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
