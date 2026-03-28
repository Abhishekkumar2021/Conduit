import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./Card";

export type StatColor = "blue" | "emerald" | "violet" | "amber" | "rose" | "default";

const COLOR_MAP: Record<StatColor, { bg: string; text: string; glow: string }> = {
  blue:    { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", glow: "rgba(59,130,246,0.15)" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", glow: "rgba(16,185,129,0.15)" },
  violet:  { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", glow: "rgba(139,92,246,0.15)" },
  amber:   { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", glow: "rgba(245,158,11,0.15)" },
  rose:    { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", glow: "rgba(244,63,94,0.15)" },
  default: { bg: "bg-primary/10", text: "text-primary", glow: "rgba(59,130,246,0.10)" },
};

export function StatCard({
  label,
  value,
  change,
  icon,
  color = "default",
}: {
  label: string;
  value: string | number;
  change?: string;
  icon?: ReactNode;
  color?: StatColor;
}) {
  const isPositive = change?.startsWith("+");
  const c = COLOR_MAP[color];
  return (
    <Card
      className="relative p-4 group overflow-hidden"
      hover
      style={{ boxShadow: `var(--stat-glow) ${c.glow}` }}
    >
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-4 bg-current" />
      <div className="flex items-start justify-between relative">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">
            {value}
          </p>
          {change && (
            <p
              className={cn(
                "text-xs font-semibold",
                isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110",
              c.bg,
              c.text,
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
