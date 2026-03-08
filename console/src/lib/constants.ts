/* ─── Status Maps (shared across pages) ─────────────────────── */

export const RUN_STATUS = {
  succeeded: { variant: "success" as const, label: "Succeeded" },
  failed: { variant: "danger" as const, label: "Failed" },
  running: { variant: "info" as const, label: "Running" },
  pending: { variant: "default" as const, label: "Pending" },
};

export const PIPELINE_STATUS = {
  active: { variant: "success" as const, label: "Active" },
  paused: { variant: "warning" as const, label: "Paused" },
  draft: { variant: "default" as const, label: "Draft" },
};

export const INTEGRATION_STATUS = {
  healthy: { variant: "success" as const, label: "Healthy" },
  degraded: { variant: "warning" as const, label: "Degraded" },
  unreachable: { variant: "danger" as const, label: "Unreachable" },
};

/* ─── Navigation Items ──────────────────────────────────────── */

export const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
  { to: "/pipelines", label: "Pipelines", iconName: "GitBranch" },
  { to: "/integrations", label: "Integrations", iconName: "Plug" },
  { to: "/runs", label: "Runs", iconName: "Play" },
  { to: "/settings", label: "Settings", iconName: "Settings" },
] as const;
import type { LucideIcon } from "lucide-react";
import { Database, Cloud, Globe, Box } from "lucide-react";

export const ADAPTER_UI_MAP: Record<
  string,
  { icon: LucideIcon; color: string }
> = {
  postgres: {
    icon: Database,
    color: "from-blue-500/20 to-indigo-600/20 text-blue-600 dark:text-blue-400",
  },
  snowflake: {
    icon: Cloud,
    color: "from-sky-400/20 to-blue-500/20 text-sky-600 dark:text-sky-400",
  },
  s3: {
    icon: Box,
    color:
      "from-orange-400/20 to-amber-500/20 text-orange-600 dark:text-orange-400",
  },
  rest: {
    icon: Globe,
    color:
      "from-emerald-400/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400",
  },
};

export const DEFAULT_ADAPTER = {
  icon: Box,
  color: "from-zinc-500/20 to-zinc-600/20 text-zinc-500 dark:text-zinc-400",
};
