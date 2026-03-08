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
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          {change && (
            <p
              className={cn(
                "mt-1 text-[12px] font-medium",
                isPositive ? "text-success" : "text-destructive",
              )}
            >
              {change} from last week
            </p>
          )}
        </div>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
