import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Database, Cloud, FileSpreadsheet, Plug } from "lucide-react";
import { cn } from "@/lib/utils";

const ADAPTER_ICONS: Record<string, React.ElementType> = {
  postgres: Database,
  snowflake: Database,
  salesforce: Cloud,
  hubspot: Cloud,
  stripe: Plug,
  google_sheets: FileSpreadsheet,
};

const STAGE_COLORS = {
  extract: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  transform: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  load: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

export function StandardNode({ data, selected }: NodeProps) {
  const Icon = ADAPTER_ICONS[data.adapter as string] || Plug;
  const isExtract = data.kind === "extract";
  const isLoad = data.kind === "load";

  const colorClass =
    STAGE_COLORS[data.kind as keyof typeof STAGE_COLORS] ||
    STAGE_COLORS.transform;

  return (
    <div
      className={cn(
        "relative flex min-w-[200px] flex-col rounded-xl border bg-card p-3 shadow-sm transition-shadow",
        selected
          ? "border-primary ring-1 ring-primary/50 shadow-md"
          : "border-border",
      )}
    >
      {!isExtract && (
        <Handle
          type="target"
          position={Position.Left}
          className="h-3 w-3 bg-muted-foreground border-2 border-background"
        />
      )}

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border",
            colorClass,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {data.label as string}
          </h3>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {data.kind as string} {data.adapter ? `· ${data.adapter}` : ""}
          </p>
        </div>
      </div>

      {!isLoad && (
        <Handle
          type="source"
          position={Position.Right}
          className="h-3 w-3 bg-muted-foreground border-2 border-background"
        />
      )}
    </div>
  );
}
