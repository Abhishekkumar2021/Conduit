import { useNavigate } from "react-router-dom";
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
  Search,
  LayoutGrid,
  List,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
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
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/AlertDialog";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { useQueryAction } from "@/hooks/useQueryAction";
import {
  usePipelines,
  useCreatePipeline,
  useUpdatePipeline,
  useDeletePipeline,
} from "@/hooks/queries/usePipelines";
import { useRuns } from "@/hooks/queries/useRuns";
import type { Run, Pipeline } from "@/types/api";

type ViewMode = "grid" | "list";

const RUN_STATUS_ICON = {
  succeeded: (
    <CheckCircle2 className="h-4 w-4 text-emerald-500" strokeWidth={2.5} />
  ),
  failed: <AlertTriangle className="h-4 w-4 text-red-500" strokeWidth={2.5} />,
  running: (
    <Loader2 className="h-4 w-4 animate-spin text-primary" strokeWidth={2.5} />
  ),
  pending: (
    <Clock className="h-4 w-4 text-muted-foreground" strokeWidth={2.5} />
  ),
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500",
  paused: "bg-amber-500",
  draft: "bg-zinc-400",
  archived: "bg-zinc-300",
};

/* Status icons mapping for potential future use */

/* ─── Pipeline Dialog Sub-component ───────────────────────────── */

interface PipelineDialogProps {
  pipeline: Pipeline | null;
  onClose: () => void;
  workspaceId: string;
}

