import {
  GitBranch,
  Play,
  Plug,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Activity,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { RUN_STATUS } from "@/lib/constants";

import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { usePipelines } from "@/hooks/queries/usePipelines";
import { useRuns } from "@/hooks/queries/useRuns";
import { useIntegrations } from "@/hooks/queries/useIntegrations";
import { useMemo } from "react";

/* ─── Chart Helpers ──────────────────────────────────────────── */

const CHART_COLORS = {
  succeeded: "#10b981",
  failed: "#ef4444",
  running: "#3b82f6",
  pending: "#a1a1a1",
};

const PIE_COLORS = ["#10b981", "#ef4444", "#3b82f6", "#a1a1a1"];

/* ─── Page ────────────────────────────────────────────────────── */

export function Dashboard() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";
  const navigate = useNavigate();

  const { data: pipelines } = usePipelines(workspaceId);
  const { data: runs, isLoading: isRunsLoading } = useRuns(workspaceId);
  const { data: integrations } = useIntegrations(workspaceId);

  const pipelineMap = new Map(pipelines?.map((p) => [p.id, p]));

  const totalPipelines = pipelines?.length || 0;
  const activeRuns = runs?.filter((r) => r.status === "running").length || 0;
  const totalIntegrations = integrations?.length || 0;
  const displayRuns = runs?.slice(0, 5) || [];

  // Build chart data from runs
  const runActivityData = useMemo(() => {
    if (!runs || runs.length === 0) return [];

    // Group runs by date
    const dateMap = new Map<
      string,
      { succeeded: number; failed: number; total: number }
    >();

    runs.forEach((run) => {
      const dateStr = run.started_at
        ? new Date(run.started_at).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          })
        : "Pending";
      const entry = dateMap.get(dateStr) || {
        succeeded: 0,
        failed: 0,
        total: 0,
      };
      entry.total += 1;
      if (run.status === "succeeded") entry.succeeded += 1;
      if (run.status === "failed") entry.failed += 1;
      dateMap.set(dateStr, entry);
    });

    return Array.from(dateMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .slice(-7); // last 7 days
  }, [runs]);

  const runBreakdown = useMemo(() => {
    if (!runs || runs.length === 0) return [];
    const counts: Record<string, number> = {};
    runs.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [runs]);

  const successRate =
    runs && runs.length > 0
      ? Math.round(
          (runs.filter((r) => r.status === "succeeded").length / runs.length) *
            100,
        )
      : null;

  return (
    <div className="fade-in p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        description="Overview of your data platform"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate("/pipelines")}
          >
            <Play className="h-3.5 w-3.5" />
            Run Pipeline
          </Button>
        }
      />

      {/* Stats Grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="cursor-pointer" onClick={() => navigate("/pipelines")}>
          <StatCard
            label="Total Pipelines"
            value={totalPipelines}
            icon={<GitBranch className="h-4 w-4" />}
          />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/runs")}>
          <StatCard
            label="Active Runs"
            value={activeRuns}
            icon={<Activity className="h-4 w-4" />}
          />
        </div>
        <div
          className="cursor-pointer"
          onClick={() => navigate("/integrations")}
        >
          <StatCard
            label="Integrations"
            value={totalIntegrations}
            icon={<Plug className="h-4 w-4" />}
          />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/runs")}>
          <StatCard
            label="Success Rate"
            value={successRate !== null ? `${successRate}%` : "N/A"}
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Charts Section */}
      {runs && runs.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Run Activity Area Chart */}
          <Card className="lg:col-span-2 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">
                Run Activity
              </h3>
              <span className="text-[10px] text-muted-foreground/40 font-medium">
                Last {runActivityData.length} periods
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart
                data={runActivityData}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={CHART_COLORS.succeeded}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_COLORS.succeeded}
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="failGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={CHART_COLORS.failed}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_COLORS.failed}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  opacity={0.4}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  axisLine={{ stroke: "var(--border)", strokeWidth: 1 }}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  padding={{ left: 8, right: 8 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="succeeded"
                  stroke={CHART_COLORS.succeeded}
                  strokeWidth={2}
                  fill="url(#successGrad)"
                  dot={{ r: 3, fill: CHART_COLORS.succeeded, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  stroke={CHART_COLORS.failed}
                  strokeWidth={2}
                  fill="url(#failGrad)"
                  dot={{ r: 3, fill: CHART_COLORS.failed, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Run Breakdown Pie Chart */}
          <Card className="p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-4">
              Run Breakdown
            </h3>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={runBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {runBreakdown.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={
                          CHART_COLORS[
                            entry.name as keyof typeof CHART_COLORS
                          ] || PIE_COLORS[index % PIE_COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {runBreakdown.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor:
                        CHART_COLORS[entry.name as keyof typeof CHART_COLORS] ||
                        "#a1a1a1",
                    }}
                  />
                  <span className="capitalize">{entry.name}</span>
                  <span className="text-muted-foreground/40">
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Recent Runs */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">
            Recent Activity
          </h2>
          <Link
            to="/runs"
            className="flex items-center gap-1 text-[11px] font-bold text-primary/70 hover:text-primary transition-colors uppercase tracking-tight"
          >
            History <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div>
          {isRunsLoading && (
            <div className="space-y-2 mt-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[64px] w-full rounded-xl" />
              ))}
            </div>
          )}
          {!isRunsLoading && displayRuns.length === 0 && (
            <div className="text-[13px] text-muted-foreground/30 p-8 text-center rounded-2xl border border-dashed border-border/40 mt-4">
              No recent execution history.
            </div>
          )}
          {!isRunsLoading && displayRuns.length > 0 && (
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead>Run ID</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead className="text-right">Started At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRuns.map((run) => {
                    const st =
                      RUN_STATUS[run.status as keyof typeof RUN_STATUS] ||
                      RUN_STATUS.pending;
                    const pipelineName =
                      pipelineMap.get(run.pipeline_id)?.name ||
                      "Unknown Pipeline";
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
                          {pipelineName}
                        </TableCell>
                        <TableCell className="uppercase text-[11px] text-muted-foreground/80 font-semibold tracking-wider">
                          {run.trigger_type}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {run.started_at ? (
                            <>
                              <span className="font-semibold text-foreground/80 mr-2">
                                {new Date(run.started_at).toLocaleDateString(
                                  [],
                                  {
                                    month: "short",
                                    day: "numeric",
                                  },
                                )}
                              </span>
                              <span>
                                {new Date(run.started_at).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
