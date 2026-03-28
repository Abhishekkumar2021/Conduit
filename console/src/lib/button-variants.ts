import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "icon" | "icon-sm";

export const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-linear-to-b from-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:brightness-110 active:brightness-95",
  secondary:
    "bg-secondary text-secondary-foreground border border-border hover:bg-accent hover:border-border/80 active:bg-accent/80",
  ghost:
    "text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent/80",
  danger:
    "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white hover:border-destructive active:brightness-95",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-xs",
  md: "h-9 px-4 text-sm",
  icon: "h-9 w-9 shrink-0",
  "icon-sm": "h-8 w-8 shrink-0",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-40",
    SIZE_STYLES[size],
    BUTTON_STYLES[variant],
    className,
  );
}
