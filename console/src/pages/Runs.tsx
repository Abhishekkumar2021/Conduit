import {
  CheckCircle2,
  AlertTriangle,
  Activity,
  Filter,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { RUN_STATUS } from "@/lib/constants";

import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { useRuns } from "@/hooks/queries/useRuns";
import { usePipelines } from "@/hooks/queries/usePipelines";

/* ─── Page ────────────────────────────────────────────────────── */

export function Runs() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";

  const { data: runs, isLoading: isRunsLoading } = useRuns(workspaceId);
  const { data: pipelines } = usePipelines(workspaceId);

  const pipelineMap = new Map(pipelines?.map((p) => [p.id, p]));
  const safeRuns = runs || [];

  return (
    <div className="fade-in p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Runs"
        description="Execution history across all pipelines"
      />

      {/* Filters */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="runs-search"
            type="text"
            placeholder="Search pipelines..."
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-[13px] text-foreground placeholder-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button variant="secondary" size="sm">
          <Filter className="h-3.5 w-3.5" />
          Filter
        </Button>
      </div>

      {/* Summary */}
      <div className="mt-4 flex flex-wrap items-center gap-4 sm:gap-6 text-[12px]">
        {isRunsLoading ? (
          <Skeleton className="h-5 w-[300px]" />
        ) : (
          <>
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">
                {safeRuns.length}
              </span>{" "}
              runs
            </span>
            <span className="flex items-center gap-1.5 text-success">
              <CheckCircle2 className="h-3 w-3" />
              {safeRuns.filter((r) => r.status === "succeeded").length}{" "}
              succeeded
            </span>
            <span className="flex items-center gap-1.5 text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {safeRuns.filter((r) => r.status === "failed").length} failed
            </span>
            <span className="flex items-center gap-1.5 text-primary">
              <Activity className="h-3 w-3" />
              {safeRuns.filter((r) => r.status === "running").length} running
            </span>
          </>
        )}
      </div>

      {/* Table */}
      <div className="mt-4">
        {isRunsLoading ? (
          <div className="space-y-2 max-w-[1200px]">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : safeRuns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 p-8 text-center text-muted-foreground max-w-[1200px]">
            No runs found for this workspace.
          </div>
        ) : (
          <div className="max-w-[1200px] overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <Table
              headers={[
                "Run",
                "Pipeline",
                "Status",
                "Duration",
                "Rows",
                "Trigger",
                "Time",
              ]}
            >
              {safeRuns.map((run) => {
                const st =
                  RUN_STATUS[run.status as keyof typeof RUN_STATUS] ||
                  RUN_STATUS.pending;
                const pName =
                  pipelineMap.get(run.pipeline_id)?.name || "Unknown Pipeline";
                return (
                  <tr
                    key={run.id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                  >
                    <td className="px-4 py-3 text-[13px] font-medium tabular-nums text-foreground">
                      #{run.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground">
                      {pName}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={st.variant}
                        dot
                        className="rounded-full px-2 py-0 h-[20px] shadow-sm"
                      >
                        {st.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[12px] tabular-nums text-muted-foreground">
                      {run.duration_ms
                        ? `${(run.duration_ms / 1000).toFixed(1)}s`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-[12px] tabular-nums text-muted-foreground">
                      —
                    </td>
                    <td className="px-4 py-3 text-[11px] capitalize text-muted-foreground">
                      {run.trigger_type}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">
                      {new Date(run.started_at || "").toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
