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
    <Card className="p-4 sm:p-5 border-border/40 hover:border-primary/20 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground">
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
                prev.
              </span>
            </p>
          )}
        </div>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5 text-primary/70 border border-primary/10">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
