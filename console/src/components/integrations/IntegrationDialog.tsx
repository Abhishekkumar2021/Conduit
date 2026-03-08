import React, { useState } from "react";
import { Plug2, Shield, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
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

  // Edit mode props
  integrationId?: string;
  initialName?: string;
  initialAdapterType?: string;
  initialConfig?: Record<string, string | number>;

  // Actions
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

  const effectiveAdapterType = adapterType || adapters?.[0]?.type || "";
  const selectedAdapter = adapters?.find(
    (a) => a.type === effectiveAdapterType,
  );

  // No longer using useEffect to sync, instead we rely on the parent updating the key
  // or we can sync specifically on initial click.

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
        className="absolute inset-0 bg-background/50 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-card shadow-2xl rounded-2xl border border-border/50 overflow-hidden animate-in zoom-in-95 fade-in duration-200 max-h-[calc(100vh-2rem)] flex flex-col">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 z-10 p-2 rounded-full text-muted-foreground/40 hover:bg-muted/50 hover:text-foreground transition-all"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 sm:p-8 flex flex-col space-y-6">
            <div className="flex items-center gap-4 text-left">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Plug2 className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-[17px] font-bold tracking-tight text-foreground/90 leading-tight">
                  {isEditMode ? "Integration Settings" : "Add Integration"}
                </h2>
                <p className="text-[10px] text-muted-foreground/50 font-bold tracking-widest uppercase">
                  Securely connect your data sources
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="w-full text-left space-y-6"
            >
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground/60 px-1 tracking-widest uppercase">
                      Integration Name
                    </label>
                    <Input
                      autoFocus
                      placeholder="e.g. Production DB"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground/60 px-1 tracking-widest uppercase">
                      Adapter Type
                    </label>
                    <Select
                      value={effectiveAdapterType}
                      onValueChange={setAdapterType}
                      disabled={isEditMode}
                    >
                      <SelectTrigger className="h-9 font-medium text-sm">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-border/40 shadow-xl bg-card">
                        {adapters?.map((adapter) => (
                          <SelectItem
                            key={adapter.type}
                            value={adapter.type}
                            className="mx-1 my-0.5 font-medium"
                          >
                            {adapter.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedAdapter && selectedAdapter.vault_fields.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-3 px-1 text-primary/60">
                      <Shield className="h-3 w-3" />
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em]">
                        Credentials
                      </span>
                      <div className="h-px bg-border/20 flex-1" />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {selectedAdapter.vault_fields.map((spec) => {
                        const field = parseFieldSpec(spec);
                        return (
                          <div key={field.name} className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground/60 px-1 flex items-center justify-between tracking-widest uppercase">
                              <span className="capitalize tracking-normal">
                                {field.name.replace(/_/g, " ")}
                              </span>
                              {field.isSecret && (
                                <span className="text-[8px] font-bold uppercase text-emerald-600/60 tracking-wider">
                                  Encrypted
                                </span>
                              )}
                            </label>
                            <div className="relative group">
                              <Input
                                type={
                                  field.type === "password"
                                    ? "password"
                                    : "text"
                                }
                                placeholder={
                                  field.isSecret
                                    ? "Vault secret reference"
                                    : field.defaultValue
                                      ? String(field.defaultValue)
                                      : `Enter ${field.name}`
                                }
                                className={cn(
                                  "font-mono text-[13px] tracking-tight",
                                  field.isSecret ? "pr-10" : ""
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
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 text-muted-foreground/20 group-focus-within:text-primary/40 transition-colors">
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

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/20">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="h-9 px-4 text-[12px] font-bold text-muted-foreground/60 hover:text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="h-9 px-6 text-[12px] font-bold shadow-lg shadow-primary/10"
                  disabled={isSaving || !name.trim()}
                >
                  {isSaving
                    ? "Saving..."
                    : isEditMode
                      ? "Update"
                      : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
