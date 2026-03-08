import React from "react";
import { Database, Zap, ArrowRightLeft } from "lucide-react";
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
    label: "Transform",
    description: "Apply SQL or Python logic",
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
    <aside className="w-56 shrink-0 border-l border-border/40 bg-card/40 backdrop-blur-sm p-4 h-full overflow-y-auto">
      <h3 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4">
        Node Library
      </h3>

      <div className="space-y-2">
        {NODE_TYPES.map((node) => (
          <div
            key={node.kind}
            className={cn(
              "group relative flex cursor-grab items-center gap-3 rounded-lg border border-border/60 bg-card p-2.5 transition-all hover:border-primary/40 hover:shadow-sm active:cursor-grabbing",
            )}
            onDragStart={(event) => onDragStart(event, node.type, node.kind)}
            draggable
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                node.color,
              )}
            >
              <node.icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-[11px] font-semibold text-foreground leading-none">
                {node.label}
              </h4>
              <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight truncate">
                {node.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
