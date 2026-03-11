import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  LayoutDashboard,
  GitBranch,
  Play,
  Settings,
  Plus,
  Plug,
  Command as CommandIcon,
  ArrowRight,
} from "lucide-react";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { usePipelines } from "@/hooks/queries/usePipelines";
import { useIntegrations } from "@/hooks/queries/useIntegrations";
import { cn } from "@/lib/utils";

/* ─── Types & Constants ─────────────────────────────────────── */

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  category: "Navigation" | "Actions" | "Pipelines" | "Integrations";
  action: () => void;
  keywords?: string[];
}

const CATEGORIES = [
  "Navigation",
  "Actions",
  "Pipelines",
  "Integrations",
] as const;

/* ─── Command Center Component ───────────────────────────────── */

export function CommandCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";
  const { data: pipelines } = usePipelines(workspaceId);
  const { data: integrations } = useIntegrations(workspaceId);

  /* ─── Keyboard Shortcuts ──────────────────────────────────── */

  useEffect(() => {
    const openCenter = () => {
      setSearch("");
      setSelectedIndex(0);
      setIsOpen(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!isOpen) openCenter();
        else setIsOpen(false);
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    const handleOpenEvent = () => openCenter();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("conduit:open-command-center", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(
        "conduit:open-command-center",
        handleOpenEvent,
      );
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 10);
  }, [isOpen]);

  /* ─── Command List ────────────────────────────────────────── */

  const commands = useMemo(() => {
    const items: Command[] = [
      {
        id: "nav-dashboard",
        label: "Dashboard",
        description: "Overview and metrics",
        category: "Navigation",
        icon: LayoutDashboard,
        action: () => navigate("/dashboard"),
        keywords: ["home", "stats", "overview"],
      },
      {
        id: "nav-pipelines",
        label: "Pipelines",
        description: "Manage data flows",
        category: "Navigation",
        icon: GitBranch,
        action: () => navigate("/pipelines"),
        keywords: ["dag", "workflow", "jobs"],
      },
      {
        id: "nav-integrations",
        label: "Integrations",
        description: "Data adapters and vault",
        category: "Navigation",
        icon: Plug,
        action: () => navigate("/integrations"),
        keywords: ["connectors", "sources", "vault"],
      },
      {
        id: "nav-runs",
        label: "Runs",
        description: "History and logs",
        category: "Navigation",
        icon: Play,
        action: () => navigate("/runs"),
        keywords: ["logs", "history", "status"],
      },
      {
        id: "nav-settings",
        label: "Settings",
        description: "Account and workspace",
        category: "Navigation",
        icon: Settings,
        action: () => navigate("/settings"),
        keywords: ["preferences", "profile"],
      },
      {
        id: "act-new-pipeline",
        label: "Create New Pipeline",
        description: "Open the pipeline builder",
        category: "Actions",
        icon: Plus,
        action: () => navigate("/pipelines?action=create"),
      },
      {
        id: "act-add-integration",
        label: "Add Integration",
        description: "Connect a new data source",
        category: "Actions",
        icon: Plus,
        action: () => navigate("/integrations?action=create"),
      },
    ];

    if (pipelines && Array.isArray(pipelines)) {
      pipelines.forEach((p) =>
        items.push({
          id: `pipe-${p.id}`,
          label: p.name,
          description: "Open pipeline",
          category: "Pipelines",
          icon: GitBranch,
          action: () => navigate(`/pipelines/${p.id}`),
        }),
      );
    }

    if (integrations && Array.isArray(integrations)) {
      integrations.forEach((i) =>
        items.push({
          id: `int-${i.id}`,
          label: i.name,
          description: i.adapter_type,
          category: "Integrations",
          icon: Plug,
          action: () => navigate("/integrations"),
        }),
      );
    }

    return items;
  }, [navigate, pipelines, integrations]);

  /* ─── Filtering & Grouping ────────────────────────────────── */

  const filteredAndGrouped = useMemo(() => {
    const s = search.toLowerCase().trim();
    const filtered = s
      ? commands.filter(
          (c) =>
            c.label.toLowerCase().includes(s) ||
            c.description?.toLowerCase().includes(s) ||
            c.keywords?.some((k) => k.toLowerCase().includes(s)) ||
            c.category.toLowerCase().includes(s),
        )
      : commands;

    const grouped: Record<string, Command[]> = {};
    CATEGORIES.forEach((cat) => {
      grouped[cat] = filtered.filter((c) => c.category === cat);
    });
    return grouped;
  }, [search, commands]);

  const flattenedItems = useMemo(
    () => CATEGORIES.flatMap((cat) => filteredAndGrouped[cat]),
    [filteredAndGrouped],
  );

  useEffect(() => {
    if (scrollRef.current && flattenedItems.length > 0) {
      const el = scrollRef.current.querySelector(
        `[data-index="${selectedIndex}"]`,
      ) as HTMLElement;
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex, flattenedItems]);

  /* ─── Input Key Handler ───────────────────────────────────── */

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const len = flattenedItems.length;
    if (len === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % len);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + len) % len);
    } else if (e.key === "Enter" && flattenedItems[selectedIndex]) {
      e.preventDefault();
      flattenedItems[selectedIndex].action();
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  /* ─── Render ──────────────────────────────────────────────── */

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center pt-[14vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-[560px] mx-4 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-2xl animate-in zoom-in-95 slide-in-from-top-2 duration-200"
        style={{
          boxShadow:
            "0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05) inset",
        }}
      >
        {/* Search */}
        <div className="flex items-center gap-3 px-4 border-b border-border/60">
          <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent py-3.5 text-[15px] text-foreground placeholder:text-muted-foreground/40 border-none outline-none"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground/50 bg-muted/60 rounded border border-border/60">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={scrollRef} className="max-h-[380px] overflow-y-auto py-1.5">
          {flattenedItems.length === 0 ? (
            <div className="py-14 text-center">
              <Search className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/50">
                No results for &ldquo;{search}&rdquo;
              </p>
            </div>
          ) : (
            CATEGORIES.map((category, catIdx) => {
              const items = filteredAndGrouped[category];
              if (items.length === 0) return null;

              let startIdx = 0;
              for (let i = 0; i < catIdx; i++)
                startIdx += filteredAndGrouped[CATEGORIES[i]].length;

              return (
                <div key={category}>
                  {catIdx > 0 &&
                    filteredAndGrouped[CATEGORIES[catIdx - 1]]?.length > 0 && (
                      <div className="h-px bg-border/40 mx-3 my-1" />
                    )}
                  <div className="px-4 pt-2.5 pb-1">
                    <span className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                      {category}
                    </span>
                  </div>
                  {items.map((item, itemIdx) => {
                    const globalIdx = startIdx + itemIdx;
                    const isSelected = globalIdx === selectedIndex;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        data-index={globalIdx}
                        onClick={() => {
                          item.action();
                          setIsOpen(false);
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 mx-1.5 py-2 rounded-lg text-left transition-colors duration-75",
                          isSelected
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        style={{ width: "calc(100% - 12px)" }}
                      >
                        <div
                          className={cn(
                            "shrink-0 h-8 w-8 rounded-md flex items-center justify-center transition-colors",
                            isSelected
                              ? "bg-primary/15 text-primary"
                              : "bg-muted/50 text-muted-foreground/60",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div
                            className={cn(
                              "text-[13px] font-semibold truncate",
                              isSelected
                                ? "text-foreground"
                                : "text-foreground/80",
                            )}
                          >
                            {item.label}
                          </div>
                          {item.description && (
                            <div className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
                              {item.description}
                            </div>
                          )}
                        </div>

                        {isSelected && (
                          <ArrowRight className="h-3.5 w-3.5 text-primary/60 shrink-0 animate-in fade-in slide-in-from-left-1 duration-150" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/40 bg-muted/20">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
              <kbd className="px-1 py-px rounded bg-muted/60 border border-border/50 text-[10px] font-mono font-semibold">
                ↑↓
              </kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
              <kbd className="px-1 py-px rounded bg-muted/60 border border-border/50 text-[10px] font-mono font-semibold">
                ↵
              </kbd>
              open
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/30 uppercase tracking-wider">
            <CommandIcon className="h-3 w-3" />
            Conduit
          </span>
        </div>
      </div>
    </div>
  );
}

export default CommandCenter;
