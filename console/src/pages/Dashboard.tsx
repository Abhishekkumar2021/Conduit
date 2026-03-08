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
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { RUN_STATUS } from "@/lib/constants";

import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { usePipelines } from "@/hooks/queries/usePipelines";
import { useRuns } from "@/hooks/queries/useRuns";
import { useIntegrations } from "@/hooks/queries/useIntegrations";

/* ─── Page ────────────────────────────────────────────────────── */

export function Dashboard() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";

  const { data: pipelines } = usePipelines(workspaceId);
  const { data: runs, isLoading: isRunsLoading } = useRuns(workspaceId);
  const { data: integrations } = useIntegrations(workspaceId);

  const pipelineMap = new Map(pipelines?.map((p) => [p.id, p]));

  const totalPipelines = pipelines?.length || 0;
  const activeRuns = runs?.filter((r) => r.status === "running").length || 0;
  const totalIntegrations = integrations?.length || 0;
  const displayRuns = runs?.slice(0, 5) || [];

  return (
    <div className="fade-in p-4 sm:p-6 lg:p-8">
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Runs</h2>
          <Link
            to="/runs"
            className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View All <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {isRunsLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[68px] w-full" />
              ))}
            </div>
          )}
          {!isRunsLoading && displayRuns.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center rounded-lg border border-dashed border-border/50">
              No recent run activity found.
            </p>
          )}
          {displayRuns.map((run) => {
            const st =
              RUN_STATUS[run.status as keyof typeof RUN_STATUS] ||
              RUN_STATUS.pending;
            const pipelineName =
              pipelineMap.get(run.pipeline_id)?.name || "Unknown Pipeline";
            return (
              <Card key={run.id} hover className="p-4 sm:p-5">
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/20 border border-border/10">
                    {run.status === "succeeded" && (
                      <CheckCircle2
                        className="h-4.5 w-4.5 text-emerald-500"
                        strokeWidth={2}
                      />
                    )}
                    {run.status === "failed" && (
                      <AlertTriangle
                        className="h-4.5 w-4.5 text-rose-500"
                        strokeWidth={2}
                      />
                    )}
                    {run.status === "running" && (
                      <Loader2
                        className="h-4.5 w-4.5 animate-spin text-primary"
                        strokeWidth={2}
                      />
                    )}
                    {run.status === "pending" && (
                      <Clock
                        className="h-4.5 w-4.5 text-muted-foreground/30"
                        strokeWidth={2}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground tracking-tight">
                      {pipelineName}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-[11px] font-medium text-muted-foreground/60">
                      <span className="flex items-center gap-1.5 capitalize tracking-wide">
                        <Clock className="h-3 w-3" />
                        {run.trigger_type} trigger
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={st.variant}
                      dot
                      className="px-1.5 py-0 h-4 text-[9px] font-bold rounded-lg bg-transparent border-none"
                    >
                      {st.label}
                    </Badge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
