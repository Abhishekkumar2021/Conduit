import React from "react";
import { Database, Zap, ArrowRightLeft, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const NODE_TYPES = [
  {
    type: "standard",
    kind: "extract",
    label: "Source",
    description: "Ingest data from external systems",
    icon: Database,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  {
    type: "standard",
    kind: "transform",
    label: "Processor",
    description: "Transform data with built-in processors",
    icon: Zap,
    color: "text-violet-500 bg-violet-500/10 border-violet-500/20",
  },
  {
    type: "standard",
    kind: "load",
    label: "Destination",
    description: "Export data to target systems",
    icon: ArrowRightLeft,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
];

export function PipelineSidebar() {
  const onDragStart = (
    event: React.DragEvent,
    nodeType: string,
    kind: string,
  ) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.setData("application/kind", kind);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="w-72 shrink-0 border-l border-border bg-card h-full overflow-y-auto flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Node Library</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Drag nodes onto the canvas</p>
      </div>

      <div className="p-3 space-y-1.5 flex-1">
        {NODE_TYPES.map((node) => (
          <div
            key={node.kind}
            className={cn(
              "group relative flex cursor-grab items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all duration-150 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 active:cursor-grabbing active:scale-[0.98]",
            )}
            onDragStart={(event) => onDragStart(event, node.type, node.kind)}
            draggable
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground/60 transition-colors" />
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                node.color,
              )}
            >
              <node.icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[13px] font-semibold text-foreground leading-none">
                {node.label}
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1 leading-tight truncate">
                {node.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
