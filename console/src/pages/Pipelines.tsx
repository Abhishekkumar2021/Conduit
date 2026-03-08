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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
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
    <CheckCircle2 className="h-4 w-4 text-emerald-500" strokeWidth={2.5} />
  ),
  failed: (
    <AlertTriangle className="h-4 w-4 text-rose-500" strokeWidth={2.5} />
  ),
  running: (
    <Loader2
      className="h-4 w-4 animate-spin text-primary"
      strokeWidth={2.5}
    />
  ),
  pending: (
    <Clock className="h-4 w-4 text-muted-foreground/60" strokeWidth={2.5} />
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
    <div className="fade-in p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
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

      <div>
        {isPipelinesLoading && (
          <div className="space-y-2 mt-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[64px] w-full rounded-lg" />
            ))}
          </div>
        )}
        {!isPipelinesLoading && pipelines?.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/50 p-8 text-center text-muted-foreground mt-4">
            No pipelines found. Create one to get started.
          </div>
        )}
        {!isPipelinesLoading && pipelines && pipelines.length > 0 && (
          <div className="mt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Pipeline Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Pipeline ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pipelines.map((pipe) => {
                  const status = pipe.status || "draft";
                  const ps =
                    PIPELINE_STATUS[status as keyof typeof PIPELINE_STATUS] ||
                    PIPELINE_STATUS.draft;
                  const latestRun = latestRunByPipeline.get(pipe.id);
                  const lastRunStatus = latestRun?.status || "pending";
                  const lastRunLabel = latestRun ? latestRun.trigger_type : "Never";

                  return (
                    <TableRow
                      key={pipe.id}
                      onClick={() => navigate(`/pipelines/${pipe.id}`)}
                      className="cursor-pointer group"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5 border border-primary/10 shrink-0">
                            <GitBranch
                              className="h-4 w-4 text-primary/60"
                              strokeWidth={2}
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {pipe.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground/70 line-clamp-1 max-w-[200px]">
                              {pipe.description || "No description provided."}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={ps.variant}
                          dot
                          className="px-1.5 py-0 h-4 text-[10px] font-bold rounded-md bg-transparent border-none"
                        >
                          {ps.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {RUN_STATUS_ICON[
                            lastRunStatus as keyof typeof RUN_STATUS_ICON
                          ] || RUN_STATUS_ICON.pending}
                          <span className="text-[12px] font-medium capitalize text-muted-foreground">
                            {lastRunLabel}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {pipe.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground/60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
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
          <div className="relative w-full max-w-lg bg-card shadow-2xl rounded-2xl border border-border/50 p-7 sm:p-10 animate-in zoom-in-95 duration-200">
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

            <form onSubmit={handleSavePipeline} className="space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="pipeline-name"
                  className="text-[13px] font-bold text-foreground/80 ml-1 tracking-tight"
                >
                  Pipeline Name
                </label>
                <Input
                  id="pipeline-name"
                  type="text"
                  placeholder="e.g., Warehouse Sync"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="pipeline-desc"
                  className="text-[13px] font-bold text-foreground/80 ml-1 tracking-tight"
                >
                  Description
                </label>
                <Textarea
                  id="pipeline-desc"
                  placeholder="What is the purpose of this pipeline?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
              </div>

              <div className="flex items-center gap-4 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  className="h-11 w-full text-[14px] font-bold shadow-lg shadow-primary/10"
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
