import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  GitBranch,
  Play,
  Plug,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Activity,
  Database,
  ArrowRight,
  BarChart3,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
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
import {
  useWorkspaceSummary,
  useRunTrend,
  usePipelineStats,
  useThroughput,
} from "@/hooks/useMetrics";
import type { Run, PipelineStat, RunTrendPoint } from "@/types/api";

const CHART = { succeeded: "#10b981", failed: "#ef4444" };
const DONUT = [
  { key: "succeeded", color: "#10b981" },
  { key: "failed", color: "#ef4444" },
  { key: "other", color: "#e2e2e6" },
];
const TREND_DAYS = 14;
const THROUGHPUT_DAYS = 7;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024)
    return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function chartDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function runTrendFromRuns(runs: Run[] | undefined): RunTrendPoint[] {
  if (!runs?.length) return [];
  const dateMap = new Map<
    string,
    { succeeded: number; failed: number; total: number }
  >();
  runs.forEach((run) => {
    if (!run.started_at) return;
    const key = run.started_at.slice(0, 10);
    const entry = dateMap.get(key) ?? { succeeded: 0, failed: 0, total: 0 };
    entry.total += 1;
    if (run.status === "succeeded") entry.succeeded += 1;
    if (run.status === "failed") entry.failed += 1;
    dateMap.set(key, entry);
  });
  return Array.from(dateMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-TREND_DAYS);
}

function pipelineStatsFromRuns(
  runs: Run[] | undefined,
  pipelineNameById: Map<string, string>,
  pipelineStatusById: Map<string, string>,
): PipelineStat[] {
  if (!runs?.length) return [];
  const byPipeline = new Map<string, Run[]>();
  runs.forEach((r) => {
    const list = byPipeline.get(r.pipeline_id) ?? [];
    list.push(r);
    byPipeline.set(r.pipeline_id, list);
  });
  return Array.from(byPipeline.entries())
    .map(([pipeline_id, pruns]) => {
      const succeeded = pruns.filter((r) => r.status === "succeeded").length;
      const failed = pruns.filter((r) => r.status === "failed").length;
      const durations = pruns
        .map((r) => r.duration_ms)
        .filter((d): d is number => d != null && d >= 0);
      const avg_duration_ms =
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null;
      const sorted = [...pruns]
        .filter((r) => r.started_at)
        .sort(
          (a, b) =>
            new Date(b.started_at!).getTime() -
            new Date(a.started_at!).getTime(),
        );
      return {
        pipeline_id,
        name: pipelineNameById.get(pipeline_id) ?? "Unknown",
        status: pipelineStatusById.get(pipeline_id) ?? "—",
        total_runs: pruns.length,
        succeeded,
        failed,
        avg_duration_ms,
        last_run_at: sorted[0]?.started_at ?? null,
      };
    })
    .sort((a, b) => b.total_runs - a.total_runs);
}

function successRatePercent(succeeded: number, total: number): string {
  if (total <= 0) return "N/A";
  return `${Math.round((succeeded / total) * 100)}%`;
}

function runs7dSuccessFromRuns(runs: Run[] | undefined): string {
  if (!runs?.length) return "N/A";
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = runs.filter(
    (r) => r.started_at && new Date(r.started_at).getTime() >= cutoff,
  );
  const total = recent.length;
  const succeeded = recent.filter((r) => r.status === "succeeded").length;
  return successRatePercent(succeeded, total);
}

function statusMeta(status: string) {
  return (
    RUN_STATUS[status as keyof typeof RUN_STATUS] ?? {
      variant: "default" as const,
      label: status.replace(/_/g, " "),
    }
  );
}

