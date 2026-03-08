import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  GitBranch,
  MoreHorizontal,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { PIPELINE_STATUS } from "@/lib/constants";
import type { Run } from "@/types/api";
import { useState } from "react";

import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { usePipelines, useCreatePipeline } from "@/hooks/queries/usePipelines";
import { useRuns } from "@/hooks/queries/useRuns";

const RUN_STATUS_ICON = {
  succeeded: (
    <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />
  ),
  failed: (
    <AlertTriangle className="h-3.5 w-3.5 text-destructive" strokeWidth={2.5} />
  ),
  running: (
    <Loader2
      className="h-3.5 w-3.5 animate-spin text-blue-500"
      strokeWidth={2.5}
    />
  ),
  pending: (
    <Clock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.5} />
  ),
};

/* ─── Page ────────────────────────────────────────────────────── */

export function Pipelines() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";
  const navigate = useNavigate();

  const { data: pipelines, isLoading: isPipelinesLoading } =
    usePipelines(workspaceId);
  const { data: runs } = useRuns(workspaceId);
  const { mutate: createPipeline, isPending: isCreating } =
    useCreatePipeline(workspaceId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreatePipeline = (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!workspaceId || !name.trim()) return;

    createPipeline(
      {
        name: name.trim(),
        description: description.trim(),
      },
      {
        onSuccess: (newPipe) => {
          setIsModalOpen(false);
          setName("");
          setDescription("");
          navigate(`/pipelines/${newPipe.id}`);
        },
      },
    );
  };

  // Group latest run by pipeline
  const latestRunByPipeline = new Map<string, Run>();
  runs?.forEach((r) => {
    if (!latestRunByPipeline.has(r.pipeline_id)) {
      latestRunByPipeline.set(r.pipeline_id, r);
    }
  });

  return (
    <div className="fade-in p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Pipelines"
        description="Manage your data pipelines and DAGs"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New Pipeline
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {isPipelinesLoading && (
          <>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[142px] w-full" />
            ))}
          </>
        )}
        {!isPipelinesLoading && pipelines?.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border/50 p-8 text-center text-muted-foreground">
            No pipelines found. Create one to get started.
          </div>
        )}

        {pipelines?.map((pipe) => {
          const status = pipe.status || "draft";
          const ps =
            PIPELINE_STATUS[status as keyof typeof PIPELINE_STATUS] ||
            PIPELINE_STATUS.draft;
          const latestRun = latestRunByPipeline.get(pipe.id);
          const lastRunStatus = latestRun?.status || "pending";
          const lastRunLabel = latestRun ? latestRun.trigger_type : "Never";

          return (
            <Link key={pipe.id} to={`/pipelines/${pipe.id}`}>
              <Card hover className="group relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <GitBranch
                        className="h-4 w-4 text-muted-foreground"
                        strokeWidth={1.8}
                      />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors tracking-tight">
                        {pipe.name}
                      </h3>
                      <Badge
                        variant={ps.variant}
                        dot
                        className="rounded-full px-2 py-0 h-[20px] shadow-sm"
                      >
                        {ps.label}
                      </Badge>
                    </div>
                  </div>
                  <button className="rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:bg-accent group-hover:opacity-100">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>

                <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                  {pipe.description || "No description provided."}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {RUN_STATUS_ICON[
                      lastRunStatus as keyof typeof RUN_STATUS_ICON
                    ] || RUN_STATUS_ICON.pending}
                    <span>{lastRunLabel}</span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Create Pipeline Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-foreground">
                Create New Pipeline
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePipeline} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="pipeline-name"
                  className="text-[12px] font-medium text-muted-foreground"
                >
                  Pipeline Name
                </label>
                <input
                  id="pipeline-name"
                  type="text"
                  placeholder="e.g., Salesforce to Snowflake"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[13px] text-foreground focus:border-primary focus:ring-2 focus:ring-ring outline-none transition-all"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="pipeline-desc"
                  className="text-[12px] font-medium text-muted-foreground"
                >
                  Description (Optional)
                </label>
                <textarea
                  id="pipeline-desc"
                  placeholder="Describe what this pipeline does..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[13px] text-foreground focus:border-primary focus:ring-2 focus:ring-ring outline-none transition-all min-h-[80px] resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-border mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  disabled={isCreating || !name.trim()}
                >
                  {isCreating ? "Creating..." : "Create Pipeline"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
