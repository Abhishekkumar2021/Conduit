import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table } from "@/components/ui/Table";
import { RUN_STATUS } from "@/lib/constants";
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

  const statusMeta =
    RUN_STATUS[run.status as keyof typeof RUN_STATUS] || RUN_STATUS.pending;

  return (
    <div className="fade-in p-4 sm:p-6 lg:p-8 space-y-4">
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

      <div className="max-w-[1000px] rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant={statusMeta.variant}
            dot
            className="rounded-full px-2 py-0 h-[20px] shadow-sm"
          >
            {statusMeta.label}
          </Badge>
          <span className="text-[12px] text-muted-foreground">
            Pipeline: <span className="text-foreground">{pipelineName}</span>
          </span>
          <span className="text-[12px] text-muted-foreground capitalize">
            Trigger: <span className="text-foreground">{run.trigger_type}</span>
          </span>
          <span className="text-[12px] text-muted-foreground">
            Duration:{" "}
            <span className="text-foreground">{formatDuration(run.duration_ms)}</span>
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 text-[12px] text-muted-foreground">
          <span>
            Started: <span className="text-foreground">{formatDate(run.started_at)}</span>
          </span>
          <span>
            Finished:{" "}
            <span className="text-foreground">{formatDate(run.finished_at)}</span>
          </span>
          {run.error_message ? (
            <span className="sm:col-span-2 text-destructive">
              Error: {run.error_message}
            </span>
          ) : null}
        </div>
      </div>

      <div className="max-w-[1000px]">
        {run.steps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 p-8 text-center text-muted-foreground">
            No step logs are available for this run yet.
          </div>
        ) : (
          <Table
            headers={[
              "Stage",
              "Kind",
              "Status",
              "Records In",
              "Records Out",
              "Failed",
              "Duration",
              "Error",
            ]}
          >
            {run.steps.map((step) => {
              const stepStatus =
                RUN_STATUS[step.status as keyof typeof RUN_STATUS] ||
                RUN_STATUS.pending;
              return (
                <tr key={step.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-[12px] text-foreground">{step.stage_key}</td>
                  <td className="px-4 py-3 text-[12px] text-muted-foreground capitalize">
                    {step.stage_kind}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={stepStatus.variant}
                      dot
                      className="rounded-full px-2 py-0 h-[20px] shadow-sm"
                    >
                      {stepStatus.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[12px] tabular-nums text-muted-foreground">
                    {step.records_in}
                  </td>
                  <td className="px-4 py-3 text-[12px] tabular-nums text-muted-foreground">
                    {step.records_out}
                  </td>
                  <td className="px-4 py-3 text-[12px] tabular-nums text-muted-foreground">
                    {step.records_failed}
                  </td>
                  <td className="px-4 py-3 text-[12px] tabular-nums text-muted-foreground">
                    {formatDuration(step.duration_ms)}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-destructive">
                    {step.error_message || "—"}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </div>
    </div>
  );
}
