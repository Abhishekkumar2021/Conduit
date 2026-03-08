import { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  GitBranch,
  Plug,
  Play,
  Settings,
  Zap,
  ChevronRight,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

/* ─── Navigation ────────────────────────────────────────────── */

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pipelines", label: "Pipelines", icon: GitBranch },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/runs", label: "Runs", icon: Play },
  { to: "/settings", label: "Settings", icon: Settings },
];

/* ─── Logo ──────────────────────────────────────────────────── */

function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5",
        collapsed ? "justify-center px-0" : "px-1",
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-blue-600 shadow-md shadow-blue-500/20">
        <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
      </div>
      {!collapsed && (
        <div className="overflow-hidden whitespace-nowrap fade-in">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">
            Conduit
          </h1>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Console
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Sidebar Content (shared between desktop and mobile) ──── */

function SidebarContent({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  return (
    <>
      <div className={cn("pt-4 pb-2", collapsed ? "px-2" : "px-3")}>
        <Logo collapsed={collapsed} />
      </div>

      <nav className="mt-5 flex flex-col gap-0.5 px-2">
        {!collapsed && (
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap overflow-hidden">
            Platform
          </p>
        )}
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "group flex items-center rounded-lg py-2 font-medium transition-all duration-150 overflow-hidden",
                collapsed ? "justify-center px-0" : "gap-2.5 px-3",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                  strokeWidth={1.8}
                />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-[13px] whitespace-nowrap">
                      {item.label}
                    </span>
                    {isActive && (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div
        className={cn(
          "mt-auto flex flex-col items-center border-t border-border p-3",
          collapsed ? "py-4" : "",
        )}
      >
        {!collapsed && (
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-indigo-500 text-[11px] font-bold text-white">
                  U
                </div>
                <div className="min-w-0 pr-2">
                  <p className="truncate text-[12px] font-medium text-foreground">
                    User
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Workspace Admin
                  </p>
                </div>
              </div>
            </div>
            <ThemeToggle />
          </div>
        )}
        {collapsed && (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-indigo-500 text-[11px] font-bold text-white"
            title="User"
          >
            U
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Desktop Sidebar ───────────────────────────────────────── */

function DesktopSidebar({
  collapsed,
  setCollapsed,
}: {
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
}) {
  return (
    <aside
      className={cn(
        "hidden md:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)] relative",
        collapsed ? "w-[64px]" : "w-[220px]",
      )}
    >
      <SidebarContent collapsed={collapsed} />

      {/* Collapse Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-60 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent shadow-sm transition-all"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-3.5 w-3.5" />
        ) : (
          <PanelLeftClose className="h-3.5 w-3.5" />
        )}
      </button>
    </aside>
  );
}

/* ─── Mobile Header + Drawer ────────────────────────────────── */

function MobileHeader({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  return (
    <>
      <header className="flex md:hidden items-center justify-between border-b border-border bg-card px-4 py-3 shrink-0">
        <Logo />
        <button
          onClick={() => setOpen(!open)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed left-0 top-0 z-50 h-full flex flex-col bg-sidebar border-r border-sidebar-border transform transition-transform duration-250 ease-out md:hidden",
          "w-[260px]", // slightly wider on mobile for touch targets
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent onNavigate={() => setOpen(false)} collapsed={false} />
      </div>
    </>
  );
}

/* ─── AppLayout ─────────────────────────────────────────────── */

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    return localStorage.getItem("conduit-sidebar-collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("conduit-sidebar-collapsed", String(desktopCollapsed));
  }, [desktopCollapsed]);

  return (
    <div className="flex h-full flex-col md:flex-row overflow-hidden bg-background">
      <MobileHeader open={mobileOpen} setOpen={setMobileOpen} />
      <DesktopSidebar
        collapsed={desktopCollapsed}
        setCollapsed={setDesktopCollapsed}
      />
      <main className="flex-1 overflow-x-hidden overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