function PipelineDialog({
  pipeline,
  onClose,
  workspaceId,
}: PipelineDialogProps) {
  const navigate = useNavigate();
  const { mutate: createPipeline, isPending: isCreating } =
    useCreatePipeline(workspaceId);
  const { mutate: updatePipeline, isPending: isUpdating } =
    useUpdatePipeline(workspaceId);

  const [formState, setFormState] = useState({
    name: pipeline?.name ?? "",
    description: pipeline?.description ?? "",
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !formState.name.trim()) return;

    if (pipeline) {
      updatePipeline(
        {
          id: pipeline.id,
          data: {
            name: formState.name.trim(),
            description: formState.description.trim(),
          },
        },
        { onSuccess: onClose },
      );
    } else {
      createPipeline(
        {
          name: formState.name.trim(),
          description: formState.description.trim(),
        },
        {
          onSuccess: (newPipe) => {
            onClose();
            navigate(`/pipelines/${newPipe.id}`);
          },
        },
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-card shadow-2xl shadow-black/20 rounded-xl border border-border p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {pipeline ? "Edit Pipeline" : "New Pipeline"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Define your data workflow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="pipeline-name"
              className="text-[13px] font-medium text-foreground"
            >
              Name
            </label>
            <Input
              id="pipeline-name"
              type="text"
              placeholder="e.g., Warehouse Sync"
              value={formState.name}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, name: e.target.value }))
              }
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="pipeline-desc"
              className="text-[13px] font-medium text-foreground"
            >
              Description
            </label>
            <Textarea
              id="pipeline-desc"
              placeholder="What is the purpose of this pipeline?"
              value={formState.description}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="min-h-[100px] resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="h-9 px-5"
              disabled={isCreating || isUpdating || !formState.name.trim()}
            >
              {isCreating || isUpdating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : null}
              {pipeline ? "Save Changes" : "Create Pipeline"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */

export function Pipelines() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";
  const navigate = useNavigate();

  const { data: pipelines, isLoading: isPipelinesLoading } =
    usePipelines(workspaceId);
  const { data: runs } = useRuns(workspaceId);
  const { mutate: deletePipeline, isPending: isDeleting } =
    useDeletePipeline(workspaceId);

  const { action, getParam, setParams, clearParams } = useQueryAction();
  const editId = getParam("id");

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const editingPipeline = useMemo(() => {
    if (action === "edit" && editId && pipelines) {
      return pipelines.find((p) => p.id === editId) || null;
    }
    return null;
  }, [action, editId, pipelines]);

  const isModalOpen = action === "create" || (action === "edit" && !!editId);

  const closeModal = () => clearParams(["action", "id"]);
  const openCreateModal = () => setParams({ action: "create", id: null });
  const openEditMode = (e: React.MouseEvent, pipe: Pipeline) => {
    e.preventDefault();
    e.stopPropagation();
    setParams({ action: "edit", id: pipe.id });
  };

  const latestRunByPipeline = new Map<string, Run>();
  runs?.forEach((r) => {
    if (!latestRunByPipeline.has(r.pipeline_id)) {
      latestRunByPipeline.set(r.pipeline_id, r);
    }
  });

  const filtered = useMemo(() => {
    return (pipelines || []).filter((p) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.description || "").toLowerCase().includes(q)
        )
          return false;
      }
      if (statusFilter && (p.status || "draft") !== statusFilter) return false;
      return true;
    });
  }, [pipelines, searchTerm, statusFilter]);

  const hasFilters = Boolean(searchTerm || statusFilter);

  return (
    <div className="fade-in space-y-6 max-w-7xl mx-auto p-6 lg:p-8">
      <PageHeader
        title="Pipelines"
        description="Manage your data pipelines and DAGs"
        actions={
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="h-3.5 w-3.5" />
            New Pipeline
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Search pipelines..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-[13px]"
          />
        </div>

        <div className="w-[140px]">
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-9 text-[13px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <button
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("");
            }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
          >
            <XCircle className="h-3.5 w-3.5" />
            Clear
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-muted-foreground font-medium mr-2 tabular-nums">
            {filtered.length} pipeline{filtered.length !== 1 ? "s" : ""}
          </span>
          <div className="flex rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 transition-all duration-200",
                viewMode === "grid"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 transition-all duration-200 border-l border-border",
                viewMode === "list"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isPipelinesLoading && (
        <div
          className={cn(
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-2",
          )}
        >
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              className={cn(
                "rounded-xl",
                viewMode === "grid" ? "h-[160px]" : "h-[64px]",
              )}
            />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isPipelinesLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GitBranch className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">
            {hasFilters ? "No matching pipelines" : "No pipelines yet"}
          </h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
            {hasFilters
              ? "Try adjusting your search or filters."
              : "Create your first pipeline to start orchestrating data flows."}
          </p>
          {!hasFilters && (
            <Button
              variant="primary"
              size="sm"
              className="mt-5"
              onClick={openCreateModal}
            >
              <Plus className="h-3.5 w-3.5" /> New Pipeline
            </Button>
          )}
        </div>
      )}

      {/* Grid View */}
      {!isPipelinesLoading && filtered.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((pipe) => {
            const status = pipe.status || "draft";
            const ps =
              PIPELINE_STATUS[status as keyof typeof PIPELINE_STATUS] ||
              PIPELINE_STATUS.draft;
            const latestRun = latestRunByPipeline.get(pipe.id);
            const lastRunStatus = latestRun?.status || "pending";

            return (
              <Card
                key={pipe.id}
                hover
                className="group relative overflow-hidden"
                onClick={() => navigate(`/pipelines/${pipe.id}`)}
              >
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/3 pointer-events-none" />
                <div className="flex items-start justify-between mb-3 relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-primary/10 to-violet-500/10 text-primary shrink-0 transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/10">
                    <GitBranch className="h-5 w-5" />
                  </div>
                  <div
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                        >
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => openEditMode(e, pipe)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              variant="danger"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Delete Pipeline
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete pipeline?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete &quot;{pipe.name}
                                &quot; and all its execution history.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                variant="danger"
                                disabled={isDeleting}
                                onClick={() => deletePipeline(pipe.id)}
                              >
                                {isDeleting && (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                )}
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {pipe.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed min-h-8">
                    {pipe.description || "No description provided."}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          STATUS_DOT[status] || "bg-zinc-400",
                        )}
                      />
                      <Badge variant={ps.variant} className="text-[11px]">
                        {ps.label}
                      </Badge>
                    </div>
                    {latestRun && (
                      <div className="flex items-center gap-1">
                        {RUN_STATUS_ICON[
                          lastRunStatus as keyof typeof RUN_STATUS_ICON
                        ] || RUN_STATUS_ICON.pending}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* List View */}
      {!isPipelinesLoading && filtered.length > 0 && viewMode === "list" && (
        <Card padding={false} className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px] pl-5">Pipeline Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Pipeline ID</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((pipe) => {
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
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                        <GitBranch
                          className="h-4 w-4 text-primary"
                          strokeWidth={2}
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {pipe.name}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                          {pipe.description || "No description provided."}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ps.variant} dot>
                      {ps.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {RUN_STATUS_ICON[
                        lastRunStatus as keyof typeof RUN_STATUS_ICON
                      ] || RUN_STATUS_ICON.pending}
                      <span className="text-xs capitalize text-muted-foreground">
                        {lastRunLabel}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
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
                          size="icon-sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => openEditMode(e, pipe)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              variant="danger"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Delete Pipeline
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete pipeline?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete &quot;{pipe.name}
                                &quot; and all its execution history.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                variant="danger"
                                disabled={isDeleting}
                                onClick={() => deletePipeline(pipe.id)}
                              >
                                {isDeleting && (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                )}
                                Delete Pipeline
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </Card>
      )}

      {isModalOpen && (
        <PipelineDialog
          key={action === "edit" ? editId : "create"}
          pipeline={editingPipeline}
          onClose={closeModal}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}
