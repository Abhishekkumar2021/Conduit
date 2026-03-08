import { useState, useLayoutEffect, type ReactNode } from "react";
import { ThemeContext, type Theme } from "@/lib/theme-context";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("conduit-theme") as Theme | null;
    return saved && ["light", "dark"].includes(saved) ? saved : "dark";
  });

  const resolved = theme;

  // Apply the class + persist
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (resolved === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
    localStorage.setItem("conduit-theme", theme);
  }, [theme, resolved]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
