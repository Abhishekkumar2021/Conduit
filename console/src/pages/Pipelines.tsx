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
  Pencil,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import { PIPELINE_STATUS } from "@/lib/constants";
import { useState } from "react";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import {
  usePipelines,
  useCreatePipeline,
  useUpdatePipeline,
  useDeletePipeline,
} from "@/hooks/queries/usePipelines";
import { useRuns } from "@/hooks/queries/useRuns";
import type { Run, Pipeline } from "@/types/api";

const RUN_STATUS_ICON = {
  succeeded: (
    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />
  ),
  failed: (
    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" strokeWidth={2.5} />
  ),
  running: (
    <Loader2
      className="h-3.5 w-3.5 animate-spin text-primary"
      strokeWidth={2.5}
    />
  ),
  pending: (
    <Clock className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={2.5} />
  ),
};

export function Pipelines() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";
  const navigate = useNavigate();

  const { data: pipelines, isLoading: isPipelinesLoading } =
    usePipelines(workspaceId);
  const { data: runs } = useRuns(workspaceId);
  const { mutate: createPipeline, isPending: isCreating } =
    useCreatePipeline(workspaceId);
  const { mutate: updatePipeline, isPending: isUpdating } =
    useUpdatePipeline(workspaceId);
  const { mutate: deletePipeline } = useDeletePipeline(workspaceId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSavePipeline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !name.trim()) return;

    if (editingPipeline) {
      updatePipeline(
        {
          id: editingPipeline.id,
          data: { name: name.trim(), description: description.trim() },
        },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setEditingPipeline(null);
            setName("");
            setDescription("");
          },
        },
      );
    } else {
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
    }
  };

  const openEditMode = (e: React.MouseEvent, pipe: Pipeline) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingPipeline(pipe);
    setName(pipe.name);
    setDescription(pipe.description || "");
    setIsModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this pipeline?")) {
      deletePipeline(id);
    }
  };

  // Group latest run by pipeline
  const latestRunByPipeline = new Map<string, Run>();
  runs?.forEach((r) => {
    if (!latestRunByPipeline.has(r.pipeline_id)) {
      latestRunByPipeline.set(r.pipeline_id, r);
    }
  });

  return (
    <div className="fade-in p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Pipelines"
        description="Manage your data pipelines and DAGs"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingPipeline(null);
              setName("");
              setDescription("");
              setIsModalOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New Pipeline
          </Button>
        }
      />

      <div className="max-w-7xl grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <Card
                hover
                className="group relative border-border/60 hover:border-primary/20 transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/30 border border-border/20 shadow-xs">
                      <GitBranch
                        className="h-5 w-5 text-muted-foreground/60"
                        strokeWidth={2}
                      />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-foreground/90 group-hover:text-primary transition-colors tracking-tight">
                        {pipe.name}
                      </h3>
                      <Badge
                        variant={ps.variant}
                        dot
                        className="mt-1 rounded-lg px-2 py-0.5 h-4.5 text-[9px] font-bold tracking-tight border border-border/50 bg-muted/15 text-foreground/50"
                      >
                        {ps.label}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      onClick={(e) => e.preventDefault()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => openEditMode(e, pipe)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="danger"
                        onClick={(e) => handleDelete(e, pipe.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete Pipeline
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground/70 line-clamp-2 min-h-[32px] font-medium">
                  {pipe.description || "No description provided."}
                </p>

                <div className="mt-5 flex items-center justify-between border-t border-border/30 pt-4 text-[11px] text-muted-foreground/60">
                  <div className="flex items-center gap-2 font-bold tracking-tight">
                    {RUN_STATUS_ICON[
                      lastRunStatus as keyof typeof RUN_STATUS_ICON
                    ] || RUN_STATUS_ICON.pending}
                    <span className="capitalize">{lastRunLabel} run</span>
                  </div>
                  <span className="font-bold tabular-nums">
                    ID: {pipe.id.slice(0, 8)}
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Create/Edit Pipeline Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-background/50 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => {
              setIsModalOpen(false);
              setEditingPipeline(null);
            }}
          />
          <div className="relative w-full max-w-lg bg-card shadow-2xl rounded-[32px] border border-border/50 p-7 sm:p-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  {editingPipeline ? "Edit Pipeline" : "New Pipeline"}
                </h2>
                <p className="text-[12px] text-muted-foreground/50 font-medium">
                  Define your data workflow parameters
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingPipeline(null);
                }}
                className="rounded-full p-2 text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePipeline} className="space-y-8">
              <div className="space-y-3">
                <label
                  htmlFor="pipeline-name"
                  className="text-[13px] font-bold text-foreground/80 ml-1 tracking-tight"
                >
                  Pipeline Name
                </label>
                <input
                  id="pipeline-name"
                  type="text"
                  placeholder="e.g., Warehouse Sync"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-muted/10 px-4 py-3 text-[14px] text-foreground focus:border-primary/40 focus:bg-background focus:ring-4 focus:ring-primary/5 outline-none transition-all placeholder:text-muted-foreground/30 font-medium"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-3">
                <label
                  htmlFor="pipeline-desc"
                  className="text-[13px] font-bold text-foreground/80 ml-1 tracking-tight"
                >
                  Description
                </label>
                <textarea
                  id="pipeline-desc"
                  placeholder="What is the purpose of this pipeline?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-muted/10 px-4 py-3 text-[14px] text-foreground focus:border-primary/40 focus:bg-background focus:ring-4 focus:ring-primary/5 outline-none transition-all min-h-[100px] resize-none placeholder:text-muted-foreground/30 font-medium custom-scrollbar"
                />
              </div>

              <div className="flex items-center gap-4 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  className="h-12 w-full rounded-xl text-[14px] font-bold shadow-lg shadow-primary/5 hover:scale-[1.01] active:scale-[0.99] transition-all"
                  disabled={isCreating || isUpdating || !name.trim()}
                >
                  {isCreating || isUpdating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  {editingPipeline ? "Save Changes" : "Create Pipeline"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
