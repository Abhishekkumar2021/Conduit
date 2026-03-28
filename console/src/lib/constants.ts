/* ─── Status Maps (shared across pages) ─────────────────────── */

export const RUN_STATUS = {
  succeeded: { variant: "success" as const, label: "Succeeded" },
  failed: { variant: "danger" as const, label: "Failed" },
  running: { variant: "info" as const, label: "Running" },
  pending: { variant: "default" as const, label: "Pending" },
  queued: { variant: "info" as const, label: "Queued" },
  cancelled: { variant: "default" as const, label: "Cancelled" },
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
  untested: { variant: "default" as const, label: "Untested" },
};

/* ─── Navigation Items ──────────────────────────────────────── */

import type { LucideIcon } from "lucide-react";
import {
  Database,
  Cloud,
  Globe,
  Box,
  CircleDot,
  Cylinder,
  HardDrive,
  Warehouse,
  Search,
  Server,
  FileCode2,
  FolderOpen,
  Upload,
  Network,
} from "lucide-react";

export const ADAPTER_UI_MAP: Record<
  string,
  { icon: LucideIcon; color: string }
> = {
  postgresql: {
    icon: Database,
    color: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  mysql: {
    icon: Cylinder,
    color: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  mongodb: {
    icon: CircleDot,
    color: "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400",
  },
  snowflake: {
    icon: Cloud,
    color: "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  s3: {
    icon: Box,
    color: "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  rest_api: {
    icon: Globe,
    color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  salesforce: {
    icon: Cloud,
    color: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  bigquery: {
    icon: Warehouse,
    color: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  mssql: {
    icon: Server,
    color: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
  },
  sqlite: {
    icon: FileCode2,
    color: "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
  duckdb: {
    icon: Database,
    color: "bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  },
  redshift: {
    icon: Warehouse,
    color: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  redis: {
    icon: HardDrive,
    color: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
  },
  elasticsearch: {
    icon: Search,
    color: "bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  local_file: {
    icon: FolderOpen,
    color: "bg-slate-50 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400",
  },
  gcs: {
    icon: Cloud,
    color: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  azure_blob: {
    icon: Cloud,
    color: "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  sftp: {
    icon: Upload,
    color: "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  ftp: {
    icon: Network,
    color: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
};

export const DEFAULT_ADAPTER = {
  icon: Box,
  color: "bg-zinc-100 dark:bg-zinc-500/10 text-zinc-500 dark:text-zinc-400",
};
