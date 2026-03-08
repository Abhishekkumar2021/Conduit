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
