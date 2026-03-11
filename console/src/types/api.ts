/**
 * TypeScript definitions mapping to the FastAPI Pydantic models.
 */

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "paused" | "archived";
  schedule_cron?: string;
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
  kind: "extract" | "processor" | "load" | "gate";
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
  status: "healthy" | "degraded" | "unreachable";
  status_message?: string;
  config?: Record<string, string | number | boolean | null>;
  last_sync_at?: string;
}

export interface Run {
  id: string;
  pipeline_id: string;
  revision_id: string;
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

export interface RunDetail {
  id: string;
  pipeline_id: string;
  status: Run["status"];
  trigger_type: Run["trigger_type"];
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  error_message?: string;
  steps: RunStep[];
}

export interface StageCreate {
  key: string;
  label: string;
  kind: "extract" | "processor" | "load" | "gate";
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
