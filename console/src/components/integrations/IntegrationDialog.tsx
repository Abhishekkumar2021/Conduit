import React, { useState } from "react";
import { Plug2, Shield, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
      <div className="relative w-full max-w-lg bg-card shadow-2xl rounded-[32px] border border-border/50 overflow-hidden animate-in zoom-in-95 fade-in duration-200 max-h-[calc(100vh-2rem)] flex flex-col">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 z-10 p-2 rounded-full text-muted-foreground/40 hover:bg-muted/50 hover:text-foreground transition-all"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-7 sm:p-10 flex flex-col items-center text-center space-y-7">
            <div className="space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Plug2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-foreground/90">
                  {isEditMode ? "Integration Settings" : "Add Integration"}
                </h2>
                <p className="text-[12px] text-muted-foreground/60 font-bold tracking-tight">
                  Securely connect your data sources or destinations
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="w-full text-left space-y-8"
            >
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-foreground/80 px-1 tracking-tight">
                      Integration Name
                    </label>
                    <input
                      autoFocus
                      className="w-full bg-muted/10 border border-border/60 rounded-2xl px-4 py-3 text-sm focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/10 outline-none transition-all placeholder:text-muted-foreground/30 font-medium"
                      placeholder="e.g. Production DB"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-foreground/80 px-1 tracking-tight">
                      Adapter Type
                    </label>
                    <Select
                      value={effectiveAdapterType}
                      onValueChange={setAdapterType}
                      disabled={isEditMode}
                    >
                      <SelectTrigger className="h-[46px] bg-muted/10 border border-border/60 rounded-xl px-4 focus:border-primary/40 focus:bg-background focus:ring-4 focus:ring-primary/5 outline-none transition-all font-medium text-sm">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/40 shadow-xl bg-card">
                        {adapters?.map((adapter) => (
                          <SelectItem
                            key={adapter.type}
                            value={adapter.type}
                            className="rounded-lg mx-1 my-0.5"
                          >
                            {adapter.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedAdapter && selectedAdapter.vault_fields.length > 0 && (
                  <div className="space-y-6 pt-2">
                    <div className="flex items-center gap-3 px-1 text-primary/70">
                      <Shield className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        Credentials
                      </span>
                      <div className="h-px bg-border/20 flex-1" />
                    </div>

                    <div className="grid grid-cols-1 gap-5">
                      {selectedAdapter.vault_fields.map((spec) => {
                        const field = parseFieldSpec(spec);
                        return (
                          <div key={field.name} className="space-y-2">
                            <label className="text-[11px] font-bold text-foreground/70 px-1 flex items-center justify-between tracking-tight">
                              <span className="capitalize">
                                {field.name.replace(/_/g, " ")}
                              </span>
                              {field.isSecret && (
                                <span className="text-[9px] font-bold uppercase text-emerald-600/70 tracking-wider">
                                  Encrypted
                                </span>
                              )}
                            </label>
                            <div className="relative group">
                              <input
                                type={
                                  field.type === "password"
                                    ? "password"
                                    : "text"
                                }
                                className="w-full bg-muted/10 border border-border/60 rounded-xl px-4 py-3 text-sm focus:border-primary/40 focus:bg-background focus:ring-4 focus:ring-primary/5 outline-none transition-all placeholder:text-muted-foreground/30 font-medium tabular-nums"
                                placeholder={
                                  field.isSecret
                                    ? "Vault secret reference"
                                    : field.defaultValue
                                      ? String(field.defaultValue)
                                      : `Enter ${field.name}`
                                }
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
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none text-muted-foreground/30 group-focus-within:text-primary/40 transition-colors">
                                  <Lock className="h-4 w-4" />
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

              <div className="flex flex-col gap-3 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  className="h-12 w-full rounded-xl text-[14px] font-bold shadow-lg shadow-primary/5 hover:scale-[1.01] active:scale-[0.99] transition-all"
                  disabled={isSaving || !name.trim()}
                >
                  {isSaving
                    ? "Configuring..."
                    : isEditMode
                      ? "Save Changes"
                      : "Create Integration"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="h-10 w-full rounded-xl text-[12px] font-bold text-muted-foreground/40 hover:text-foreground transition-all"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
