import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Search,
  ScrollText,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { useAuditLog } from "@/hooks/useAudit";
import type { AuditLogEntry } from "@/types/api";

const ENTITY_TYPES = [
  { value: "all", label: "All entities" },
  { value: "pipeline", label: "Pipeline" },
  { value: "integration", label: "Integration" },
  { value: "workspace", label: "Workspace" },
  { value: "run", label: "Run" },
] as const;

function actionBadgeVariant(
  action: string,
): "success" | "info" | "danger" | "default" {
  const a = action.toLowerCase();
  const isCreated =
    a === "created" ||
    a === "create" ||
    a.endsWith(".created") ||
    a.endsWith("_created") ||
    /\bcreated\b/.test(a);
  const isUpdated =
    a === "updated" ||
    a === "update" ||
    a.endsWith(".updated") ||
    a.endsWith("_updated") ||
    /\bupdated\b/.test(a);
  const isDeleted =
    a === "deleted" ||
    a === "delete" ||
    a.endsWith(".deleted") ||
    a.endsWith("_deleted") ||
    /\bdeleted\b/.test(a);
  if (isCreated) return "success";
  if (isUpdated) return "info";
  if (isDeleted) return "danger";
  return "default";
}

function formatMetadata(meta: Record<string, unknown> | null): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
}

function truncateId(value: string | null, max = 10): string {
  if (value == null || value === "") return "—";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

/* ─── Page ────────────────────────────────────────────────────── */

export function AuditLog() {
  const { data: workspaces, isLoading: isWorkspacesLoading } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id;

  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionInput, setActionInput] = useState("");
  const [actionQuery, setActionQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const t = window.setTimeout(() => {
      setActionQuery(actionInput.trim());
    }, 300);
    return () => window.clearTimeout(t);
  }, [actionInput]);

  const apiFilters = useMemo(
    () => ({
      limit: 500,
      entity_type:
        entityFilter && entityFilter !== "all" ? entityFilter : undefined,
    }),
    [entityFilter],
  );

  const { data: auditRows, isLoading: isAuditLoading } = useAuditLog(
    workspaceId,
    apiFilters,
  );

  const logs = useMemo(() => {
    const rows = auditRows ?? [];
    if (!actionQuery) return rows;
    const q = actionQuery.toLowerCase();
    return rows.filter((e) => e.action.toLowerCase().includes(q));
  }, [auditRows, actionQuery]);

  const hasActiveFilters =
    (entityFilter && entityFilter !== "all") || actionInput.trim().length > 0;

  const resetFilters = () => {
    setEntityFilter("all");
    setActionInput("");
    setActionQuery("");
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showTableSkeleton =
    isWorkspacesLoading || (Boolean(workspaceId) && isAuditLoading);
  const noWorkspace =
    !isWorkspacesLoading &&
    (!workspaces?.length || !workspaceId);

  return (
    <div className="fade-in max-w-7xl mx-auto p-6 lg:p-8">
      <PageHeader
        title="Audit Log"
        description="Track all actions and changes"
      />

      {noWorkspace ? (
        <Card className="mt-6 border-dashed border-border">
          <EmptyState
            icon={<ScrollText className="h-6 w-6 opacity-60" />}
            title="No workspace"
            description="Create or select a workspace to view audit history."
          />
        </Card>
      ) : (
        <>
          <Card padding={false} className="mt-6 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border bg-muted/50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-xs font-medium text-muted-foreground">
                Filters
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <div style={{ minWidth: 160, maxWidth: 200 }} className="flex-1">
                  <Select
                    value={entityFilter}
                    onValueChange={setEntityFilter}
                  >
                    <SelectTrigger
                      id="audit-entity-type"
                      className="h-9 text-sm"
                    >
                      <SelectValue placeholder="Entity type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="audit-action-search"
                    type="search"
                    value={actionInput}
                    onChange={(e) => setActionInput(e.target.value)}
                    placeholder="Search by action…"
                    className="h-9 pl-9 text-sm"
                    autoComplete="off"
                  />
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
              {showTableSkeleton ? (
                <Skeleton className="h-4 w-32 rounded-full" />
              ) : (
                <>
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                    {logs.length}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {logs.length === 1 ? "entry" : "entries"}
                  </span>
                </>
              )}
            </div>
          </Card>

          <div className="mt-5">
            {showTableSkeleton ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton
                    key={i}
                    className="h-[64px] w-full rounded-lg"
                  />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <Card className="border-dashed border-border">
                <EmptyState
                  icon={<ScrollText className="h-6 w-6 opacity-60" />}
                  title={
                    hasActiveFilters
                      ? "No matching entries"
                      : "No audit activity yet"
                  }
                  description={
                    hasActiveFilters
                      ? "Try adjusting entity type or action search."
                      : "Actions on pipelines, integrations, and runs will appear here."
                  }
                />
              </Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Timestamp</TableHead>
                    <TableHead className="w-[160px]">Action</TableHead>
                    <TableHead className="w-[120px]">Entity Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead className="w-[100px] text-right">
                      Details
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((entry: AuditLogEntry) => {
                    const expanded = expandedIds.has(entry.id);
                    const metaStr = formatMetadata(entry.metadata);
                    const hasMeta = metaStr.length > 0;
                    return (
                      <Fragment key={entry.id}>
                        <TableRow className="group">
                          <TableCell className="align-top">
                            <span
                              className="text-sm"
                              title={new Date(entry.created_at).toISOString()}
                            >
                              {formatDistanceToNow(new Date(entry.created_at), {
                                addSuffix: true,
                              })}
                            </span>
                            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                              {new Date(entry.created_at).toLocaleString()}
                            </p>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge
                              variant={actionBadgeVariant(entry.action)}
                              dot
                            >
                              <span className="truncate">{entry.action}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <span className="text-xs text-muted-foreground capitalize">
                              {entry.entity_type}
                            </span>
                          </TableCell>
                          <TableCell className="align-top">
                            <span
                              className="block max-w-[160px] truncate font-mono text-xs text-muted-foreground"
                              title={entry.entity_id ?? undefined}
                            >
                              {truncateId(entry.entity_id, 12)}
                            </span>
                          </TableCell>
                          <TableCell className="align-top">
                            <span
                              className="block max-w-[160px] truncate font-mono text-xs text-muted-foreground"
                              title={entry.user_id ?? undefined}
                            >
                              {truncateId(entry.user_id, 12)}
                            </span>
                          </TableCell>
                          <TableCell className="align-top text-right">
                            {hasMeta ? (
                              <button
                                type="button"
                                onClick={() => toggleExpanded(entry.id)}
                                className="inline-flex items-center gap-1 text-xs text-primary transition-colors hover:bg-accent"
                                aria-expanded={expanded}
                              >
                                {expanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                                {expanded ? "Hide" : "View"}
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                        {expanded && hasMeta && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell
                              colSpan={6}
                              className="border-b border-border bg-muted/50 p-0"
                            >
                              <pre
                                className="max-h-48 overflow-auto p-4 font-mono text-xs leading-relaxed text-muted-foreground"
                                tabIndex={0}
                              >
                                {metaStr}
                              </pre>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
