import { useRef, useState, useMemo } from "react";
import { type Node } from "@xyflow/react";
import { X, CheckCircle2, Zap, Trash2, Database, ArrowRightLeft, ChevronDown, Table2, FilePlus2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface NodePropertiesPanelProps {
  node: Node;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-[13px] font-medium text-foreground flex items-center gap-1">
      <span>{children}</span>
      {required && <span className="text-red-500 text-xs">*</span>}
    </label>
  );
}

function ProcessorConfigField({
  param,
  value,
  onChange,
}: {
  param: ProcessorParam;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  if (param.options && param.options.length > 0) {
    return (
      <Select
        value={(value as string) || ""}
        onValueChange={onChange}
      >
        <SelectTrigger className="w-full h-9 text-xs">
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

  if (param.type === "boolean") {
    return (
      <Select
        value={value === true ? "true" : value === false ? "false" : ""}
        onValueChange={(v) => onChange(v === "true")}
      >
        <SelectTrigger className="w-full h-9 text-xs">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectContent>
      </Select>
    );
  }

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
      className="h-9 text-xs"
    />
  );
}

function AssetCombobox({
  value,
  onChange,
  assets,
  disabled,
  isLoadNode,
}: {
  value: string;
  onChange: (val: string) => void;
  assets: Asset[] | undefined;
  disabled: boolean;
  isLoadNode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!assets) return [];
    if (!search.trim()) return assets;
    const q = search.toLowerCase();
    return assets.filter((a) => a.qualified_name.toLowerCase().includes(q));
  }, [assets, search]);

  const handleSelect = (name: string) => {
    onChange(name);
    setSearch("");
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearch(v);
    onChange(v);
    if (!open) setOpen(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (containerRef.current?.contains(e.relatedTarget as HTMLElement)) return;
    setTimeout(() => setOpen(false), 150);
  };

  const placeholder = isLoadNode
    ? "Select or type new asset..."
    : assets?.length
      ? "Select asset..."
      : "No assets — run Discovery";

  const displayValue = open ? (search !== "" ? search : value) : value;

  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => { setOpen(true); setSearch(""); }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full rounded-lg border border-border px-3 pr-8 text-xs font-mono text-foreground",
            "bg-background dark:bg-zinc-900",
            "placeholder:text-muted-foreground/60",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors",
          )}
        />
        <ChevronDown className={cn(
          "absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none transition-transform",
          open && "rotate-180",
        )} />
      </div>
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 bg-background dark:bg-zinc-900">
          <div className="max-h-[200px] overflow-y-auto py-1">
            {filtered.length > 0 ? (
              filtered.map((asset) => {
                const selected = asset.qualified_name === value;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-xs font-mono text-left text-foreground",
                      "hover:bg-accent/80 transition-colors",
                      selected && "bg-primary/10 text-primary font-semibold",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(asset.qualified_name)}
                  >
                    <Table2 className={cn("h-3 w-3 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                    <span className="truncate">{asset.qualified_name}</span>
                  </button>
                );
              })
            ) : search.trim() && isLoadNode ? (
              <button
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-left text-foreground hover:bg-accent/80 transition-colors"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(search.trim())}
              >
                <FilePlus2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>
                  Create <span className="font-mono font-semibold">{search.trim()}</span>
                </span>
              </button>
            ) : (
              <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                {!assets?.length ? "No assets discovered" : "No matches"}
              </div>
            )}
          </div>
          {isLoadNode && filtered.length > 0 && search.trim() && !filtered.some((a) => a.qualified_name === search.trim()) && (
            <div className="border-t border-border">
              <button
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-left text-foreground hover:bg-accent/80 transition-colors"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(search.trim())}
              >
                <FilePlus2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>
                  Create <span className="font-mono font-semibold">{search.trim()}</span>
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
        {children}
      </span>
      <div className="h-px bg-border flex-1" />
    </div>
  );
}

