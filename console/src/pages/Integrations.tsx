/* eslint-disable react-hooks/set-state-in-effect */
import {
  Plus,
  Database,
  Cloud,
  FileSpreadsheet,
  BarChart3,
  ExternalLink,
  Lock,
  Shield,
  Plug2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { INTEGRATION_STATUS } from "@/lib/constants";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import {
  useIntegrations,
  useCreateIntegration,
  useAdapters,
  type Adapter,
} from "@/hooks/queries/useIntegrations";

interface FieldSpec {
  name: string;
  type: string;
  defaultValue: string | number;
  isSecret: boolean;
}
import type React from "react";
import { useState, useEffect } from "react";
import { AssetDrawer } from "@/components/integrations/AssetDrawer";

// Helper to parse "port:int=5432" or "password:secret"
const parseFieldSpec = (spec: string): FieldSpec => {
  let name = spec;
  let type = "text";
  let defaultValue: string | number = "";
  let isSecret = false;

  // Check for default value first
  const partsWithDefault = spec.split("=", 2);
  if (partsWithDefault.length > 1) {
    defaultValue = partsWithDefault[1];
    name = partsWithDefault[0];
  }

  // Check for type and secret
  const partsWithType = name.split(":", 2);
  if (partsWithType.length > 1) {
    name = partsWithType[0];
    const typeSpec = partsWithType[1];

    if (typeSpec === "secret") {
      isSecret = true;
      type = "password";
    } else if (typeSpec === "int") {
      type = "number";
      if (defaultValue) defaultValue = parseInt(defaultValue as string, 10);
    }
  }

  return { name, type, defaultValue, isSecret };
};

const ADAPTER_UI_MAP: Record<
  string,
  { icon: React.ElementType; color: string }
> = {
  postgres: {
    icon: Database,
    color: "from-blue-500/20 to-blue-600/20 text-blue-500 dark:text-blue-400",
  },
  snowflake: {
    icon: Database,
    color: "from-cyan-500/20 to-cyan-600/20 text-cyan-500 dark:text-cyan-400",
  },
  salesforce: {
    icon: Cloud,
    color: "from-sky-500/20 to-sky-600/20 text-sky-500 dark:text-sky-400",
  },
  stripe: {
    icon: BarChart3,
    color:
      "from-violet-500/20 to-violet-600/20 text-violet-500 dark:text-violet-400",
  },
  google_sheets: {
    icon: FileSpreadsheet,
    color:
      "from-emerald-500/20 to-emerald-600/20 text-emerald-500 dark:text-emerald-400",
  },
  hubspot: {
    icon: Cloud,
    color:
      "from-orange-500/20 to-orange-600/20 text-orange-500 dark:text-orange-400",
  },
};

const DEFAULT_ADAPTER = {
  icon: Plug2,
  color: "from-zinc-500/20 to-zinc-600/20 text-zinc-500 dark:text-zinc-400",
};

export function Integrations() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";

  const { data: integrations, isLoading: isIntegrationsLoading } =
    useIntegrations(workspaceId);
  const { data: adapters } = useAdapters();
  const { mutate: createIntegration, isPending: isCreating } =
    useCreateIntegration(workspaceId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [adapterType, setAdapterType] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<
    Record<string, string | number>
  >({});

  // Drawer state
  const [selectedDrawerIntegration, setSelectedDrawerIntegration] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Derived state to avoid cascading renders
  const effectiveAdapterType = adapterType || adapters?.[0]?.type || "";
  const selectedAdapter = adapters?.find(
    (a: Adapter) => a.type === effectiveAdapterType,
  );

  // Sync config defaults when adapter changes — legitimate external data sync
  useEffect(() => {
    if (isModalOpen && selectedAdapter?.vault_fields) {
      const initial: Record<string, string | number> = {};
      selectedAdapter.vault_fields.forEach((spec) => {
        const parsed = parseFieldSpec(spec);
        initial[parsed.name] = parsed.defaultValue;
      });
      setConfigValues(initial);
    }
  }, [isModalOpen, selectedAdapter]);

  const handleCreateIntegration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !name.trim() || !effectiveAdapterType) return;

    // ensure numbers are numbers
    const finalConfig = { ...configValues };
    selectedAdapter?.vault_fields.forEach((spec) => {
      const parsed = parseFieldSpec(spec);
      if (parsed.type === "number" && finalConfig[parsed.name]) {
        finalConfig[parsed.name] = Number(finalConfig[parsed.name]);
      }
    });

    createIntegration(
      {
        name: name.trim(),
        adapter_type: effectiveAdapterType,
        config: finalConfig,
      },
      {
        onSuccess: () => {
          setIsModalOpen(false);
          setName("");
        },
      },
    );
  };

  return (
    <div className="fade-in p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Integrations"
        description="Connect your data sources and destinations"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Integration
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
            <Card key={int.id} hover className="group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br ${uiProvider.color}`}
                  >
                    <IconComponent className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold text-foreground">
                      {int.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {int.adapter_type}
                    </p>
                  </div>
                </div>
                <Badge variant={st.variant} dot>
                  {st.label}
                </Badge>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
                <span>Active</span>
                <span>
                  Last sync:{" "}
                  {int.last_sync_at
                    ? new Date(int.last_sync_at).toLocaleDateString()
                    : "Never"}
                </span>
              </div>

              <div className="mt-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelectedDrawerIntegration({ id: int.id, name: int.name })
                  }
                >
                  <Database className="h-3 w-3" />
                  Assets
                </Button>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-3 w-3" />
                  Details
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <AssetDrawer
        isOpen={!!selectedDrawerIntegration}
        onClose={() => setSelectedDrawerIntegration(null)}
        integrationId={selectedDrawerIntegration?.id || null}
        integrationName={selectedDrawerIntegration?.name || null}
      />

      {/* Create Integration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-[0_8px_30px_rgb(0,0,0,0.12)] animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Plug2 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-[14px] font-semibold text-foreground leading-tight">
                    Add{" "}
                    {effectiveAdapterType
                      ? effectiveAdapterType.charAt(0).toUpperCase() +
                        effectiveAdapterType.slice(1)
                      : "New"}{" "}
                    Integration
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Shield className="h-2.5 w-2.5 text-emerald-500" />
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                      Zero-Trust Secured
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateIntegration}>
              <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
                {/* Section: Basic Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Integration Name
                    </label>
                    <input
                      type="text"
                      placeholder="My Production DB"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-[12px] text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Source Type
                    </label>
                    <Select
                      value={effectiveAdapterType}
                      onValueChange={(val) => setAdapterType(val)}
                    >
                      <SelectTrigger className="w-full h-8 text-[12px] bg-background border-input">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {adapters?.map((a: Adapter) => (
                          <SelectItem key={a.type} value={a.type}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Section: Connection Settings */}
                {selectedAdapter && selectedAdapter.vault_fields.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                        Connection Details
                      </span>
                      <div className="h-px bg-border flex-1" />
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                      {selectedAdapter.vault_fields.map((spec) => {
                        const field = parseFieldSpec(spec);
                        const isFullWidth = [
                          "host",
                          "password",
                          "database",
                          "token",
                          "key",
                        ].some((k) => field.name.toLowerCase().includes(k));

                        return (
                          <div
                            key={field.name}
                            className={`space-y-1.5 ${isFullWidth ? "col-span-2" : "col-span-1"}`}
                          >
                            <label className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                              <span className="capitalize">
                                {field.name.replace(/_/g, " ")}
                              </span>
                              {field.isSecret && (
                                <span className="text-[9px] text-emerald-500 flex items-center gap-1 font-semibold uppercase tracking-tighter">
                                  <Lock className="h-2 w-2" />
                                  Vault
                                </span>
                              )}
                            </label>
                            <div className="relative">
                              <input
                                type={field.type}
                                value={configValues[field.name] || ""}
                                onChange={(e) =>
                                  setConfigValues({
                                    ...configValues,
                                    [field.name]: e.target.value,
                                  })
                                }
                                placeholder={
                                  field.isSecret
                                    ? "vault_key_name"
                                    : field.defaultValue
                                      ? String(field.defaultValue)
                                      : ""
                                }
                                className={`w-full rounded-md border px-3 py-1.5 text-[12px] text-foreground focus:ring-1 outline-none transition-all ${
                                  field.isSecret
                                    ? "bg-emerald-500/5 border-emerald-500/20 focus:ring-emerald-500/20 focus:border-emerald-500/40"
                                    : "border-input bg-background focus:ring-primary focus:border-primary"
                                }`}
                                required
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-muted/20 border-t border-border flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-[12px] h-9"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="flex-1 text-[12px] h-9 font-semibold"
                  disabled={isCreating || !name.trim()}
                >
                  {isCreating ? "Connecting..." : "Add Integration"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
