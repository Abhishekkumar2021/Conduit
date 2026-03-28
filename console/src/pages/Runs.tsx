import {
  CheckCircle2,
  AlertTriangle,
  Activity,
  Search,
  Clock,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
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

  const stats = useMemo(() => {
    const succeeded = safeRuns.filter((r) => r.status === "succeeded").length;
    const failed = safeRuns.filter((r) => r.status === "failed").length;
    const running = safeRuns.filter(
      (r) => r.status === "running" || r.status === "queued",
    ).length;
    return { succeeded, failed, running, total: safeRuns.length };
  }, [safeRuns]);

  return (
    <div className="fade-in max-w-7xl mx-auto p-6 lg:p-8">
      <PageHeader
        title="Runs"
        description="Execution history across all pipelines"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 relative overflow-hidden">
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-muted-foreground/3" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Total</p>
          <p className="text-2xl font-bold tabular-nums mt-1.5">
            {isRunsLoading ? "—" : stats.total}
          </p>
        </Card>
        <Card className="p-4 relative overflow-hidden" style={{ boxShadow: "var(--stat-glow) rgba(16,185,129,0.12)" }}>
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-emerald-500/6" />
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500 pulse-dot" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Succeeded</p>
          </div>
          <p className="text-2xl font-bold tabular-nums mt-1.5 text-emerald-600 dark:text-emerald-400">
            {isRunsLoading ? "—" : stats.succeeded}
          </p>
        </Card>
        <Card className="p-4 relative overflow-hidden" style={{ boxShadow: "var(--stat-glow) rgba(239,68,68,0.12)" }}>
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-red-500/6" />
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Failed</p>
          </div>
          <p className="text-2xl font-bold tabular-nums mt-1.5 text-red-600 dark:text-red-400">
            {isRunsLoading ? "—" : stats.failed}
          </p>
        </Card>
        <Card className="p-4 relative overflow-hidden" style={{ boxShadow: "var(--stat-glow) rgba(59,130,246,0.12)" }}>
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-blue-500/6" />
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-blue-500 pulse-dot" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Running</p>
          </div>
          <p className="text-2xl font-bold tabular-nums mt-1.5 text-blue-600 dark:text-blue-400">
            {isRunsLoading ? "—" : stats.running}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-[220px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            id="runs-search"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search runs..."
            className="pl-9 h-9 text-[13px]"
          />
        </div>

        <div className="w-[140px]">
          <Select
            value={statusFilter || "all"}
            onValueChange={(value) =>
              setStatusFilter(value === "all" ? "" : (value as RunStatusFilter))
            }
          >
            <SelectTrigger id="runs-status" className="h-9 text-[13px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="succeeded">Succeeded</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-[140px]">
          <Select
            value={triggerFilter || "all"}
            onValueChange={(value) =>
              setTriggerFilter(
                value === "all" ? "" : (value as RunTriggerFilter),
              )
            }
          >
            <SelectTrigger id="runs-trigger" className="h-9 text-[13px]">
              <SelectValue placeholder="Trigger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Triggers</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="schedule">Schedule</SelectItem>
              <SelectItem value="api">API</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="ml-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
          >
            <XCircle className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mt-6">
        {isRunsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[64px] w-full rounded-lg" />
            ))}
          </div>
        ) : safeRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">
              {hasActiveFilters ? "No matching runs" : "No runs yet"}
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
              {hasActiveFilters
                ? "Try adjusting your filters to find what you're looking for."
                : "Run a pipeline to see execution history here."}
            </p>
          </div>
        ) : (
          <Card padding={false} className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px] pl-5">Status</TableHead>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right pr-5">Started At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeRuns.map((run) => {
                  const st =
                    RUN_STATUS[run.status as keyof typeof RUN_STATUS] ||
                    RUN_STATUS.pending;
                  const pName =
                    pipelineMap.get(run.pipeline_id)?.name || "Unknown Pipeline";
                  return (
                    <TableRow
                      key={run.id}
                      onClick={() => navigate(`/runs/${run.id}`)}
                      className="cursor-pointer group"
                    >
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-2">
                          {run.status === "succeeded" && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          )}
                          {run.status === "failed" && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          {run.status === "running" && (
                            <Activity className="h-4 w-4 animate-pulse text-primary" />
                          )}
                          {run.status === "pending" && (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                          <Badge variant={st.variant} dot>
                            {st.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                        #{run.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {pName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{run.trigger_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {run.duration_ms ? formatDuration(run.duration_ms) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground pr-5">
                        {run.started_at ? (
                          <>
                            <span className="font-semibold text-foreground mr-2">
                              {new Date(run.started_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className="text-xs">
                              {new Date(run.started_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
