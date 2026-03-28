import React, { useEffect, useMemo, useState } from "react";
import { Plug2, Shield, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import type { Adapter } from "@/hooks/queries/useIntegrations";

interface FieldSpec {
  name: string;
  type: string;
  defaultValue: string | number;
  isSecret: boolean;
}

const parseFieldSpec = (spec: string): FieldSpec => {
  let name = spec;
  let type = "text";
  let defaultValue: string | number = "";
  let isSecret = false;

  const partsWithDefault = spec.split("=", 2);
  if (partsWithDefault.length > 1) {
    defaultValue = partsWithDefault[1];
    name = partsWithDefault[0];
  }

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

interface IntegrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  adapters: Adapter[] | undefined;
  workspaceId: string;
  integrationId?: string;
  initialName?: string;
  initialAdapterType?: string;
  initialConfig?: Record<string, string | number>;
  onSave: (data: {
    name: string;
    adapter_type: string;
    config: Record<string, string | number>;
  }) => void;
  isSaving: boolean;
}

export function IntegrationDialog({
  isOpen,
  onClose,
  adapters,
  workspaceId,
  integrationId,
  initialName = "",
  initialAdapterType = "",
  initialConfig = {},
  onSave,
  isSaving,
}: IntegrationDialogProps) {
  const isEditMode = !!integrationId;
  const [name, setName] = useState(initialName);
  const [adapterType, setAdapterType] = useState<string | null>(
    initialAdapterType || null,
  );
  const [configValues, setConfigValues] =
    useState<Record<string, string | number>>(initialConfig);

  useEffect(() => {
    setName(initialName);
    setAdapterType(initialAdapterType || null);
    setConfigValues(initialConfig);
  }, [initialName, initialAdapterType, initialConfig]);

  const effectiveAdapterType = adapterType || adapters?.[0]?.type || "";
  const selectedAdapter = adapters?.find(
    (a) => a.type === effectiveAdapterType,
  );

  const adaptersByCategory = useMemo(() => {
    if (!adapters) return {};
    const groups: Record<string, Adapter[]> = {};
    const order = ["sql", "nosql", "storage", "api"];
    for (const a of adapters) {
      (groups[a.category] ??= []).push(a);
    }
    const sorted: Record<string, Adapter[]> = {};
    for (const cat of order) {
      if (groups[cat]) sorted[cat] = groups[cat];
    }
    return sorted;
  }, [adapters]);

  const categoryLabels: Record<string, string> = {
    sql: "Databases",
    nosql: "NoSQL",
    storage: "Storage",
    api: "APIs",
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !name.trim() || !effectiveAdapterType) return;

    const finalConfig = { ...configValues };
    selectedAdapter?.vault_fields.forEach((spec) => {
      const parsed = parseFieldSpec(spec);
      if (parsed.type === "number" && finalConfig[parsed.name]) {
        finalConfig[parsed.name] = Number(finalConfig[parsed.name]);
      }
    });

    onSave({
      name: name.trim(),
      adapter_type: effectiveAdapterType,
      config: finalConfig,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-card shadow-2xl shadow-black/20 rounded-xl border border-border overflow-hidden animate-in zoom-in-95 fade-in duration-200 max-h-[calc(100vh-2rem)] flex flex-col">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 flex flex-col space-y-6">
            <div className="flex items-center gap-3 text-left">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Plug2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {isEditMode ? "Edit Integration" : "New Integration"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Securely connect your data sources
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="w-full text-left space-y-5"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-foreground">
                      Name
                    </label>
                    <Input
                      autoFocus
                      placeholder="e.g. Production DB"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-foreground">
                      Adapter
                    </label>
                    <Select
                      value={effectiveAdapterType}
                      onValueChange={setAdapterType}
                      disabled={isEditMode}
                    >
                      <SelectTrigger className="h-9 text-[13px]">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(adaptersByCategory).map(([cat, items]) => (
                          <SelectGroup key={cat}>
                            <SelectLabel>{categoryLabels[cat] ?? cat}</SelectLabel>
                            {items.map((adapter) => (
                              <SelectItem key={adapter.type} value={adapter.type}>
                                {adapter.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedAdapter && selectedAdapter.vault_fields.length > 0 && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-2.5">
                      <Shield className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                        Configuration
                      </span>
                      <div className="h-px bg-border flex-1" />
                    </div>
                    {selectedAdapter.vault_fields.some((s) => s.includes(":secret")) && (
                      <p className="text-[11px] text-muted-foreground/70 leading-relaxed rounded-lg bg-secondary/50 px-3 py-2 border border-border">
                        Secret fields store an <strong>environment variable name</strong>, not
                        the actual value. Set the env var on the server process
                        (e.g. <code className="font-mono text-[10px] bg-secondary px-1 py-0.5 rounded">export MY_DB_PASS=secret</code>).
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      {selectedAdapter.vault_fields.map((spec) => {
                        const field = parseFieldSpec(spec);
                        return (
                          <div
                            key={field.name}
                            className={cn(
                              "space-y-1.5",
                              [
                                "host",
                                "password",
                                "database",
                                "token",
                                "key",
                                "url",
                                "uri",
                                "secret",
                                "hosts",
                                "base_url",
                                "connection",
                                "credentials",
                                "bucket",
                                "instance_url",
                              ].some((k) =>
                                field.name.toLowerCase().includes(k),
                              )
                                ? "col-span-2"
                                : "col-span-1",
                            )}
                          >
                            <label className="text-[13px] font-medium text-foreground flex items-center justify-between">
                              <span className="capitalize">
                                {field.name.replace(/_/g, " ")}
                              </span>
                              {field.isSecret && (
                                <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
                                  Env Var
                                </span>
                              )}
                            </label>
                            <div className="relative group">
                              <Input
                                type="text"
                                placeholder={
                                  field.isSecret
                                    ? `e.g. MY_${field.name.toUpperCase()}`
                                    : field.defaultValue
                                      ? String(field.defaultValue)
                                      : `Enter ${field.name}`
                                }
                                className={cn(
                                  "font-mono text-[13px]",
                                  field.isSecret ? "pr-10" : "",
                                )}
                                value={configValues[field.name] || ""}
                                onChange={(e) =>
                                  setConfigValues((prev) => ({
                                    ...prev,
                                    [field.name]:
                                      field.type === "number"
                                        ? Number(e.target.value)
                                        : e.target.value,
                                  }))
                                }
                                required
                              />
                              {field.isSecret && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors">
                                  <Lock className="h-3.5 w-3.5" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                  disabled={isSaving || !name.trim()}
                >
                  {isSaving ? "Saving..." : isEditMode ? "Update" : "Create Integration"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
