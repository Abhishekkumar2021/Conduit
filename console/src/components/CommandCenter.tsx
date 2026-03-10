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

  /* ─── Logic: Keyboard Shortcuts ───────────────────────────── */

  useEffect(() => {
    const openCenter = () => {
      setSearch("");
      setSelectedIndex(0);
      setIsOpen(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!isOpen) {
          openCenter();
        } else {
          setIsOpen(false);
        }
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
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  /* ─── Logic: Command List Building ────────────────────────── */

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
        description: "Open the creation builder",
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
      pipelines.forEach((p) => {
        items.push({
          id: `pipe-${p.id}`,
          label: p.name,
          description: "Jump to Pipeline",
          category: "Pipelines",
          icon: GitBranch,
          action: () => navigate(`/pipelines/${p.id}`),
        });
      });
    }

    if (integrations && Array.isArray(integrations)) {
      integrations.forEach((i) => {
        items.push({
          id: `int-${i.id}`,
          label: i.name,
          description: i.adapter_type,
          category: "Integrations",
          icon: Plug,
          action: () => navigate("/integrations"),
        });
      });
    }

    return items;
  }, [navigate, pipelines, integrations]);

  /* ─── Logic: Filtering & Grouping ────────────────────────── */

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

  const flattenedItems = useMemo(() => {
    return CATEGORIES.flatMap((cat) => filteredAndGrouped[cat]);
  }, [filteredAndGrouped]);

  useEffect(() => {
    if (scrollRef.current && flattenedItems.length > 0) {
      const selectedElement = scrollRef.current.querySelector(
        `[data-index="${selectedIndex}"]`,
      ) as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [selectedIndex, flattenedItems]);

  /* ─── Logic: Handlers ────────────────────────────────────── */

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const len = flattenedItems.length;
    if (len === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % len);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + len) % len);
    } else if (e.key === "Enter" && flattenedItems[selectedIndex]) {
      e.preventDefault();
      flattenedItems[selectedIndex].action();
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div
        className="absolute inset-0 bg-background/10 backdrop-blur-md animate-in fade-in duration-300"
        onClick={() => setIsOpen(false)}
      />

      <div className="relative w-full max-w-[600px] bg-popover/95 backdrop-blur-xl shadow-2xl rounded-2xl border border-border/40 overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-200">
        <div className="px-5 py-4 border-b border-border bg-muted/5">
          <div className="relative flex items-center">
            <Search
              className="absolute left-0 h-5 w-5 text-muted-foreground/20"
              strokeWidth={2.5}
            />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search anything..."
              className="w-full bg-transparent pl-8 pr-4 py-1 text-[18px] font-medium text-foreground placeholder:text-muted-foreground/20 border-none outline-none focus:ring-0"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            <div className="flex items-center gap-1.5 ml-2">
              <kbd className="h-5 px-1.5 flex items-center justify-center bg-muted/50 text-[10px] font-bold rounded border border-border text-muted-foreground/20">
                ESC
              </kbd>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="max-h-[420px] overflow-y-auto p-2 custom-scrollbar"
        >
          {flattenedItems.length === 0 ? (
            <div className="py-20 text-center text-[13px] font-medium text-muted-foreground/30 italic">
              No results for "{search}"
            </div>
          ) : (
            CATEGORIES.map((category, catIdx) => {
              const items = filteredAndGrouped[category];
              if (items.length === 0) return null;

              let startIdx = 0;
              for (let i = 0; i < catIdx; i++) {
                startIdx += filteredAndGrouped[CATEGORIES[i]].length;
              }

              return (
                <div key={category} className="mb-2 last:mb-0">
                  <div className="px-4 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
                      {category}
                    </span>
                  </div>
                  <div className="space-y-0.5">
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
                            "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-75 text-left relative",
                            isSelected
                              ? "bg-accent/80 text-foreground"
                              : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                          )}
                        >
                          <div
                            className={cn(
                              "shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                              isSelected
                                ? "bg-background text-foreground/80 shadow-sm"
                                : "text-muted-foreground/30",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div
                              className={cn(
                                "text-[14px] font-bold tracking-tight truncate leading-tight",
                                isSelected
                                  ? "text-foreground"
                                  : "text-foreground/80",
                              )}
                            >
                              {item.label}
                            </div>
                            {item.description && (
                              <div
                                className={cn(
                                  "text-[11px] font-medium mt-0.5 truncate leading-tight opacity-70",
                                  isSelected
                                    ? "text-foreground/80"
                                    : "text-muted-foreground",
                                )}
                              >
                                {item.description}
                              </div>
                            )}
                          </div>

                          {isSelected && (
                            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-1 duration-200 pr-1">
                              <span className="text-[10px] font-extrabold text-muted-foreground/40">
                                ↵
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-muted/5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground/30">
              <div className="flex items-center gap-1">
                <kbd className="flex items-center justify-center w-5 h-5 rounded border border-border/50 bg-muted/20 text-[10px] font-bold">
                  ↑
                </kbd>
                <kbd className="flex items-center justify-center w-5 h-5 rounded border border-border/50 bg-muted/20 text-[10px] font-bold">
                  ↓
                </kbd>
              </div>
              <span className="uppercase tracking-widest text-[8px] font-bold">
                Navigate
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground/30">
              <kbd className="flex items-center justify-center px-1.5 h-5 rounded border border-border/50 bg-muted/20 text-[10px] font-bold">
                ⏎
              </kbd>
              <span className="uppercase tracking-widest text-[8px] font-bold">
                Open
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-muted-foreground/10 uppercase">
            <CommandIcon className="h-3.5 w-3.5" />
            <span>Search</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandCenter;
