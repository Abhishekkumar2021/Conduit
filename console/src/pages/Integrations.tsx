import { useState } from "react";
import {
  Plus,
  Plug2,
  Database,
  AlertCircle,
  Pencil,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  INTEGRATION_STATUS,
  ADAPTER_UI_MAP,
  DEFAULT_ADAPTER,
} from "@/lib/constants";
import { AssetDrawer } from "@/components/integrations/AssetDrawer";
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

export function Integrations() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";

  const { data: integrations, isLoading: isIntegrationsLoading } =
    useIntegrations(workspaceId);
  const { data: adapters } = useAdapters();
  const { mutate: createIntegration, isPending: isCreating } =
    useCreateIntegration(workspaceId);
  const { mutate: updateIntegration, isPending: isUpdating } =
    useUpdateIntegration(workspaceId);
  const { mutate: deleteIntegration } = useDeleteIntegration(workspaceId);
  const { data: runnerStatus } = useRunnerStatus();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<{
    id: string;
    name: string;
    adapter_type: string;
    config: Record<string, string | number>;
  } | null>(null);

  // Drawer state
  const [selectedDrawerIntegration, setSelectedDrawerIntegration] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const testConnection = useTestConnection();

  const handleTestConnection = async (id: string) => {
    try {
      await testConnection.mutateAsync(id);
    } catch (error) {
      console.error("Test connection failed", error);
    }
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
          data: {
            name: data.name,
            config: data.config,
          },
        },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setEditingIntegration(null);
          },
        },
      );
    } else {
      createIntegration(data, {
        onSuccess: () => {
          setIsModalOpen(false);
          setEditingIntegration(null);
        },
      });
    }
  };

  const openCreateMode = () => {
    setEditingIntegration(null);
    setIsModalOpen(true);
  };

  const openEditMode = (int: Integration) => {
    setEditingIntegration({
      id: int.id,
      name: int.name,
      adapter_type: int.adapter_type,
      config: (int.config as Record<string, string | number>) || {},
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this integration?")) {
      deleteIntegration(id);
    }
  };

  return (
    <div className="fade-in p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Integrations"
        description="Connect your data sources and destinations"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={openCreateMode}
            className="shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Integration
          </Button>
        }
      />

      {/* Runner Status Banner */}
      {runnerStatus &&
        !runnerStatus.is_healthy &&
        runnerStatus.missing_variables.length > 0 && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 text-rose-600 dark:text-rose-400 flex items-start gap-4 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/10">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="text-sm">
              <p className="font-bold mb-1 tracking-tight text-[14px] text-rose-700 dark:text-rose-300">
                Local Runner Missing Secrets
              </p>
              <p className="text-rose-600/80 dark:text-rose-400/80 font-medium leading-relaxed text-[13px]">
                The engine will fail to execute pipelines or sync assets unless
                the following environment variables are provided to the server:
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {runnerStatus.missing_variables.map((v) => (
                  <li
                    key={v}
                    className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/10 font-mono text-[9px] font-bold uppercase tracking-widest text-rose-700 dark:text-rose-300"
                  >
                    {v}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

      <div>
        {isIntegrationsLoading && (
          <div className="space-y-2 mt-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[64px] w-full" />
            ))}
          </div>
        )}
        {!isIntegrationsLoading && integrations?.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/50 p-8 text-center text-muted-foreground mt-4">
            No integrations found. Connect your first data source to begin.
          </div>
        )}

        {!isIntegrationsLoading && integrations && integrations.length > 0 && (
          <div className="mt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Integration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((int) => {
                  const status = int.status || "healthy";
                  const st =
                    INTEGRATION_STATUS[
                      status as keyof typeof INTEGRATION_STATUS
                    ] || INTEGRATION_STATUS.healthy;
                  const uiProvider =
                    ADAPTER_UI_MAP[int.adapter_type] || DEFAULT_ADAPTER;
                  const IconComponent = uiProvider.icon;

                  return (
                    <TableRow key={int.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5 border border-primary/10 shrink-0">
                            <IconComponent
                              className="h-4.5 w-4.5 text-primary/60"
                              strokeWidth={2.5}
                            />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground tracking-tight">
                              {int.name}
                            </h3>
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">
                              {int.adapter_type}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-[12px] font-semibold">
                          <span
                            className={`w-2 h-2 rounded-full ${status === "healthy" ? "bg-emerald-500" : "bg-rose-500"}`}
                          />
                          <Badge
                            variant={st.variant}
                            dot={false}
                            className="px-1.5 py-0 h-4 text-[10px] font-bold rounded-md bg-transparent border-none text-muted-foreground/70"
                          >
                            {st.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {int.last_sync_at
                          ? new Date(int.last_sync_at).toLocaleDateString()
                          : "No sync"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-[11px] font-semibold text-muted-foreground/70 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity bg-muted/20 hover:bg-muted/50"
                            onClick={() =>
                              setSelectedDrawerIntegration({
                                id: int.id,
                                name: int.name,
                              })
                            }
                          >
                            <Database className="h-3.5 w-3.5 mr-1.5 opacity-70" />
                            Assets
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground/60" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="rounded-xl"
                            >
                              <DropdownMenuItem
                                onClick={() => openEditMode(int)}
                              >
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                Edit Settings
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleTestConnection(int.id)}
                              >
                                <Plug2 className="h-3.5 w-3.5 mr-2" />
                                Test Connection
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="danger"
                                onClick={() => handleDelete(int.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AssetDrawer
        workspaceId={workspaceId}
        isOpen={!!selectedDrawerIntegration}
        onClose={() => setSelectedDrawerIntegration(null)}
        integrationId={selectedDrawerIntegration?.id || null}
        integrationName={selectedDrawerIntegration?.name || null}
      />

      <IntegrationDialog
        key={editingIntegration?.id || (isModalOpen ? "new" : "closed")}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingIntegration(null);
        }}
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
