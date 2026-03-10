import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  LayoutDashboard,
  GitBranch,
  Plug,
  ListChecks,
  Settings,
  Plus,
  Moon,
  Sun,
  ArrowRight,
  Command,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { usePipelines } from "@/hooks/queries/usePipelines";
import { useIntegrations } from "@/hooks/queries/useIntegrations";
import { cn } from "@/lib/utils";

/* ─── Types ───────────────────────────────────────────────────── */

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: string;
  action: () => void;
  keywords?: string[];
}

/* ─── Component ───────────────────────────────────────────────── */

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";
  const { data: pipelines } = usePipelines(workspaceId);
  const { data: integrations } = useIntegrations(workspaceId);

  /* ── Keyboard shortcut ─ ⌘K / Ctrl+K ────────────────────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ── Focus input when opened ─────────────────────────────────── */
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  /* ── Execute and close ───────────────────────────────────────── */
  const execute = useCallback((item: CommandItem) => {
    setOpen(false);
    item.action();
  }, []);

  /* ── Build command list ──────────────────────────────────────── */
  const commands = useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = [
      {
        id: "nav-dashboard",
        label: "Dashboard",
        description: "Go to overview",
        icon: <LayoutDashboard className="h-4 w-4" />,
        category: "Navigation",
        action: () => navigate("/dashboard"),
        keywords: ["home", "overview"],
      },
      {
        id: "nav-pipelines",
        label: "Pipelines",
        description: "Manage data pipelines",
        icon: <GitBranch className="h-4 w-4" />,
        category: "Navigation",
        action: () => navigate("/pipelines"),
        keywords: ["dag", "workflow"],
      },
      {
        id: "nav-integrations",
        label: "Integrations",
        description: "Manage connections",
        icon: <Plug className="h-4 w-4" />,
        category: "Navigation",
        action: () => navigate("/integrations"),
        keywords: ["connections", "adapters"],
      },
      {
        id: "nav-runs",
        label: "Runs",
        description: "View execution history",
        icon: <ListChecks className="h-4 w-4" />,
        category: "Navigation",
        action: () => navigate("/runs"),
        keywords: ["executions", "history", "jobs"],
      },
      {
        id: "nav-settings",
        label: "Settings",
        description: "Workspace preferences",
        icon: <Settings className="h-4 w-4" />,
        category: "Navigation",
        action: () => navigate("/settings"),
        keywords: ["preferences", "config"],
      },
    ];

    const actions: CommandItem[] = [
      {
        id: "action-new-pipeline",
        label: "Create Pipeline",
        description: "Start a new data pipeline",
        icon: <Plus className="h-4 w-4" />,
        category: "Actions",
        action: () => navigate("/pipelines"),
        keywords: ["new", "add", "create"],
      },
      {
        id: "action-new-integration",
        label: "Add Integration",
        description: "Connect a new data source",
        icon: <Plus className="h-4 w-4" />,
        category: "Actions",
        action: () => navigate("/integrations"),
        keywords: ["new", "add", "connect"],
      },
      {
        id: "action-toggle-theme",
        label:
          theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
        description: "Toggle appearance",
        icon:
          theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          ),
        category: "Actions",
        action: () => setTheme(theme === "dark" ? "light" : "dark"),
        keywords: ["theme", "appearance", "mode"],
      },
    ];

    const pipelineItems: CommandItem[] = (pipelines ?? []).map((p) => ({
      id: `pipeline-${p.id}`,
      label: p.name,
      description: p.description || "Pipeline",
      icon: <GitBranch className="h-4 w-4" />,
      category: "Pipelines",
      action: () => navigate(`/pipelines/${p.id}`),
      keywords: ["pipeline"],
    }));

    const integrationItems: CommandItem[] = (integrations ?? []).map((i) => ({
      id: `integration-${i.id}`,
      label: i.name,
      description: i.adapter_type,
      icon: <Plug className="h-4 w-4" />,
      category: "Integrations",
      action: () => navigate("/integrations"),
      keywords: ["integration", "connection"],
    }));

    return [...nav, ...actions, ...pipelineItems, ...integrationItems];
  }, [navigate, theme, setTheme, pipelines, integrations]);

  /* ── Filter ──────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.keywords?.some((k) => k.includes(q)),
    );
  }, [query, commands]);

  /* ── Group by category ───────────────────────────────────────── */
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filtered.forEach((item) => {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    });
    return map;
  }, [filtered]);

  /* ── Keyboard navigation ─────────────────────────────────────── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[activeIndex]) {
          execute(filtered[activeIndex]);
        }
      }
    },
    [filtered, activeIndex, execute],
  );

  /* ── Scroll active item into view ────────────────────────────── */
  useEffect(() => {
    const activeEl = listRef.current?.querySelector("[data-active='true']");
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  /* ── Reset active index on filter change ─────────────────────── */
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[999]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="relative mx-auto mt-[15vh] w-full max-w-[560px] px-4 animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl shadow-2xl">
          {/* Search Input */}
          <div className="flex items-center gap-3 border-b border-border/30 px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground/40" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent py-3.5 text-[14px] font-medium text-foreground placeholder:text-muted-foreground/40 outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border/40 bg-muted/30 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground/50">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="max-h-[320px] overflow-y-auto custom-scrollbar p-1.5"
          >
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-muted-foreground/40">
                No results found.
              </div>
            ) : (
              Array.from(grouped.entries()).map(([category, items]) => (
                <div key={category}>
                  <div className="px-2.5 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">
                    {category}
                  </div>
                  {items.map((item) => {
                    flatIndex++;
                    const isActive = flatIndex === activeIndex;
                    const currentIndex = flatIndex;
                    return (
                      <button
                        key={item.id}
                        data-active={isActive}
                        onClick={() => execute(item)}
                        onMouseEnter={() => setActiveIndex(currentIndex)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted/30",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                            isActive
                              ? "bg-primary/15 text-primary"
                              : "bg-muted/30 text-muted-foreground/60",
                          )}
                        >
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold truncate">
                            {item.label}
                          </p>
                          {item.description && (
                            <p className="text-[11px] text-muted-foreground/50 truncate">
                              {item.description}
                            </p>
                          )}
                        </div>
                        {isActive && (
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary/50" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border/30 px-4 py-2">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/40 font-medium">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border/40 bg-muted/30 px-1 py-0.5 text-[9px] font-bold">
                  ↑↓
                </kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border/40 bg-muted/30 px-1 py-0.5 text-[9px] font-bold">
                  ↵
                </kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border/40 bg-muted/30 px-1 py-0.5 text-[9px] font-bold">
                  ESC
                </kbd>
                Close
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/30 font-semibold">
              <Command className="h-3 w-3" />
              Conduit
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
