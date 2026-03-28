import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Plug2,
  AlertCircle,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Search,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
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
import {
  INTEGRATION_STATUS,
  ADAPTER_UI_MAP,
  DEFAULT_ADAPTER,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import {
  useIntegrations,
  useCreateIntegration,
  useAdapters,
  useTestConnection,
  useUpdateIntegration,
  useDeleteIntegration,
  useRunnerStatus,
} from "@/hooks/queries/useIntegrations";
import { IntegrationDialog } from "@/components/integrations/IntegrationDialog";
import type { Integration } from "@/types/api";
import { useQueryAction } from "@/hooks/useQueryAction";

type ViewMode = "grid" | "list";

export function Integrations() {
  const navigate = useNavigate();
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";

  const { data: integrations, isLoading: isIntegrationsLoading } =
    useIntegrations(workspaceId);
  const { data: adapters } = useAdapters();
  const { mutate: createIntegration, isPending: isCreating } =
    useCreateIntegration(workspaceId);
  const { mutate: updateIntegration, isPending: isUpdating } =
    useUpdateIntegration(workspaceId);
  const { mutate: deleteIntegration, isPending: isDeleting } =
    useDeleteIntegration(workspaceId);
  const { data: runnerStatus } = useRunnerStatus();
  const { action, setParams, clearParams } = useQueryAction();
  const testConnection = useTestConnection();

  const [editingIntegration, setEditingIntegration] = useState<{
    id: string;
    name: string;
    adapter_type: string;
    config: Record<string, string | number>;
  } | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const isModalOpen = action === "create" || action === "edit";

  const closeModal = () => {
    clearParams(["action", "id"]);
    setEditingIntegration(null);
  };

  const openCreateMode = () => {
    setEditingIntegration(null);
    setParams({ action: "create" });
  };

  const openEditMode = (int: Integration) => {
    setEditingIntegration({
      id: int.id,
      name: int.name,
      adapter_type: int.adapter_type,
      config: (int.config as Record<string, string | number>) || {},
    });
    setParams({ action: "edit", id: int.id });
  };

  const handleCreateOrUpdate = (data: {
    name: string;
    adapter_type: string;
    config: Record<string, string | number>;
  }) => {
    if (editingIntegration) {
      updateIntegration(
        {
          id: editingIntegration.id,
          data: { name: data.name, config: data.config },
        },
        { onSuccess: closeModal },
      );
    } else {
      createIntegration(data, { onSuccess: closeModal });
    }
  };

  const filtered = (integrations || []).filter((int) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        int.name.toLowerCase().includes(q) ||
        int.adapter_type.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (statusFilter && (int.status || "healthy") !== statusFilter) return false;
    return true;
  });

  const hasFilters = Boolean(searchTerm || statusFilter);

  return (
    <div className="fade-in space-y-6 max-w-7xl mx-auto p-6 lg:p-8">
      <PageHeader
        title="Integrations"
        description="Connect your data sources and destinations"
        actions={
          <Button variant="primary" size="sm" onClick={openCreateMode}>
            <Plus className="h-3.5 w-3.5" />
            Add Integration
          </Button>
        }
      />

      {/* Runner health banner */}
      {runnerStatus &&
        !runnerStatus.is_healthy &&
        runnerStatus.missing_variables.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/5 p-5 text-red-600 dark:text-red-400 flex items-start gap-4 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-500/10">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="text-sm">
              <p className="font-semibold mb-1 text-red-700 dark:text-red-300">
                Local Runner Missing Secrets
              </p>
              <p className="text-red-600 dark:text-red-400">
                The engine will fail to execute pipelines or sync assets unless
                the following environment variables are provided:
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {runnerStatus.missing_variables.map((v) => (
                  <li
                    key={v}
                    className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 font-mono text-xs font-medium text-red-700 dark:text-red-300"
                  >
                    {v}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Search integrations..."
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
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="degraded">Degraded</SelectItem>
              <SelectItem value="unreachable">Unreachable</SelectItem>
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
            {filtered.length} integration{filtered.length !== 1 ? "s" : ""}
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

      {/* Content */}
      {isIntegrationsLoading && (
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
                viewMode === "grid" ? "h-[180px]" : "h-[64px]",
              )}
            />
          ))}
        </div>
      )}

      {!isIntegrationsLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Plug2 className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">
            {hasFilters ? "No matching integrations" : "No integrations"}
          </h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
            {hasFilters
              ? "Try adjusting your search or filters."
              : "Connect your first data source to start building pipelines."}
          </p>
          {!hasFilters && (
            <Button
              variant="primary"
              size="sm"
              className="mt-5"
              onClick={openCreateMode}
            >
              <Plus className="h-3.5 w-3.5" /> Add Integration
            </Button>
          )}
        </div>
      )}

      {/* Grid View */}
      {!isIntegrationsLoading && filtered.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((int) => {
            const status = int.status || "healthy";
            const st =
              INTEGRATION_STATUS[status as keyof typeof INTEGRATION_STATUS] ||
              INTEGRATION_STATUS.healthy;
            const uiProvider =
              ADAPTER_UI_MAP[int.adapter_type] || DEFAULT_ADAPTER;
            const IconComponent = uiProvider.icon;

            return (
              <Card
                key={int.id}
                hover
                className="group relative overflow-hidden"
                onClick={() => navigate(`/integrations/${int.id}`)}
              >
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-4 bg-current pointer-events-none" />
                <div className="flex items-start justify-between mb-4 relative">
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-2xl shrink-0 transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg",
                      uiProvider.color,
                    )}
                  >
                    <IconComponent className="h-5 w-5" strokeWidth={2} />
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
                          onClick={() => navigate(`/integrations/${int.id}`)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditMode(int)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => testConnection.mutate(int.id)}
                        >
                          <Plug2 className="h-3.5 w-3.5 mr-2" />
                          Test Connection
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              variant="danger"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete integration?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete &quot;{int.name}
                                &quot;. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                variant="danger"
                                disabled={isDeleting}
                                onClick={() => deleteIntegration(int.id)}
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

                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {int.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {int.adapter_type}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        status === "healthy"
                          ? "bg-emerald-500"
                          : status === "degraded"
                            ? "bg-amber-500"
                            : "bg-red-500",
                      )}
                    />
                    <span className="text-xs text-muted-foreground font-medium">
                      {st.label}
                    </span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* List View */}
      {!isIntegrationsLoading && filtered.length > 0 && viewMode === "list" && (
        <Card padding={false} className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Integration</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="text-right pr-5">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((int) => {
              const status = int.status || "healthy";
              const st =
                INTEGRATION_STATUS[
                  status as keyof typeof INTEGRATION_STATUS
                ] || INTEGRATION_STATUS.healthy;
              const uiProvider =
                ADAPTER_UI_MAP[int.adapter_type] || DEFAULT_ADAPTER;
              const IconComponent = uiProvider.icon;

              return (
                <TableRow
                  key={int.id}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/integrations/${int.id}`)}
                >
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
                          uiProvider.color,
                        )}
                      >
                        <IconComponent
                          className="h-4 w-4"
                          strokeWidth={2.5}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors">
                          {int.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {int.adapter_type}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={st.variant} dot>
                      {st.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {int.status_message || "Ready"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => testConnection.mutate(int.id)}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Test
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditMode(int)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Edit Settings
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                variant="danger"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete integration?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete &quot;{int.name}
                                  &quot;. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  variant="danger"
                                  disabled={isDeleting}
                                  onClick={() => deleteIntegration(int.id)}
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </Card>
      )}

      <IntegrationDialog
        key={editingIntegration?.id || (isModalOpen ? "new" : "closed")}
        isOpen={isModalOpen}
        onClose={closeModal}
        adapters={adapters}
        workspaceId={workspaceId}
        integrationId={editingIntegration?.id}
        initialName={editingIntegration?.name}
        initialAdapterType={editingIntegration?.adapter_type}
        initialConfig={editingIntegration?.config}
        onSave={handleCreateOrUpdate}
        isSaving={isCreating || isUpdating}
      />
    </div>
  );
}