const KIND_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  extract: { label: "Source", icon: Database, color: "bg-blue-500/10 text-blue-500" },
  load: { label: "Destination", icon: ArrowRightLeft, color: "bg-emerald-500/10 text-emerald-500" },
  transform: { label: "Processor", icon: Zap, color: "bg-violet-500/10 text-violet-500" },
  gate: { label: "Quality Gate", icon: Zap, color: "bg-amber-500/10 text-amber-500" },
};

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
  const isProcessorNode = kind === "transform" || kind === "processor";

  const meta = KIND_META[kind] || KIND_META.transform;
  const KindIcon = meta.icon;

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
      kind: "transform",
    } as Record<string, unknown>);
  };

  const relevantIntegrations = integrations?.filter(
    (i) => !adapter || i.adapter_type === adapter,
  );

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
    <aside className="w-72 shrink-0 border-l border-border bg-card h-full overflow-y-auto flex flex-col relative z-20 shadow-xl animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.color)}>
            <KindIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-none truncate">
              {node.data.label as string}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
              {meta.label} Node
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150 shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1">
        <div className="space-y-1.5">
          <FieldLabel>Label</FieldLabel>
          <Input
            type="text"
            value={node.data.label as string}
            onChange={(e) =>
              onUpdate(node.id, { ...node.data, label: e.target.value })
            }
            className="h-9 text-[13px] font-medium"
          />
        </div>

        {isDataNode && (
          <div className="space-y-4">
            <SectionHeader>Connection</SectionHeader>

            <div className="space-y-1.5">
              <FieldLabel>Integration</FieldLabel>
              <Select
                value={(config.integration_id as string) || ""}
                onValueChange={(val) => {
                  const newConfig = {
                    ...config,
                    integration_id: val,
                    asset: undefined,
                  };
                  setConfig(newConfig);
                  onUpdate(node.id, {
                    ...node.data,
                    config: newConfig,
                  } as Record<string, unknown>);
                }}
              >
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Select Integration..." />
                </SelectTrigger>
                <SelectContent>
                  {relevantIntegrations?.map((int) => (
                    <SelectItem key={int.id} value={int.id}>
                      {int.name}
                    </SelectItem>
                  ))}
                  {relevantIntegrations?.length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                      No matching integrations found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>
                <span className="flex items-center justify-between w-full">
                  <span>Target Asset</span>
                  {!!config.integration_id && !assets?.length && kind !== "load" && (
                    <span className="text-[11px] text-amber-500 font-medium">
                      Run Discovery
                    </span>
                  )}
                </span>
              </FieldLabel>
              <AssetCombobox
                value={(config.asset as string) || ""}
                onChange={(val) => handleConfigChange("asset", val)}
                assets={assets}
                disabled={!config.integration_id}
                isLoadNode={kind === "load"}
              />
              {kind === "load" && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Type a new name to create it, or pick an existing asset.
                </p>
              )}
              {kind === "extract" && !!config.integration_id && !assets?.length && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Go to Integrations to run asset discovery for this source.
                </p>
              )}
            </div>
          </div>
        )}

        {isProcessorNode && (
          <div className="space-y-4">
            <SectionHeader>Processor</SectionHeader>

            <div className="space-y-1.5">
              <FieldLabel>Type</FieldLabel>
              <Select
                value={(config.processor_type as string) || ""}
                onValueChange={handleProcessorSelect}
              >
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Select Processor..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedProcessors).map(([category, procs]) => (
                    <div key={category}>
                      <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
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

            {selectedProcessor && (
              <div className="rounded-xl bg-secondary/70 p-3 border border-border space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-violet-500" />
                  About
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {selectedProcessor.description}
                </p>
              </div>
            )}

            {selectedProcessor && selectedProcessor.parameters.length > 0 && (
              <div className="space-y-4">
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

      <div className="p-3 border-t border-border flex items-center justify-between sticky bottom-0 z-10 bg-card">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          Changes applied
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="danger"
              size="sm"
              className="h-8 rounded-lg px-2.5 opacity-50 hover:opacity-100 transition-opacity"
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
