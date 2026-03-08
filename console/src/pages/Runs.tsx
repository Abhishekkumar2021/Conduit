import {
  CheckCircle2,
  AlertTriangle,
  Activity,
  Search,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rs = Math.floor(s % 60);
  return `${m}m ${rs}s`;
};

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
  const hasActiveFilters = Boolean(
    searchInput.trim() || statusFilter || triggerFilter,
  );

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("");
    setTriggerFilter("");
  };

  return (
    <div className="fade-in p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Runs"
        description="Execution history across all pipelines"
      />

      <div className="mt-8 flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-[320px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
          <input
            id="runs-search"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search runs..."
            className="h-10 w-full rounded-2xl border border-border/80 bg-background pl-10 pr-4 text-sm text-foreground/90 placeholder:text-muted-foreground/30 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 font-medium shadow-sm"
          />
        </div>

        {/* Status */}
        <Select
          value={statusFilter || "all"}
          onValueChange={(value) =>
            setStatusFilter(value === "all" ? "" : (value as RunStatusFilter))
          }
        >
          <SelectTrigger
            id="runs-status"
            className="h-10 w-[140px] rounded-2xl bg-background border-border/80 px-3 text-sm font-bold tracking-tight text-foreground/80 focus:ring-2 focus:ring-primary/10 focus:border-primary shadow-sm"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border/40 shadow-xl">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="succeeded">Succeeded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {/* Trigger */}
        <Select
          value={triggerFilter || "all"}
          onValueChange={(value) =>
            setTriggerFilter(value === "all" ? "" : (value as RunTriggerFilter))
          }
        >
          <SelectTrigger
            id="runs-trigger"
            className="h-10 w-[140px] rounded-2xl bg-background border-border/80 px-3 text-sm font-bold tracking-tight text-foreground/80 focus:ring-2 focus:ring-primary/10 focus:border-primary shadow-sm"
          >
            <SelectValue placeholder="Trigger" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border/40 shadow-xl">
            <SelectItem value="all">All Trigger</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="schedule">Schedule</SelectItem>
            <SelectItem value="api">API</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset */}
        <Button
          variant="outline"
          size="sm"
          onClick={resetFilters}
          disabled={!hasActiveFilters}
          className="h-10 px-4 rounded-xl text-[11px] font-bold tracking-tight text-muted-foreground/50 border-border/80 hover:text-foreground hover:bg-muted/30 transition-all shadow-sm disabled:opacity-30"
        >
          Reset Filters
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-5 px-1">
        {isRunsLoading ? (
          <Skeleton className="h-5 w-[300px] rounded-full" />
        ) : (
          <>
            <div className="flex items-center gap-2 text-[12px] font-bold text-muted-foreground/50 uppercase tracking-tight">
              <span>{safeRuns.length} total</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] font-bold text-emerald-600/70 dark:text-emerald-500/70 uppercase tracking-tight">
              <span>
                {safeRuns.filter((r) => r.status === "succeeded").length} passed
              </span>
            </div>
            <div className="flex items-center gap-2 text-[12px] font-bold text-rose-600/70 dark:text-rose-500/70 uppercase tracking-tight">
              <span>
                {safeRuns.filter((r) => r.status === "failed").length} failed
              </span>
            </div>
          </>
        )}
      </div>

      {/* Table */}
      <div className="mt-6">
        {isRunsLoading ? (
          <div className="grid grid-cols-1 gap-3 max-w-7xl">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        ) : safeRuns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/40 p-12 text-center text-muted-foreground/40 max-w-7xl">
            {hasActiveFilters
              ? "No runs match the current filters."
              : "No execution history yet."}
          </div>
        ) : (
          <div className="max-w-7xl space-y-3">
            {safeRuns.map((run) => {
              const st =
                RUN_STATUS[run.status as keyof typeof RUN_STATUS] ||
                RUN_STATUS.pending;
              const pName =
                pipelineMap.get(run.pipeline_id)?.name || "Unknown Pipeline";
              return (
                <div
                  key={run.id}
                  onClick={() => navigate(`/runs/${run.id}`)}
                  className="group cursor-pointer"
                >
                  <div className="rounded-2xl border border-border/60 bg-card p-3.5 sm:p-4 transition-all duration-200 hover:border-primary/20 flex items-center gap-5 active:scale-[0.998] shadow-sm">
                    {/* Status Icon */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/20 border border-border/10">
                      {run.status === "succeeded" && (
                        <CheckCircle2
                          className="h-5 w-5 text-emerald-500"
                          strokeWidth={2}
                        />
                      )}
                      {run.status === "failed" && (
                        <AlertTriangle
                          className="h-5 w-5 text-rose-500"
                          strokeWidth={2}
                        />
                      )}
                      {run.status === "running" && (
                        <Activity
                          className="h-5 w-5 animate-pulse text-primary"
                          strokeWidth={2}
                        />
                      )}
                      {run.status === "pending" && (
                        <Clock
                          className="h-5 w-5 text-muted-foreground/30"
                          strokeWidth={2}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 flex items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <h3 className="truncate text-[14px] font-bold text-foreground/90 group-hover:text-primary transition-colors tracking-tight">
                            {pName}
                          </h3>
                          <Badge
                            variant={st.variant}
                            dot
                            className="px-1.5 py-0 h-4 text-[9px] font-bold rounded-lg border-none bg-transparent"
                          >
                            {st.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground/40 mt-0.5">
                          <span className="tabular-nums opacity-60">
                            #{run.id.slice(0, 8)}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
                          <span className="capitalize">{run.trigger_type}</span>
                          {run.duration_ms && (
                            <>
                              <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
                              <span className="tabular-nums">
                                {formatDuration(run.duration_ms)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Time */}
                      <div className="shrink-0 text-right hidden sm:block">
                        <p className="text-[12px] font-bold text-foreground/70 tabular-nums">
                          {run.started_at
                            ? new Date(run.started_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">
                          {run.started_at
                            ? new Date(run.started_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