function SectionHeader({
  title,
  icon,
  action,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: { label: string; to: string };
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">
        {icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
      </div>
      {action && (
        <Link
          to={action.to}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors group"
        >
          {action.label}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function SuccessDonut({ succeeded, failed, other }: { succeeded: number; failed: number; other: number }) {
  const total = succeeded + failed + other;
  const rate = total > 0 ? Math.round((succeeded / total) * 100) : 0;
  const data = [
    { name: "Succeeded", value: succeeded || 0 },
    { name: "Failed", value: failed || 0 },
    { name: "Other", value: other || (total === 0 ? 1 : 0) },
  ];

  return (
    <div className="relative flex items-center justify-center">
      <PieChart width={120} height={120}>
        <Pie
          data={data}
          cx={60}
          cy={60}
          innerRadius={38}
          outerRadius={52}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
          startAngle={90}
          endAngle={-270}
        >
          {data.map((_, i) => (
            <Cell key={DONUT[i].key} fill={DONUT[i].color} />
          ))}
        </Pie>
      </PieChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums">{total > 0 ? `${rate}%` : "—"}</span>
        <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">success</span>
      </div>
    </div>
  );
}

function ThroughputMeter({ label, value, maxValue }: { label: string; value: number; maxValue: number }) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-sm font-bold tabular-nums">{value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-linear-to-r from-primary to-violet-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";

  const { data: pipelines } = usePipelines(workspaceId);
  const { data: runs, isLoading: runsLoading } = useRuns(workspaceId);
  const { data: integrations } = useIntegrations(workspaceId);

  const { data: summary, isLoading: summaryLoading } =
    useWorkspaceSummary(workspaceId);
  const { data: trendApi, isLoading: trendLoading } = useRunTrend(
    workspaceId,
    TREND_DAYS,
  );
  const { data: pipelineStatsApi, isLoading: pipelineStatsLoading } =
    usePipelineStats(workspaceId);
  const { data: throughput, isLoading: throughputLoading } = useThroughput(
    workspaceId,
    THROUGHPUT_DAYS,
  );

  const pipelineNameById = useMemo(
    () => new Map(pipelines?.map((p) => [p.id, p.name]) ?? []),
    [pipelines],
  );
  const pipelineStatusById = useMemo(
    () => new Map(pipelines?.map((p) => [p.id, p.status]) ?? []),
    [pipelines],
  );

  const fallbackTrend = useMemo(() => runTrendFromRuns(runs), [runs]);
  const chartSeries = useMemo(() => {
    const raw = trendApi && trendApi.length > 0 ? trendApi : fallbackTrend;
    return raw.map((p) => ({
      ...p,
      label: chartDateLabel(p.date),
    }));
  }, [trendApi, fallbackTrend]);

  const fallbackPipelineStats = useMemo(
    () => pipelineStatsFromRuns(runs, pipelineNameById, pipelineStatusById),
    [runs, pipelineNameById, pipelineStatusById],
  );

  const pipelineRows = useMemo(() => {
    const rows =
      pipelineStatsApi && pipelineStatsApi.length > 0
        ? [...pipelineStatsApi]
        : fallbackPipelineStats;
    return rows.sort((a, b) => b.total_runs - a.total_runs);
  }, [pipelineStatsApi, fallbackPipelineStats]);

  const totalPipelines = summary?.pipelines ?? pipelines?.length ?? 0;
  const activeRuns =
    summary?.runs_24h.running ??
    (runs?.filter((r) => r.status === "running" || r.status === "queued")
      .length ?? 0);
  const totalIntegrations =
    summary?.integrations ?? integrations?.length ?? 0;
  const successRate =
    summary && summary.runs_7d.total > 0
      ? successRatePercent(summary.runs_7d.succeeded, summary.runs_7d.total)
      : runs7dSuccessFromRuns(runs);

  const recentRuns = useMemo(() => {
    if (!runs?.length) return [];
    return [...runs]
      .sort((a, b) => {
        const ta = a.started_at ? new Date(a.started_at).getTime() : 0;
        const tb = b.started_at ? new Date(b.started_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 5);
  }, [runs]);

  const runsSucceeded = useMemo(() => runs?.filter(r => r.status === "succeeded").length ?? 0, [runs]);
  const runsFailed = useMemo(() => runs?.filter(r => r.status === "failed").length ?? 0, [runs]);
  const runsOther = useMemo(() => (runs?.length ?? 0) - runsSucceeded - runsFailed, [runs, runsSucceeded, runsFailed]);

  const showStatSkeleton =
    workspacesLoading ||
    (!!workspaceId && summaryLoading && summary == null && pipelines == null);

  const showChartSkeleton =
    !!workspaceId && trendLoading && chartSeries.length === 0;
  const showThroughputSkeleton =
    !!workspaceId && throughputLoading && throughput == null;
  const showPipelineTableSkeleton =
    !!workspaceId && pipelineStatsLoading && pipelineRows.length === 0;

  const hasWorkspace = Boolean(workspaceId);
  const noWorkspaces =
    !workspacesLoading && workspaces && workspaces.length === 0;

  const throughputMax = Math.max(
    throughput?.total_records_in ?? 0,
    throughput?.total_records_out ?? 0,
    throughput?.total_records_failed ?? 0,
    1,
  );

  return (
    <div className="fade-in max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of your data platform"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate("/pipelines")}
          >
            <Sparkles className="h-3.5 w-3.5" />
            New Pipeline
          </Button>
        }
      />

      {noWorkspaces && (
        <Card className="p-12 text-center border-dashed border-border">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary/10 to-violet-500/10 text-primary">
              <BarChart3 className="h-7 w-7" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No workspace yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a workspace to see metrics and activity.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate("/settings")}
            >
              <Zap className="h-3.5 w-3.5" />
              Get Started
            </Button>
          </div>
        </Card>
      )}

      {!noWorkspaces && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {showStatSkeleton ? (
              [1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[110px] w-full rounded-2xl" />
              ))
            ) : (
              <>
                <div className="cursor-pointer" onClick={() => navigate("/pipelines")}>
                  <StatCard
                    label="Pipelines"
                    value={totalPipelines}
                    icon={<GitBranch className="h-4.5 w-4.5" />}
                    color="blue"
                  />
                </div>
                <div className="cursor-pointer" onClick={() => navigate("/runs")}>
                  <StatCard
                    label="Active Runs"
                    value={activeRuns}
                    icon={<Activity className="h-4.5 w-4.5" />}
                    color="violet"
                  />
                </div>
                <div className="cursor-pointer" onClick={() => navigate("/integrations")}>
                  <StatCard
                    label="Integrations"
                    value={totalIntegrations}
                    icon={<Plug className="h-4.5 w-4.5" />}
                    color="emerald"
                  />
                </div>
                <div className="cursor-pointer" onClick={() => navigate("/runs")}>
                  <StatCard
                    label="Success Rate"
                    value={successRate}
                    icon={<TrendingUp className="h-4.5 w-4.5" />}
                    color="amber"
                  />
                </div>
              </>
            )}
          </div>

          {/* Charts Row */}
          {hasWorkspace && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              {/* Run Trend Chart */}
              <Card className="lg:col-span-7 p-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <BarChart3 className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-sm font-bold">Run Trend</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-muted-foreground">Succeeded</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="text-[10px] text-muted-foreground">Failed</span>
                    </div>
                  </div>
                </div>
                {showChartSkeleton ? (
                  <Skeleton className="h-[220px] w-full rounded-xl" />
                ) : chartSeries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[220px] gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <p className="text-xs text-muted-foreground">No run history yet</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart
                      data={chartSeries}
                      margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="dashSuccessGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART.succeeded} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={CHART.succeeded} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="dashFailGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART.failed} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={CHART.failed} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        opacity={0.3}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        padding={{ left: 4, right: 4 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        allowDecimals={false}
                        width={30}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 14,
                          fontSize: 12,
                          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                          padding: "8px 12px",
                        }}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.date ?? ""
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="succeeded"
                        stroke={CHART.succeeded}
                        strokeWidth={2.5}
                        fill="url(#dashSuccessGrad)"
                        dot={false}
                        activeDot={{
                          r: 5,
                          strokeWidth: 2,
                          stroke: "var(--card)",
                          fill: CHART.succeeded,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="failed"
                        stroke={CHART.failed}
                        strokeWidth={2.5}
                        fill="url(#dashFailGrad)"
                        dot={false}
                        activeDot={{
                          r: 5,
                          strokeWidth: 2,
                          stroke: "var(--card)",
                          fill: CHART.failed,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Card>

              {/* Success Donut + Throughput */}
              <Card className="lg:col-span-5 p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Database className="h-3.5 w-3.5" />
                    </div>
                    <h3 className="text-sm font-bold">Health</h3>
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Last {throughput?.period_days ?? THROUGHPUT_DAYS}d
                  </span>
                </div>

                {showThroughputSkeleton ? (
                  <div className="space-y-3 flex-1">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-5">
                    <div className="flex items-center gap-5">
                      <SuccessDonut succeeded={runsSucceeded} failed={runsFailed} other={runsOther} />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            Succeeded
                          </span>
                          <span className="font-bold tabular-nums">{runsSucceeded}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                            Failed
                          </span>
                          <span className="font-bold tabular-nums">{runsFailed}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-border" />
                            Other
                          </span>
                          <span className="font-bold tabular-nums">{runsOther}</span>
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-border" />

                    <div className="space-y-3 flex-1">
                      <ThroughputMeter
                        label="Records In"
                        value={throughput?.total_records_in ?? 0}
                        maxValue={throughputMax}
                      />
                      <ThroughputMeter
                        label="Records Out"
                        value={throughput?.total_records_out ?? 0}
                        maxValue={throughputMax}
                      />
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-muted-foreground">Bytes Processed</span>
                        <span className="font-bold tabular-nums">{formatBytes(throughput?.total_bytes_processed ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Pipeline Performance */}
          {hasWorkspace && (
            <div>
              <SectionHeader
                title="Pipeline Performance"
                icon={<GitBranch className="h-3.5 w-3.5" />}
                action={{ label: "View all", to: "/pipelines" }}
              />
              {showPipelineTableSkeleton ? (
                <Skeleton className="h-[200px] w-full rounded-2xl" />
              ) : pipelineRows.length === 0 ? (
                <Card className="border-dashed py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                      <GitBranch className="h-5 w-5" />
                    </div>
                    <p className="text-sm text-muted-foreground">No pipeline runs yet.</p>
                  </div>
                </Card>
              ) : (
                <Card padding={false} className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 pl-5">#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Runs</TableHead>
                        <TableHead className="text-right">Success</TableHead>
                        <TableHead className="text-right">Avg Duration</TableHead>
                        <TableHead className="text-right pr-5">Last Run</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pipelineRows.map((row, idx) => {
                        const rate =
                          row.total_runs > 0
                            ? Math.round((row.succeeded / row.total_runs) * 100)
                            : 0;
                        return (
                          <TableRow
                            key={row.pipeline_id}
                            onClick={() =>
                              navigate(`/pipelines/${row.pipeline_id}`)
                            }
                            className="cursor-pointer group"
                          >
                            <TableCell className="text-sm font-medium tabular-nums text-muted-foreground pl-5">
                              {idx + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                  {row.name}
                                </span>
                                <span className="text-[11px] text-muted-foreground capitalize">
                                  {row.status}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold tabular-nums">
                              {row.total_runs.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center gap-2">
                                <div className="h-1.5 w-12 rounded-full bg-secondary overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      rate >= 90
                                        ? "bg-emerald-500"
                                        : rate >= 70
                                          ? "bg-amber-500"
                                          : "bg-red-500"
                                    }`}
                                    style={{ width: `${rate}%` }}
                                  />
                                </div>
                                <span
                                  className={`text-sm font-bold tabular-nums ${
                                    rate >= 90
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : rate >= 70
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-red-600 dark:text-red-400"
                                  }`}
                                >
                                  {rate}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                              {formatDuration(row.avg_duration_ms)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground pr-5">
                              {row.last_run_at ? (
                                <span className="tabular-nums">
                                  {formatDistanceToNow(
                                    new Date(row.last_run_at),
                                    { addSuffix: true },
                                  )}
                                </span>
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
          )}

          {/* Recent Runs */}
          {hasWorkspace && (
            <div>
              <SectionHeader
                title="Recent Runs"
                icon={<Play className="h-3.5 w-3.5" />}
                action={{ label: "View all", to: "/runs" }}
              />
              {runsLoading && (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-[52px] w-full rounded-2xl" />
                  ))}
                </div>
              )}
              {!runsLoading && recentRuns.length === 0 && (
                <Card className="border-dashed py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                      <Play className="h-5 w-5" />
                    </div>
                    <p className="text-sm text-muted-foreground">No recent execution history.</p>
                  </div>
                </Card>
              )}
              {!runsLoading && recentRuns.length > 0 && (
                <Card padding={false} className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px] pl-5">Status</TableHead>
                        <TableHead>Run ID</TableHead>
                        <TableHead>Pipeline</TableHead>
                        <TableHead>Trigger</TableHead>
                        <TableHead className="text-right pr-5">Started</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentRuns.map((run) => {
                        const st = statusMeta(run.status);
                        const pipelineName =
                          pipelineNameById.get(run.pipeline_id) ??
                          "Unknown Pipeline";
                        return (
                          <TableRow
                            key={run.id}
                            onClick={() => navigate(`/runs/${run.id}`)}
                            className="cursor-pointer group"
                          >
                            <TableCell className="pl-5">
                              <div className="flex items-center gap-2">
                                {run.status === "succeeded" && (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                )}
                                {run.status === "failed" && (
                                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                                )}
                                {(run.status === "running" ||
                                  run.status === "queued") && (
                                  <Activity className="h-4 w-4 animate-pulse text-primary shrink-0" />
                                )}
                                {(run.status === "pending" ||
                                  run.status === "cancelled") && (
                                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                                <Badge variant={st.variant} dot>
                                  {st.label}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                              #{run.id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                              {pipelineName}
                            </TableCell>
                            <TableCell>
                              <Badge variant="default">{run.trigger_type}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground pr-5">
                              {run.started_at ? (
                                <span className="tabular-nums">
                                  {formatDistanceToNow(
                                    new Date(run.started_at),
                                    { addSuffix: true },
                                  )}
                                </span>
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
          )}
        </>
      )}
    </div>
  );
}
