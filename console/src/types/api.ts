/**
 * TypeScript definitions mapping to the FastAPI Pydantic models.
 */

// ── Auth ──

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  auth_provider: string;
}

// ── Workspace ──

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

// ── Pipeline ──

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "paused" | "archived";
  schedule_cron?: string | null;
  schedule_timezone?: string | null;
  workspace_id: string;
  published_revision_id?: string | null;
}

export interface PipelineCreate {
  name: string;
  description?: string;
}

export interface Stage {
  id: string;
  key: string;
  label: string;
  kind: "extract" | "transform" | "load" | "gate";
  integration_id?: string;
  config: Record<string, string | number | boolean | null>;
  position_x: number;
  position_y: number;
}

export interface Edge {
  id: string;
  source_id: string;
  target_id: string;
}

export interface Revision {
  id: string;
  number: number;
  summary: string;
  is_published: boolean;
  stages: Stage[];
  edges: Edge[];
}

export interface StageCreate {
  key: string;
  label: string;
  kind: "extract" | "transform" | "load" | "gate";
  integration_id?: string;
  config?: Record<string, string | number | boolean | null>;
  position_x: number;
  position_y: number;
}

export interface EdgeCreate {
  source_key: string;
  target_key: string;
}

export interface RevisionCreate {
  number: number;
  summary: string;
  stages: StageCreate[];
  edges: EdgeCreate[];
}

// ── Schedule ──

export interface PipelineSchedule {
  pipeline_id: string;
  schedule_cron: string | null;
  schedule_timezone: string | null;
  next_fire_at: string | null;
}

// ── Integration ──

export interface Asset {
  id: string;
  integration_id: string;
  qualified_name: string;
  asset_type: string;
  discovered_at: string;
}

export interface Integration {
  id: string;
  name: string;
  adapter_type: string;
  status: "untested" | "healthy" | "degraded" | "unreachable";
  status_message?: string;
  config?: Record<string, string | number | boolean | null>;
}

// ── Runs ──

export interface Run {
  id: string;
  pipeline_id: string;
  trigger_type: "manual" | "schedule" | "api";
  status:
    | "pending"
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "cancelled";
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  error_message?: string;
}

export interface RunStep {
  id: string;
  stage_key: string;
  stage_kind: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  records_in: number;
  records_out: number;
  records_failed: number;
  bytes_processed: number;
  checkpoint?: Record<string, unknown> | null;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  error_message?: string;
}

export interface RunDetail extends Run {
  steps: RunStep[];
}

// ── Metrics ──

export interface WorkspaceSummary {
  pipelines: number;
  integrations: number;
  runs_24h: RunStats;
  runs_7d: RunStats;
}

export interface RunStats {
  total: number;
  succeeded: number;
  failed: number;
  running: number;
  pending: number;
}

export interface RunTrendPoint {
  date: string;
  total: number;
  succeeded: number;
  failed: number;
}

export interface PipelineStat {
  pipeline_id: string;
  name: string;
  status: string;
  total_runs: number;
  succeeded: number;
  failed: number;
  avg_duration_ms: number | null;
  last_run_at: string | null;
}

export interface Throughput {
  period_days: number;
  total_records_in: number;
  total_records_out: number;
  total_records_failed: number;
  total_bytes_processed: number;
}

// ── Audit ──

export interface AuditLogEntry {
  id: string;
  workspace_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Quarantine ──

export interface QuarantinedRecord {
  id: string;
  workspace_id: string;
  pipeline_id: string;
  run_id: string;
  record_data: Record<string, unknown>;
  quality_score: number;
  failed_rules: Record<string, unknown> | unknown[];
  resolution: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface QuarantineSummary {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

// ── Lineage ──

export interface LineageNode {
  id: string;
  name?: string;
  adapter_type?: string;
  status?: string;
  pipelines?: string[];
}

export interface LineageEdge {
  source: string;
  target: string;
  pipeline_id: string;
  pipeline_name: string;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

// ── Preview ──

export interface DataPreview {
  asset: string;
  columns: string[];
  records: Record<string, unknown>[];
  total: number;
  truncated: boolean;
}

// ── WebSocket ──

export interface RunUpdateMessage {
  type: "run.update";
  data: {
    id: string;
    pipeline_id: string;
    status: Run["status"];
    started_at: string | null;
    duration_ms: number | null;
  };
}
