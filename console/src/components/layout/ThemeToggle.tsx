import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { Theme } from "@/lib/theme-context";

const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-all duration-150 ${
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={opt.label}
            aria-label={`Switch to ${opt.label} theme`}
          >
            <opt.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        );
      })}
    </div>
  );
}
