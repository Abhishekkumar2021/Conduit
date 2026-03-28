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
  ArrowRight,
} from "lucide-react";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { usePipelines } from "@/hooks/queries/usePipelines";
import { useIntegrations } from "@/hooks/queries/useIntegrations";
import { cn } from "@/lib/utils";

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
          action: () => navigate(`/integrations/${i.id}`),
        }),
      );
    }

    return items;
  }, [navigate, pipelines, integrations]);

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

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center pt-[20vh]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => setIsOpen(false)}
      />

      <div className="relative w-full max-w-[520px] mx-4 overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/20 animate-in zoom-in-95 slide-in-from-top-2 duration-200">
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent py-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 border-none outline-none"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/60 bg-secondary rounded border border-border">
            ESC
          </kbd>
        </div>

        <div ref={scrollRef} className="max-h-[340px] overflow-y-auto py-1.5">
          {flattenedItems.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
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
                      <div className="h-px bg-border mx-2 my-1" />
                    )}
                  <div className="px-3 pt-2.5 pb-1">
                    <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
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
                          "w-full flex items-center gap-3 px-3 py-2 mx-1.5 rounded-lg text-left transition-all duration-100",
                          isSelected
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        style={{ width: "calc(100% - 12px)" }}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : "bg-secondary text-muted-foreground",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate">
                            {item.label}
                          </div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground/70 truncate">
                              {item.description}
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border text-xs text-muted-foreground/50">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-1 py-px rounded bg-secondary border border-border text-[10px] font-mono">
              ↑↓
            </kbd>
            navigate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-1 py-px rounded bg-secondary border border-border text-[10px] font-mono">
              ↵
            </kbd>
            open
          </span>
        </div>
      </div>
    </div>
  );
}

export default CommandCenter;
