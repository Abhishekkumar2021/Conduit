import { useState, useMemo } from "react";
import { type Node } from "@xyflow/react";
import { X, CheckCircle2, Zap, Trash2 } from "lucide-react";
import {
  useIntegrations,
  useIntegrationAssets,
} from "@/hooks/queries/useIntegrations";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { useProcessors } from "@/hooks/queries/useProcessors";
import type { Asset } from "@/types/api";
import type { ProcessorMeta, ProcessorParam } from "@/hooks/queries/useProcessors";
import { Input } from "@/components/ui/Input";
import { JSONEditor } from "@/components/ui/JSONEditor";
import { Button } from "@/components/ui/Button";
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

interface NodePropertiesPanelProps {
  node: Node;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/* ─── Shared Label ──────────────────────────────────────────── */

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
      <span>{children}</span>
      {required && <span className="text-red-400 text-[9px]">*</span>}
    </label>
  );
}

/* ─── Processor Config Field Renderer ───────────────────────── */

function ProcessorConfigField({
  param,
  value,
  onChange,
}: {
  param: ProcessorParam;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  // Dropdown for params with options
  if (param.options && param.options.length > 0) {
    return (
      <Select
        value={(value as string) || ""}
        onValueChange={onChange}
      >
        <SelectTrigger className="w-full h-9 text-[12px]">
          <SelectValue placeholder={`Select ${param.name}...`} />
        </SelectTrigger>
        <SelectContent>
          {param.options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Boolean toggle
  if (param.type === "boolean") {
    return (
      <Select
        value={value === true ? "true" : value === false ? "false" : ""}
        onValueChange={(v) => onChange(v === "true")}
      >
        <SelectTrigger className="w-full h-9 text-[12px]">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // Object/array as JSON editor
  if (param.type === "object" || param.type === "array") {
    const strVal =
      typeof value === "string"
        ? value
        : value
          ? JSON.stringify(value, null, 2)
          : "";
    return (
      <JSONEditor
        value={strVal}
        onChange={(v) => {
          try {
            onChange(JSON.parse(v));
          } catch {
            onChange(v);
          }
        }}
        placeholder={param.description || `Enter ${param.type}...`}
        className="min-h-[100px]"
      />
    );
  }

  // Default text/number input
  return (
    <Input
      type={param.type === "number" || param.type === "integer" ? "number" : "text"}
      value={(value as string) ?? ""}
      onChange={(e) => {
        const v = param.type === "number" || param.type === "integer"
          ? Number(e.target.value)
          : e.target.value;
        onChange(v);
      }}
      placeholder={param.description || param.name}
      className="h-9 text-[12px]"
    />
  );
}

/* ─── Section Divider ───────────────────────────────────────── */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
        {children}
      </span>
      <div className="h-px bg-border flex-1" />
    </div>
  );
}

/* ─── Main Panel ────────────────────────────────────────────── */

export function NodePropertiesPanel({
  node,
  onUpdate,
  onDelete,
  onClose,
}: NodePropertiesPanelProps) {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";
  const { data: integrations } = useIntegrations(workspaceId);
  const { data: processors } = useProcessors();

  const [config, setConfig] = useState<Record<string, unknown>>(
    (node.data.config as Record<string, unknown>) || {},
  );

  const { data: assets } = useIntegrationAssets(
    config.integration_id as string | undefined,
  );

  const kind = node.data.kind as string;
  const adapter = node.data.adapter as string;
  const isDataNode = kind === "extract" || kind === "load";
  const isProcessorNode = kind === "processor";

  // Get the selected processor's metadata
  const selectedProcessor = useMemo<ProcessorMeta | undefined>(() => {
    if (!processors || !config.processor_type) return undefined;
    return processors.find((p) => p.type === config.processor_type);
  }, [processors, config.processor_type]);

  const handleConfigChange = (key: string, value: unknown) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onUpdate(node.id, { ...node.data, config: newConfig } as Record<
      string,
      unknown
    >);
  };

  const handleProcessorSelect = (processorType: string) => {
    const proc = processors?.find((p) => p.type === processorType);
    const newConfig: Record<string, unknown> = {
      ...config,
      processor_type: processorType,
    };
    setConfig(newConfig);
    onUpdate(node.id, {
      ...node.data,
      config: newConfig,
      label: proc?.name || node.data.label,
      kind: "processor",
    } as Record<string, unknown>);
  };

  const relevantIntegrations = integrations?.filter(
    (i) => !adapter || i.adapter_type === adapter,
  );

  // Group processors by category
  const groupedProcessors = useMemo(() => {
    if (!processors) return {};
    return processors.reduce<Record<string, ProcessorMeta[]>>((acc, p) => {
      const cat = p.category || "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});
  }, [processors]);

  return (
    <aside className="w-72 shrink-0 border-l border-border/40 bg-card/60 backdrop-blur-md p-0 h-full overflow-y-auto flex flex-col relative z-20 shadow-xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/40 bg-card/80 sticky top-0 z-10">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground leading-none tracking-tight">
            {node.data.label as string}
          </h3>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 font-medium italic opacity-70">
            {isProcessorNode ? "Processor" : kind} Node
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-6 flex-1">
        {/* Label — shared across all node types */}
        <div className="space-y-1.5">
          <FieldLabel>Label</FieldLabel>
          <Input
            type="text"
            value={node.data.label as string}
            onChange={(e) =>
              onUpdate(node.id, { ...node.data, label: e.target.value })
            }
            className="h-9 text-[12px] font-medium"
          />
        </div>

        {/* Source / Destination Nodes */}
        {isDataNode && (
          <div className="space-y-4 pt-1">
            <SectionHeader>Connection Setup</SectionHeader>

            <div className="space-y-1.5">
              <FieldLabel>Integration</FieldLabel>
              <Select
                value={(config.integration_id as string) || ""}
                onValueChange={(val) => {
                  const newConfig = {
                    ...config,
                    integration_id: val,
                    asset_id: undefined,
                  };
                  setConfig(newConfig);
                  onUpdate(node.id, {
                    ...node.data,
                    config: newConfig,
                  } as Record<string, unknown>);
                }}
              >
                <SelectTrigger className="w-full h-9 text-[12px]">
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
              <FieldLabel>
                <span className="flex items-center justify-between w-full">
                  <span>Target Asset</span>
                  {!!config.integration_id && !assets?.length && (
                    <span className="text-[9px] text-amber-500 font-semibold uppercase tracking-tighter">
                      Needs Discovery
                    </span>
                  )}
                </span>
              </FieldLabel>
              <Select
                value={(config.asset_id as string) || ""}
                onValueChange={(val) => handleConfigChange("asset_id", val)}
                disabled={!config.integration_id || !assets?.length}
              >
                <SelectTrigger className="w-full h-9 text-[12px]">
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
                  Go to Integrations to run asset discovery for this source.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Processor Nodes */}
        {isProcessorNode && (
          <div className="space-y-4 pt-1">
            <SectionHeader>Processor Setup</SectionHeader>

            {/* Processor Type Selector */}
            <div className="space-y-1.5">
              <FieldLabel>Processor Type</FieldLabel>
              <Select
                value={(config.processor_type as string) || ""}
                onValueChange={handleProcessorSelect}
              >
                <SelectTrigger className="w-full h-9 text-[12px]">
                  <SelectValue placeholder="Select Processor..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedProcessors).map(([category, procs]) => (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 border-b border-border/20 mb-1">
                        {category}
                      </div>
                      {procs.map((p) => (
                        <SelectItem key={p.type} value={p.type}>
                          <div className="flex items-center gap-2">
                            <Zap className="h-3 w-3 text-violet-500" />
                            <span>{p.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            {selectedProcessor && (
              <div className="bg-muted/30 rounded-xl p-3.5 border border-border/10 space-y-1.5 transition-all duration-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-violet-500/70" />
                  About this processor
                </p>
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                  {selectedProcessor.description}
                </p>
              </div>
            )}

            {/* Dynamic Config Fields */}
            {selectedProcessor && selectedProcessor.parameters.length > 0 && (
              <div className="space-y-4 pt-1">
                <SectionHeader>Configuration</SectionHeader>
                {selectedProcessor.parameters.map((param) => (
                  <div key={param.name} className="space-y-1.5">
                    <FieldLabel required={param.required}>{param.name}</FieldLabel>
                    <ProcessorConfigField
                      param={param}
                      value={config[param.name]}
                      onChange={(val) => handleConfigChange(param.name, val)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-muted/20 border-t border-border/40 flex items-center justify-between sticky bottom-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 font-medium ml-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/80" />
          Auto-saved
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="danger"
              size="sm"
              className="h-8 rounded-lg px-2.5 opacity-60 hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this node?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the "{node.data.label as string}" stage and
                all its connections from the pipeline.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="danger"
                onClick={() => onDelete(node.id)}
              >
                Delete Node
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </aside>
  );
}
