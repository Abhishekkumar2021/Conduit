import { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  GitBranch,
  Plug,
  Play,
  Zap,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  Settings,
  Search,
  ScrollText,
  ShieldAlert,
  Network,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { CommandCenter } from "@/components/CommandCenter";
import { cn } from "@/lib/utils";
import { useAuthStore, useLogout } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { useRunUpdates } from "@/hooks/useWebSocket";

const NAV_MAIN = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pipelines", label: "Pipelines", icon: GitBranch },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/runs", label: "Runs", icon: Play },
];

const NAV_SECONDARY = [
  { to: "/lineage", label: "Lineage", icon: Network },
  { to: "/quarantine", label: "Quarantine", icon: ShieldAlert },
  { to: "/audit", label: "Audit Log", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
];

function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5",
        collapsed ? "justify-center" : "px-1",
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary to-blue-700 shadow-md shadow-primary/30">
        <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
      </div>
      {!collapsed && (
        <span className="text-[15px] font-bold tracking-tight">Conduit</span>
      )}
    </div>
  );
}

function NavItem({
  item,
  collapsed,
  onNavigate,
}: {
  item: (typeof NAV_MAIN)[number];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center rounded-xl text-[13px] font-medium transition-all duration-200",
          collapsed
            ? "justify-center h-9 w-9 mx-auto"
            : "gap-2.5 px-2.5 py-2",
          isActive
            ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
            : "text-muted-foreground hover:bg-accent/80 hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary" />
          )}
          <item.icon
            className={cn(
              "h-[18px] w-[18px] shrink-0 transition-colors",
              isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
            )}
            strokeWidth={isActive ? 2 : 1.7}
          />
          {!collapsed && <span>{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}

function NavSection({
  items,
  collapsed,
  onNavigate,
  label,
}: {
  items: typeof NAV_MAIN;
  collapsed: boolean;
  onNavigate?: () => void;
  label?: string;
}) {
  return (
    <div className="space-y-0.5">
      {label && !collapsed && (
        <p className="px-3 mb-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
          {label}
        </p>
      )}
      {items.map((item) => (
        <NavItem
          key={item.to}
          item={item}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

function SidebarContent({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { user } = useAuthStore();
  const logout = useLogout();
  const { data: workspaces } = useWorkspaces();
  const workspaceData = workspaces?.[0];
  const initials = user?.display_name
    ? user.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  return (
    <>
      <div className={cn("pt-5 pb-4", collapsed ? "px-2" : "px-4")}>
        <Logo collapsed={collapsed} />
      </div>

      {!collapsed && (
        <>
          {workspaceData && (
            <div className="px-4 mb-2">
              <div className="px-2.5 py-1.5 rounded-xl bg-secondary/50 border border-border/50">
                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                  Workspace
                </p>
                <p className="text-xs font-medium text-foreground truncate mt-0.5">
                  {workspaceData.name}
                </p>
              </div>
            </div>
          )}
          <div className="px-3 mb-3">
            <button
              onClick={() =>
                window.dispatchEvent(new CustomEvent("conduit:open-command-center"))
              }
              className="flex items-center w-full gap-2 px-2.5 py-2 rounded-xl bg-secondary/60 text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200 text-left border border-border/40"
            >
              <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span className="flex-1 text-xs text-muted-foreground/70">Search...</span>
              <kbd className="hidden lg:inline text-[10px] text-muted-foreground/50 font-mono bg-background rounded px-1 py-0.5 border border-border/50">
                ⌘K
              </kbd>
            </button>
          </div>
        </>
      )}

      <nav className={cn("flex-1 flex flex-col gap-5 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
        <NavSection items={NAV_MAIN} collapsed={collapsed} onNavigate={onNavigate} />
        <div className={cn("h-px bg-border/60", collapsed ? "mx-1" : "mx-1")} />
        <NavSection
          items={NAV_SECONDARY}
          collapsed={collapsed}
          onNavigate={onNavigate}
          label="Platform"
        />
      </nav>

      <div className={cn("border-t border-border/60 p-3", collapsed ? "flex flex-col items-center gap-2" : "")}>
        {!collapsed && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary/15 to-violet-500/15 text-xs font-semibold text-primary">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">
                  {user?.display_name ?? "User"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {user?.email ?? ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                onClick={logout}
                title="Sign out"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        {collapsed && (
          <>
            <ThemeToggle />
            <button
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-primary/15 to-violet-500/15 text-[11px] font-semibold text-primary hover:from-primary/20 hover:to-violet-500/20 transition-all duration-200"
              title={user?.display_name ?? "User"}
              onClick={logout}
            >
              {initials}
            </button>
          </>
        )}
      </div>
    </>
  );
}

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
        "hidden md:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out relative",
        collapsed ? "w-[56px]" : "w-[230px]",
      )}
    >
      <SidebarContent collapsed={collapsed} />

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-7 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent shadow-sm transition-all duration-150 hover:scale-110"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronsRight className="h-3 w-3" />
        ) : (
          <ChevronsLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}

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
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed left-0 top-0 z-50 h-full flex flex-col bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-out md:hidden w-[260px]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent onNavigate={() => setOpen(false)} collapsed={false} />
      </div>
    </>
  );
}

function WebSocketProvider() {
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id;
  useRunUpdates(workspaceId);
  return null;
}

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
      <WebSocketProvider />
      <CommandCenter />
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
