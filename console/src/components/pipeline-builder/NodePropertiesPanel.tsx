import { useState } from "react";
import { type Node } from "@xyflow/react";
import { X, CheckCircle2 } from "lucide-react";
import {
  useIntegrations,
  useIntegrationAssets,
} from "@/hooks/queries/useIntegrations";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import type { Asset } from "@/types/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

interface NodePropertiesPanelProps {
  node: Node;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onClose: () => void;
}

export function NodePropertiesPanel({
  node,
  onUpdate,
  onClose,
}: NodePropertiesPanelProps) {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";
  const { data: integrations } = useIntegrations(workspaceId);

  // Local state for form values to ensure smooth typing before sync -> node data
  const [config, setConfig] = useState<Record<string, unknown>>(
    (node.data.config as Record<string, unknown>) || {},
  );

  const { data: assets } = useIntegrationAssets(
    config.integration_id as string | undefined,
  );

  const kind = node.data.kind as string;
  const adapter = node.data.adapter as string;
  const isDataNode = kind === "extract" || kind === "load";

  const handleConfigChange = (key: string, value: unknown) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onUpdate(node.id, { ...node.data, config: newConfig } as Record<
      string,
      unknown
    >);
  };

  const relevantIntegrations = integrations?.filter(
    (i) => !adapter || i.adapter_type === adapter,
  );

  return (
    <aside className="w-72 shrink-0 border-l border-border/40 bg-card/60 backdrop-blur-md p-0 h-full overflow-y-auto flex flex-col relative z-20 shadow-xl">
      <div className="flex items-center justify-between p-4 border-b border-border/40 bg-card/80 sticky top-0 z-10">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground leading-none">
            {node.data.label as string}
          </h3>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 font-medium">
            {kind} Node
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-6 flex-1">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Label
          </label>
          <input
            type="text"
            value={node.data.label as string}
            onChange={(e) =>
              onUpdate(node.id, { ...node.data, label: e.target.value })
            }
            className="w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-[12px] text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
          />
        </div>

        {isDataNode ? (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                Connection Setup
              </span>
              <div className="h-px bg-border flex-1" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">
                Integration
              </label>
              <Select
                value={(config.integration_id as string) || ""}
                onValueChange={(val) => {
                  handleConfigChange("integration_id", val);
                  // Reset asset selection when integration changes
                  onUpdate(node.id, {
                    ...node.data,
                    config: {
                      ...config,
                      integration_id: val,
                      asset_id: undefined,
                    },
                  } as Record<string, unknown>);
                }}
              >
                <SelectTrigger className="w-full h-8 text-[12px] bg-background/50 border-input">
                  <SelectValue placeholder="Select Integration..." />
                </SelectTrigger>
                <SelectContent>
                  {relevantIntegrations?.map((int) => (
                    <SelectItem key={int.id} value={int.id}>
                      {int.name}
                    </SelectItem>
                  ))}
                  {relevantIntegrations?.length === 0 && (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      No matching integrations found.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                <span>Target Asset</span>
                {!!config.integration_id && !assets?.length && (
                  <span className="text-[9px] text-amber-500 flex items-center gap-1 font-semibold uppercase tracking-tighter">
                    Needs Discovery
                  </span>
                )}
              </label>
              <Select
                value={(config.asset_id as string) || ""}
                onValueChange={(val) => handleConfigChange("asset_id", val)}
                disabled={!config.integration_id || !assets?.length}
              >
                <SelectTrigger className="w-full h-8 text-[12px] bg-background/50 border-input">
                  <SelectValue
                    placeholder={
                      assets?.length
                        ? "Select Table/View..."
                        : "No assets available"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {assets?.map((asset: Asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.qualified_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!!config.integration_id && !assets?.length && (
                <p className="text-[10px] text-muted-foreground/70 leading-tight">
                  Go to the Integrations page to run asset discovery for this
                  data source.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                Transformation Logic
              </span>
              <div className="h-px bg-border flex-1" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground">
                SQL Query
              </label>
              <textarea
                value={(config.query as string) || ""}
                onChange={(e) => handleConfigChange("query", e.target.value)}
                placeholder="SELECT * FROM source_table"
                className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-[12px] font-mono text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all h-32 custom-scrollbar resize-y"
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-muted/20 border-t border-border flex items-center gap-2 sticky bottom-0 z-10">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground ml-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          Auto-saved
        </div>
      </div>
    </aside>
  );
}
