import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  hover = false,
  padding = true,
  ...props
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card transition-all duration-200",
        padding && "p-4 sm:p-5",
        hover &&
          "cursor-pointer hover:border-primary/50 hover:bg-muted/30 active:scale-[0.98]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
