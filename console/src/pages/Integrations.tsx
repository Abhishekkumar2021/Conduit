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
    <div className="fade-in p-4 sm:p-6 lg:p-8 space-y-6">
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

      <div className="max-w-7xl grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isIntegrationsLoading && (
          <>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[156px] w-full" />
            ))}
          </>
        )}
        {!isIntegrationsLoading && integrations?.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border/50 p-8 text-center text-muted-foreground">
            No integrations found. Connect your first data source to begin.
          </div>
        )}

        {integrations?.map((int) => {
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
              className="group border-border/60 hover:border-primary/20 transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br ${uiProvider.color} shadow-md border border-white/20`}
                  >
                    <IconComponent className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-foreground/90 tracking-tight">
                      {int.name}
                    </h3>
                    <p className="text-[11px] font-bold text-muted-foreground/50 capitalize mt-0.5 tracking-wide">
                      {int.adapter_type}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge
                    variant={st.variant}
                    dot
                    className="px-2 py-0.5 h-4.5 text-[9px] font-bold rounded-lg border border-border/50 bg-muted/20 text-foreground/70"
                  >
                    {st.label}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditMode(int)}>
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
                        Delete Integration
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border/30 pt-4 text-[11px] text-muted-foreground/50">
                <div className="flex items-center gap-2 font-bold tracking-tight">
                  {status === "healthy" ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      <span className="text-emerald-700 dark:text-emerald-400/80">
                        Active
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                      <span className="text-rose-700 dark:text-rose-400/80">
                        Inactive
                      </span>
                    </>
                  )}
                </div>
                <span className="font-bold tabular-nums text-muted-foreground/60">
                  {int.last_sync_at
                    ? `Synced ${new Date(int.last_sync_at).toLocaleDateString()}`
                    : "Wait for sync"}
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 bg-muted/30 hover:bg-muted text-[11px] font-bold h-9 rounded-xl transition-all"
                  onClick={() =>
                    setSelectedDrawerIntegration({ id: int.id, name: int.name })
                  }
                >
                  <Database className="h-3.5 w-3.5 mr-2 opacity-60" />
                  Browse Assets
                </Button>
              </div>
            </Card>
          );
        })}
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
