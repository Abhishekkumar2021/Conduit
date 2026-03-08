import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./Card";

export function StatCard({
  label,
  value,
  change,
  icon,
}: {
  label: string;
  value: string | number;
  change?: string;
  icon?: ReactNode;
}) {
  const isPositive = change?.startsWith("+");
  return (
    <Card className="p-4 sm:p-5 border-border/60 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 px-0.5">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-foreground/90">
            {value}
          </p>
          {change && (
            <p
              className={cn(
                "mt-1 text-[11px] font-bold",
                isPositive ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {change}{" "}
              <span className="text-muted-foreground/60 font-medium ml-0.5">
                vs last week
              </span>
            </p>
          )}
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground/60 border border-border/20 shadow-xs">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
