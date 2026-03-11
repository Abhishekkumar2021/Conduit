import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  secondary: "bg-card text-foreground border border-border hover:bg-accent",
  ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
  danger:
    "bg-destructive/15 text-destructive hover:bg-destructive hover:text-destructive-foreground",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all duration-150 tracking-tight focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    size === "sm"
      ? "h-8 px-3.5 text-[11px] uppercase tracking-wider"
      : "h-10 px-5 text-[13px]",
    BUTTON_STYLES[variant],
    className
  );
}
