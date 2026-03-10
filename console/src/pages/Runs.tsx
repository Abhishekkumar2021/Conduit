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
    <div className="fade-in p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Runs"
        description="Execution history across all pipelines"
      />

      {/* ── Filter Bar ─────────────────────────────────────── */}
      <div className="mt-6 flex items-center gap-2">
        <div className="relative" style={{ width: 200 }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/30" />
          <Input
            id="runs-search"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search runs..."
            className="pl-9 h-9 text-[12px]"
          />
        </div>

        <div style={{ width: 120 }}>
          <Select
            value={statusFilter || "all"}
            onValueChange={(value) =>
              setStatusFilter(value === "all" ? "" : (value as RunStatusFilter))
            }
          >
            <SelectTrigger id="runs-status" className="h-9 text-[12px]">
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

        <div style={{ width: 120 }}>
          <Select
            value={triggerFilter || "all"}
            onValueChange={(value) =>
              setTriggerFilter(
                value === "all" ? "" : (value as RunTriggerFilter),
              )
            }
          >
            <SelectTrigger id="runs-trigger" className="h-9 text-[12px]">
              <SelectValue placeholder="Trigger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trigger</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="schedule">Schedule</SelectItem>
              <SelectItem value="api">API</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="ml-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* ── Summary ────────────────────────────────────────── */}
      <div className="mt-4 flex items-center gap-4 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/40">
        {isRunsLoading ? (
          <Skeleton className="h-4 w-[200px] rounded-full" />
        ) : (
          <>
            <span>{safeRuns.length} Total</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="text-emerald-500/60">
              {safeRuns.filter((r) => r.status === "succeeded").length} Passed
            </span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="text-rose-500/60">
              {safeRuns.filter((r) => r.status === "failed").length} Failed
            </span>
          </>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="mt-6">
        {isRunsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[64px] w-full rounded-xl" />
            ))}
          </div>
        ) : safeRuns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/40 p-12 text-center text-muted-foreground/30">
            {hasActiveFilters
              ? "No runs match the current filters."
              : "No execution history yet."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead>Run ID</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Started At</TableHead>
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {run.status === "succeeded" && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        )}
                        {run.status === "failed" && (
                          <AlertTriangle className="h-4 w-4 text-rose-500" />
                        )}
                        {run.status === "running" && (
                          <Activity className="h-4 w-4 animate-pulse text-primary" />
                        )}
                        {run.status === "pending" && (
                          <Clock className="h-4 w-4 text-muted-foreground/30" />
                        )}
                        <Badge
                          variant={st.variant}
                          dot
                          className="px-1.5 py-0 h-4 text-[10px] font-bold rounded-md bg-transparent border-none"
                        >
                          {st.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground tabular-nums">
                      #{run.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground/90 group-hover:text-primary transition-colors">
                      {pName}
                    </TableCell>
                    <TableCell className="uppercase text-[11px] text-muted-foreground/80 font-semibold tracking-wider">
                      {run.trigger_type}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {run.duration_ms ? formatDuration(run.duration_ms) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {run.started_at ? (
                        <>
                          <span className="font-semibold text-foreground/80 mr-2">
                            {new Date(run.started_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span>
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
        )}
      </div>
    </div>
  );
}
