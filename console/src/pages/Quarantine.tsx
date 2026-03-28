import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  Database,
  ShieldCheck,
  ShieldX,
  XCircle,
  Eye,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { usePipelines } from "@/hooks/queries/usePipelines";
import {
  useBulkResolve,
  useQuarantineRecords,
  useQuarantineSummary,
  useResolveQuarantine,
} from "@/hooks/useQuarantine";
import type { QuarantinedRecord } from "@/types/api";

function failedRulesCount(
  failedRules: QuarantinedRecord["failed_rules"],
): number {
  if (Array.isArray(failedRules)) return failedRules.length;
  if (failedRules && typeof failedRules === "object")
    return Object.keys(failedRules).length;
  return 0;
}

function recordKeysPreview(data: Record<string, unknown>, maxLen = 42): string {
  const keys = Object.keys(data).slice(0, 2);
  if (keys.length === 0) return "—";
  const text = keys.join(", ");
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

function qualityBadgeVariant(
  score: number,
): "success" | "warning" | "danger" {
  if (score > 80) return "success";
  if (score > 50) return "warning";
  return "danger";
}

function RecordDetailDrawer({
  record,
  pipelineName,
  onClose,
}: {
  record: QuarantinedRecord;
  pipelineName: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl h-full bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Record Details</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quality Score:{" "}
              <span className="font-semibold tabular-nums">
                {Math.round(record.quality_score)}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Metadata
            </h3>
            <div className="rounded-xl border border-border divide-y divide-border">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground">Pipeline</span>
                <Link
                  to={`/pipelines/${record.pipeline_id}`}
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={onClose}
                >
                  {pipelineName}
                </Link>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground">Run</span>
                <Link
                  to={`/runs/${record.run_id}`}
                  className="text-xs font-mono text-primary hover:underline"
                  onClick={onClose}
                >
                  #{record.run_id.slice(0, 8)}
                </Link>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground">
                  Resolution
                </span>
                <Badge
                  variant={
                    record.resolution === "approved"
                      ? "success"
                      : record.resolution === "rejected"
                        ? "danger"
                        : "warning"
                  }
                >
                  {record.resolution}
                </Badge>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground">Created</span>
                <span className="text-xs text-foreground">
                  {new Date(record.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Record Data
            </h3>
            <pre className="rounded-xl border border-border bg-muted/50 p-4 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
              {JSON.stringify(record.record_data, null, 2)}
            </pre>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Failed Rules
            </h3>
            <pre className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-4 text-xs font-mono text-red-600 dark:text-red-400 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
              {JSON.stringify(record.failed_rules, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Quarantine() {
  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id;

  const { data: summary, isLoading: summaryLoading } =
    useQuarantineSummary(workspaceId);
  const {
    data: records,
    isLoading: recordsLoading,
    isError: recordsError,
  } = useQuarantineRecords(workspaceId);

  const { data: pipelines } = usePipelines(workspaceId ?? "");
  const pipelineMap = new Map(pipelines?.map((p) => [p.id, p.name]) ?? []);

  const resolveMutation = useResolveQuarantine();
  const bulkMutation = useBulkResolve();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [detailRecord, setDetailRecord] = useState<QuarantinedRecord | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const pendingRecords = useMemo(
    () => records?.filter((r) => r.resolution === "pending") ?? [],
    [records],
  );

  const allPendingSelected =
    pendingRecords.length > 0 &&
    pendingRecords.every((r) => selectedIds.has(r.id));
  const somePendingSelected = pendingRecords.some((r) =>
    selectedIds.has(r.id),
  );

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = somePendingSelected && !allPendingSelected;
  }, [somePendingSelected, allPendingSelected]);

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPending = () => {
    const pendingIds = pendingRecords.map((r) => r.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pendingIds.every((id) => next.has(id))) {
        pendingIds.forEach((id) => next.delete(id));
      } else {
        pendingIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const mutationsPending =
    resolveMutation.isPending || bulkMutation.isPending;

  const handleResolve = (
    id: string,
    resolution: "approved" | "rejected",
  ) => {
    resolveMutation.mutate(
      { id, resolution },
      {
        onSuccess: () => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      },
    );
  };

  const handleBulk = (resolution: "approved" | "rejected") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkMutation.mutate(
      { ids, resolution },
      {
        onSuccess: () => clearSelection(),
      },
    );
  };

  if (!workspacesLoading && !workspaceId) {
    return (
      <div className="fade-in max-w-7xl mx-auto p-6 lg:p-8">
        <PageHeader
          title="Data Quality"
          description="Review and resolve quarantined records"
        />
        <div className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No workspace available. Create or select a workspace to manage
          quarantine.
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in max-w-7xl mx-auto p-6 lg:p-8">
      <PageHeader
        title="Data Quality"
        description="Review and resolve quarantined records"
      />

      {/* Summary */}
      <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[92px] w-full rounded-lg" />
            ))}
          </>
        ) : (
          <>
            <StatCard
              label="Pending"
              value={summary?.pending ?? 0}
              icon={
                <span className="text-amber-600 dark:text-amber-400">
                  <Clock className="h-4 w-4" />
                </span>
              }
            />
            <StatCard
              label="Approved"
              value={summary?.approved ?? 0}
              icon={
                <span className="text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                </span>
              }
            />
            <StatCard
              label="Rejected"
              value={summary?.rejected ?? 0}
              icon={
                <span className="text-red-600 dark:text-red-400">
                  <ShieldX className="h-4 w-4" />
                </span>
              }
            />
            <StatCard
              label="Total"
              value={summary?.total ?? 0}
              icon={
                <span className="text-primary">
                  <Database className="h-4 w-4" />
                </span>
              }
            />
          </>
        )}
      </div>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <Card
          padding={false}
          className="mt-6 flex flex-col gap-3 border-border bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {selectedIds.size}
            </span>
            <span>
              {selectedIds.size === 1 ? "record" : "records"} selected
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={bulkMutation.isPending}
              className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              onClick={() => handleBulk("approved")}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve Selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={bulkMutation.isPending}
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              onClick={() => handleBulk("rejected")}
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject Selected
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={bulkMutation.isPending}
              onClick={clearSelection}
            >
              Clear
            </Button>
          </div>
        </Card>
      )}

      {/* Table */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between px-1">
          <h2 className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
            Quarantined Records
          </h2>
        </div>

        {recordsLoading && (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )}

        {recordsError && !recordsLoading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-sm text-destructive dark:border-red-500/20 dark:bg-red-500/10">
            Could not load quarantine records. Try again shortly.
          </div>
        )}

        {!recordsLoading && !recordsError && (records?.length ?? 0) === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">All clear</h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
              No quarantined records. All data has passed quality checks.
            </p>
          </div>
        )}

        {!recordsLoading && !recordsError && (records?.length ?? 0) > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 pl-4">
                  <span className="sr-only">Select</span>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    disabled={
                      mutationsPending || pendingRecords.length === 0
                    }
                    checked={allPendingSelected}
                    onChange={toggleSelectAllPending}
                    className="h-4 w-4 cursor-pointer rounded-md border-border bg-background text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Select all pending records"
                  />
                </TableHead>
                <TableHead>Quality score</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Record data</TableHead>
                <TableHead className="tabular-nums">Failed rules</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(records ?? []).map((row) => {
                const isPending = row.resolution === "pending";
                const qVariant = qualityBadgeVariant(row.quality_score);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="pl-4">
                      <input
                        type="checkbox"
                        disabled={!isPending || mutationsPending}
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        className="h-4 w-4 cursor-pointer rounded-md border-border bg-background text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Select record ${row.id.slice(0, 8)}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={qVariant}
                        className="tabular-nums font-semibold"
                      >
                        {Math.round(row.quality_score)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/pipelines/${row.pipeline_id}`}
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {pipelineMap.get(row.pipeline_id) ?? row.pipeline_id.slice(0, 10)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <button
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setDetailRecord(row)}
                      >
                        <Eye className="h-3 w-3" />
                        <span className="max-w-[160px] truncate">
                          {recordKeysPreview(row.record_data)}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {failedRulesCount(row.failed_rules)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      <span title={new Date(row.created_at).toLocaleString()}>
                        {formatDistanceToNow(new Date(row.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!isPending || resolveMutation.isPending}
                          className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                          onClick={() =>
                            handleResolve(row.id, "approved")
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!isPending || resolveMutation.isPending}
                          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          onClick={() =>
                            handleResolve(row.id, "rejected")
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {detailRecord && (
        <RecordDetailDrawer
          record={detailRecord}
          pipelineName={pipelineMap.get(detailRecord.pipeline_id) ?? "Unknown Pipeline"}
          onClose={() => setDetailRecord(null)}
        />
      )}
    </div>
  );
}
