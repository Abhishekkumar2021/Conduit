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
        "rounded-xl border border-border/50 bg-card shadow-(--card-shadow) transition-all duration-200 ease-in-out",
        padding && "p-6",
        hover &&
          "cursor-pointer hover:border-border hover:shadow-md active:scale-[0.998]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
