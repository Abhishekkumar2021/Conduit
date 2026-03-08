import {
  GitBranch,
  Play,
  Plug,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Activity,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
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

  return (
    <div className="fade-in p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        description="Overview of your data platform"
        actions={
          <Button variant="primary" size="sm">
            <Play className="h-3.5 w-3.5" />
            Run Pipeline
          </Button>
        }
      />

      {/* Stats Grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total Pipelines"
          value={totalPipelines}
          icon={<GitBranch className="h-4 w-4" />}
        />
        <StatCard
          label="Active Runs"
          value={activeRuns}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Integrations"
          value={totalIntegrations}
          icon={<Plug className="h-4 w-4" />}
        />
        <StatCard
          label="Success Rate"
          value={
            runs && runs.length > 0
              ? `${Math.round((runs.filter((r) => r.status === "succeeded").length / runs.length) * 100)}%`
              : "N/A"
          }
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Recent Runs */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground/50">
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
                          {pipelineName}
                        </TableCell>
                        <TableCell className="uppercase text-[11px] text-muted-foreground/80 font-semibold tracking-wider">
                          {run.trigger_type}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
