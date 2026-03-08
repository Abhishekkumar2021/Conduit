import {
  CheckCircle2,
  AlertTriangle,
  Activity,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { RUN_STATUS } from "@/lib/constants";
import { useEffect, useMemo, useState } from "react";

import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { useRuns } from "@/hooks/queries/useRuns";
import { usePipelines } from "@/hooks/queries/usePipelines";
import type { Run } from "@/types/api";

type RunStatusFilter = "" | Run["status"];
type RunTriggerFilter = "" | Run["trigger_type"];

/* ─── Page ────────────────────────────────────────────────────── */

export function Runs() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RunStatusFilter>("");
  const [triggerFilter, setTriggerFilter] = useState<RunTriggerFilter>("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const runFilters = useMemo(
    () => ({
      limit: 50,
      status: statusFilter || undefined,
      trigger_type: triggerFilter || undefined,
      search: search || undefined,
    }),
    [search, statusFilter, triggerFilter],
  );

  const { data: runs, isLoading: isRunsLoading } = useRuns(
    workspaceId,
    runFilters,
  );
  const { data: pipelines } = usePipelines(workspaceId);

  const pipelineMap = new Map(pipelines?.map((p) => [p.id, p]));
  const safeRuns = runs || [];
  const hasActiveFilters = Boolean(searchInput.trim() || statusFilter || triggerFilter);

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
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by pipeline or run id..."
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-[13px] text-foreground placeholder-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring"
          />
        </div>
        <Select
          value={statusFilter || "all"}
          onValueChange={(value) =>
            setStatusFilter(value === "all" ? "" : (value as RunStatusFilter))
          }
        >
          <SelectTrigger
            id="runs-status"
            className="h-8 w-full sm:w-[150px] bg-background px-2 text-[12px]"
          >
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="succeeded">Succeeded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={triggerFilter || "all"}
          onValueChange={(value) =>
            setTriggerFilter(value === "all" ? "" : (value as RunTriggerFilter))
          }
        >
          <SelectTrigger
            id="runs-trigger"
            className="h-8 w-full sm:w-[150px] bg-background px-2 text-[12px]"
          >
            <SelectValue placeholder="All trigger" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All trigger</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="schedule">Schedule</SelectItem>
            <SelectItem value="api">API</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setSearchInput("");
            setSearch("");
            setStatusFilter("");
            setTriggerFilter("");
          }}
          disabled={!hasActiveFilters}
        >
          Clear
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
            {hasActiveFilters
              ? "No runs match the current filters."
              : "No runs found for this workspace."}
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
                    onClick={() => navigate(`/runs/${run.id}`)}
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
                      {run.started_at
                        ? new Date(run.started_at).toLocaleString()
                        : "—"}
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
