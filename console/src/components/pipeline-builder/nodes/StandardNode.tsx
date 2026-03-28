import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Database, Cloud, FileSpreadsheet, Plug, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const ADAPTER_ICONS: Record<string, React.ElementType> = {
  postgresql: Database,
  snowflake: Database,
  salesforce: Cloud,
  hubspot: Cloud,
  stripe: Plug,
  google_sheets: FileSpreadsheet,
};

const STAGE_COLORS: Record<string, string> = {
  extract: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  transform: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  load: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  gate: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

const STAGE_RING: Record<string, string> = {
  extract: "ring-blue-500/30",
  transform: "ring-violet-500/30",
  load: "ring-emerald-500/30",
  gate: "ring-amber-500/30",
};

export function StandardNode({ data, selected }: NodeProps) {
  const kind = data.kind as string;
  const isExtract = kind === "extract";
  const isLoad = kind === "load";
  const isProcessor = kind === "transform" || kind === "processor";

  const Icon = isProcessor
    ? Zap
    : ADAPTER_ICONS[data.adapter as string] || Plug;

  const colorClass =
    STAGE_COLORS[kind] || STAGE_COLORS.transform;
  const ringClass =
    STAGE_RING[kind] || STAGE_RING.transform;

  const subtitle = isProcessor
    ? `processor${data.processor_type ? ` · ${data.processor_type}` : ""}`
    : `${kind}${data.adapter ? ` · ${data.adapter}` : ""}`;

  return (
    <div
      className={cn(
        "relative flex min-w-[210px] flex-col rounded-xl border bg-card p-3.5 shadow-sm transition-all duration-150",
        selected
          ? `border-primary/50 ring-2 ${ringClass} shadow-md`
          : "border-border hover:shadow-md hover:border-border/80",
      )}
    >
      {!isExtract && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !bg-muted-foreground !border-2 !border-background !rounded-full"
        />
      )}

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border",
            colorClass,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold text-foreground truncate">
            {data.label as string}
          </h3>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>

      {!isLoad && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !bg-muted-foreground !border-2 !border-background !rounded-full"
        />
      )}
    </div>
  );
}
