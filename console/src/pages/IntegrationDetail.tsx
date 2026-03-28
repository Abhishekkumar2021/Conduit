import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Database,
  Table2,
  LayoutTemplate,
  Eye,
  Settings2,
  Plug2,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Hash,
  FileCode2,
  Layers,
  ChevronRight,
  Box,
  Type,
  ToggleLeft,
  Calendar,
  Braces,
  ChevronsUpDown,
  Download,
  Activity,
  BookOpen,
  CheckCircle2,
  ArrowRightLeft,
  Shield,
  File,
  Pin,
  PinOff,
  GripVertical,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/AlertDialog";
import {
  INTEGRATION_STATUS,
  ADAPTER_UI_MAP,
  DEFAULT_ADAPTER,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import {
  useIntegrations,
  useTestConnection,
  useUpdateIntegration,
  useDeleteIntegration,
  useIntegrationAssets,
  useDiscoverAssets,
  useAdapters,
  type Adapter,
} from "@/hooks/queries/useIntegrations";
import { usePipelines } from "@/hooks/queries/usePipelines";
import { IntegrationDialog } from "@/components/integrations/IntegrationDialog";
import { useDataPreview } from "@/hooks/usePreview";
import { useQueryAction } from "@/hooks/useQueryAction";
import type { Integration, Asset, Pipeline } from "@/types/api";

type TabId = "overview" | "assets" | "preview" | "configuration";

const ASSET_TYPE_ICONS: Record<string, typeof Table2> = {
  table: Table2,
  view: LayoutTemplate,
  collection: Database,
  file: File,
  object: FileCode2,
  index: Layers,
  key: Hash,
};

type ColType = "string" | "number" | "boolean" | "date" | "object" | "null";

function detectColType(records: Record<string, unknown>[], col: string): ColType {
  for (const r of records) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    if (typeof v === "boolean") return "boolean";
    if (typeof v === "number") return "number";
    if (typeof v === "object") return "object";
    if (typeof v === "string") {
      if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(v)) return "date";
      return "string";
    }
  }
  return "null";
}

const COL_TYPE_META: Record<ColType, { icon: typeof Type; label: string; color: string }> = {
  string:  { icon: Type,        label: "Text",    color: "text-foreground" },
  number:  { icon: Hash,        label: "Number",  color: "text-blue-600 dark:text-blue-400" },
  boolean: { icon: ToggleLeft,  label: "Boolean", color: "text-amber-600 dark:text-amber-400" },
  date:    { icon: Calendar,    label: "Date",    color: "text-teal-600 dark:text-teal-400" },
  object:  { icon: Braces,      label: "Object",  color: "text-violet-600 dark:text-violet-400" },
  null:    { icon: Type,        label: "Null",    color: "text-muted-foreground/40" },
};

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const CAPABILITY_META: Record<string, { icon: typeof Eye; label: string; desc: string; color: string }> = {
  read:     { icon: BookOpen,        label: "Read",     desc: "Can be used as a Source in pipelines",      color: "text-blue-600 bg-blue-500/10 border-blue-500/20" },
  write:    { icon: ArrowRightLeft,  label: "Write",    desc: "Can be used as a Destination in pipelines", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  discover: { icon: Search,          label: "Discover", desc: "Can scan and list available assets",        color: "text-violet-600 bg-violet-500/10 border-violet-500/20" },
  test:     { icon: Shield,          label: "Test",     desc: "Supports connection health checks",         color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
};

/* ─── Overview Tab ─────────────────────────────────────────── */

function OverviewTab({
  integration,
  adapter,
  assets,
  pipelines,
  onTabChange,
}: {
  integration: Integration;
  adapter?: Adapter;
  assets: Asset[];
  pipelines: Pipeline[];
  onTabChange: (tab: TabId) => void;
}) {
  const navigate = useNavigate();
  const capabilities = adapter?.capabilities ?? [];

  const assetTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of assets) {
      counts[a.asset_type] = (counts[a.asset_type] ?? 0) + 1;
    }
    return counts;
  }, [assets]);

  const linkedPipelines = useMemo(() => {
    return pipelines.filter((p) => {
      const desc = (p.description || "").toLowerCase();
      return desc.includes(integration.name.toLowerCase()) || desc.includes(integration.id);
    });
  }, [pipelines, integration]);

  const status = integration.status || "untested";
  const st = INTEGRATION_STATUS[status as keyof typeof INTEGRATION_STATUS] || INTEGRATION_STATUS.untested;

  return (
    <div className="space-y-6">
      {/* Capabilities — compact row */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["read", "write", "discover", "test"] as const).map((cap) => {
          const meta = CAPABILITY_META[cap];
          const supported = capabilities.includes(cap);
          const Icon = meta.icon;
          return (
            <div
              key={cap}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                supported ? meta.color : "border-border bg-muted/30 text-muted-foreground/40",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </div>
          );
        })}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors" onClick={() => onTabChange("assets")}>
            <Database className="h-3.5 w-3.5" />
            <strong className="text-foreground">{assets.length}</strong> asset{assets.length !== 1 ? "s" : ""}
          </span>
          {linkedPipelines.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <strong className="text-foreground">{linkedPipelines.length}</strong> pipeline{linkedPipelines.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quick start guide */}
        <div className="lg:col-span-2 space-y-5">
          {/* Asset summary */}
          {assets.length > 0 && (
            <Card padding={false}>
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold">Assets</h3>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onTabChange("assets")}>
                  View all <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <div className="p-4 flex items-center gap-3 flex-wrap">
                {Object.entries(assetTypeCounts).map(([type, count]) => {
                  const Icon = ASSET_TYPE_ICONS[type] || Box;
                  return (
                    <div key={type} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => onTabChange("assets")}>
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-semibold tabular-nums">{count}</span>
                      <span className="text-xs text-muted-foreground capitalize">{type}{count !== 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Quick start */}
          <Card padding={false}>
            <div className="px-5 py-3.5 border-b border-border">
              <h3 className="text-sm font-semibold">Quick Start</h3>
            </div>
            <div className="p-5 space-y-3 text-[13px] text-muted-foreground leading-relaxed">
              {capabilities.includes("read") && (
                <div className="flex gap-3 items-start">
                  <BookOpen className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <p><strong className="text-foreground">Source:</strong> Add a Source node in a pipeline and select this integration to read data.</p>
                </div>
              )}
              {capabilities.includes("write") && (
                <div className="flex gap-3 items-start">
                  <ArrowRightLeft className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p><strong className="text-foreground">Destination:</strong> Add a Destination node and specify the target table/file to write data to.</p>
                </div>
              )}
              <div className="pt-1">
                <Button variant="secondary" size="sm" className="text-xs" onClick={() => navigate("/pipelines")}>
                  Go to Pipelines <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Linked pipelines */}
          {linkedPipelines.length > 0 && (
            <Card padding={false}>
              <div className="px-5 py-3.5 border-b border-border">
                <h3 className="text-sm font-semibold">Used in Pipelines</h3>
              </div>
              <div className="divide-y divide-border">
                {linkedPipelines.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => navigate(`/pipelines/${p.id}`)}>
                    <p className="text-sm font-medium">{p.name}</p>
                    <Badge variant={p.status === "active" ? "success" : "default"} dot>{p.status}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right: Details sidebar */}
        <div className="space-y-5">
          <Card padding={false}>
            <div className="px-5 py-3.5 border-b border-border">
              <h3 className="text-sm font-semibold">Details</h3>
            </div>
            <div className="divide-y divide-border text-sm">
              <div className="flex justify-between px-5 py-3">
                <span className="text-muted-foreground">Adapter</span>
                <span className="font-medium">{adapter?.name ?? integration.adapter_type}</span>
              </div>
              <div className="flex justify-between px-5 py-3">
                <span className="text-muted-foreground">Category</span>
                <span className="font-medium capitalize">{adapter?.category ?? "—"}</span>
              </div>
              <div className="flex justify-between px-5 py-3">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={st.variant} dot>{st.label}</Badge>
              </div>
              {integration.status_message && (
                <div className="px-5 py-3">
                  <span className="text-muted-foreground text-xs">Status Message</span>
                  <p className="text-xs text-foreground mt-1 leading-relaxed">{integration.status_message}</p>
                </div>
              )}
              <div className="px-5 py-3">
                <span className="text-muted-foreground text-xs">Integration ID</span>
                <p className="text-xs font-mono text-muted-foreground mt-1 break-all">{integration.id}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── Assets Tab ───────────────────────────────────────────── */

function AssetsTab({
  integrationId,
  workspaceId,
  onPreviewAsset,
}: {
  integrationId: string;
  workspaceId: string;
  onPreviewAsset: (assetName: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { data: assets, isLoading } = useIntegrationAssets(integrationId);
  const {
    mutate: discoverAssets,
    isPending: isDiscovering,
    error: discoverError,
  } = useDiscoverAssets(workspaceId);

  const assetTypes = useMemo(() => {
    const types = new Set((assets || []).map((a) => a.asset_type));
    return Array.from(types).sort();
  }, [assets]);

  const filtered = useMemo(() => {
    return (assets || []).filter((a) => {
      const matchesSearch =
        !search ||
        a.qualified_name.toLowerCase().includes(search.toLowerCase()) ||
        a.asset_type.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || a.asset_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [assets, search, typeFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, Asset[]> = {};
    for (const asset of filtered) {
      const type = asset.asset_type || "other";
      (groups[type] ??= []).push(asset);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-[13px]"
          />
        </div>
        {assetTypes.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                typeFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTypeFilter("all")}
            >
              All
            </button>
            {assetTypes.map((t) => {
              const Icon = ASSET_TYPE_ICONS[t] || Box;
              return (
                <button
                  key={t}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors capitalize",
                    typeFilter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setTypeFilter(t)}
                >
                  <Icon className="h-3 w-3" />
                  {t}s
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => discoverAssets(integrationId)}
            disabled={isDiscovering}
            className="h-9"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isDiscovering && "animate-spin")} />
            {isDiscovering ? "Scanning..." : "Discover"}
          </Button>
          <span className="text-xs text-muted-foreground font-medium tabular-nums">
            {filtered.length}
            {filtered.length !== (assets?.length ?? 0) && `/${assets?.length ?? 0}`} asset{(assets?.length ?? 0) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {discoverError && (
        <div className="flex items-start gap-2.5 p-3 text-xs text-red-600 dark:text-red-400 bg-red-500/5 rounded-lg border border-red-500/20">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p className="font-medium leading-relaxed">{discoverError.message || "Failed to discover assets."}</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="py-16 text-center border-dashed">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{search || typeFilter !== "all" ? "No matching assets" : "No assets discovered"}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                {search || typeFilter !== "all"
                  ? "Try adjusting your filters."
                  : "Click Discover to scan tables, views, and other assets from this integration."}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = ASSET_TYPE_ICONS[type] || Box;
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{type}s</span>
                  <span className="text-xs text-muted-foreground/60 ml-1">({items.length})</span>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  {items.map((asset, idx) => (
                    <div
                      key={asset.id}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer group",
                        idx !== items.length - 1 && "border-b border-border",
                      )}
                      onClick={() => onPreviewAsset(asset.qualified_name)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                        <span className="text-[13px] text-foreground font-mono font-medium truncate">{asset.qualified_name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {asset.discovered_at && (
                          <span className="text-[11px] text-muted-foreground hidden sm:block">
                            {formatDistanceToNow(new Date(asset.discovered_at), { addSuffix: true })}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); onPreviewAsset(asset.qualified_name); }}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Preview
                        </Button>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Data Grid ───────────────────────────────────────────── */

type SortDir = "asc" | "desc" | null;

const ROW_NUM_WIDTH = 52;
const DEFAULT_COL_WIDTH = 180;
const MIN_COL_WIDTH = 80;

function DataGrid({
  columns,
  records,
  truncated,
  total,
}: {
  columns: string[];
  records: Record<string, unknown>[];
  truncated: boolean;
  total: number;
}) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [colSearch, setColSearch] = useState("");
  const [pinnedCols, setPinnedCols] = useState<string[]>([]);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<{ col: string; startX: number; startW: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const colTypes = useMemo(() => {
    const map: Record<string, ColType> = {};
    for (const c of columns) map[c] = detectColType(records, c);
    return map;
  }, [columns, records]);

  const visibleCols = useMemo(() => {
    if (!colSearch.trim()) return columns;
    const q = colSearch.toLowerCase();
    return columns.filter((c) => c.toLowerCase().includes(q));
  }, [columns, colSearch]);

  const orderedCols = useMemo(() => {
    const pinned = pinnedCols.filter((c) => visibleCols.includes(c));
    const unpinned = visibleCols.filter((c) => !pinnedCols.includes(c));
    return [...pinned, ...unpinned];
  }, [visibleCols, pinnedCols]);

  const pinnedLeftOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let left = ROW_NUM_WIDTH;
    for (const col of pinnedCols) {
      if (!visibleCols.includes(col)) continue;
      offsets[col] = left;
      left += colWidths[col] || DEFAULT_COL_WIDTH;
    }
    return offsets;
  }, [pinnedCols, colWidths, visibleCols]);

  const sortedRecords = useMemo(() => {
    if (!sortCol || !sortDir) return records;
    return [...records].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "number" && typeof vb === "number")
        return sortDir === "asc" ? va - vb : vb - va;
      const sa = String(va);
      const sb = String(vb);
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [records, sortCol, sortDir]);

  const handleSort = useCallback((col: string) => {
    setSortCol((prev) => {
      if (prev !== col) { setSortDir("asc"); return col; }
      setSortDir((d) => {
        if (d === "asc") return "desc";
        if (d === "desc") return null;
        return "asc";
      });
      return prev;
    });
  }, []);

  const togglePin = useCallback((col: string) => {
    setPinnedCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  }, []);

  const handleResizeStart = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[col] || DEFAULT_COL_WIDTH;
    setResizing({ col, startX, startW });
  }, [colWidths]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const newWidth = Math.max(MIN_COL_WIDTH, resizing.startW + delta);
      setColWidths((prev) => ({ ...prev, [resizing.col]: newWidth }));
    };
    const onUp = () => setResizing(null);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [resizing]);

  const handleCopy = useCallback((value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedCell(key);
    setTimeout(() => setCopiedCell(null), 1500);
  }, []);

  const handleExportCsv = useCallback(() => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = columns.map(escape).join(",");
    const rows = records.map((r) =>
      columns.map((c) => escape(formatCell(r[c]))).join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "preview.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [columns, records]);

  const handleAutoFit = useCallback((col: string) => {
    const maxContent = Math.max(
      col.length * 9 + 48,
      ...records.slice(0, 100).map((r) => formatCell(r[col]).length * 7.5 + 32),
    );
    setColWidths((prev) => ({ ...prev, [col]: Math.min(Math.max(maxContent, MIN_COL_WIDTH), 500) }));
  }, [records]);

  const isPinned = (col: string) => pinnedCols.includes(col);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30 shrink-0">
        <div className="relative max-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Filter columns..."
            value={colSearch}
            onChange={(e) => setColSearch(e.target.value)}
            className="h-7 w-full rounded-lg border border-border bg-card pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        {pinnedCols.length > 0 && (
          <div className="flex items-center gap-1">
            <Pin className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-medium text-primary tabular-nums">{pinnedCols.length} pinned</span>
            <button
              type="button"
              onClick={() => setPinnedCols([])}
              className="text-[10px] text-muted-foreground hover:text-foreground ml-0.5 underline underline-offset-2"
            >
              clear
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-auto text-[11px] text-muted-foreground font-medium tabular-nums">
          <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1">
            <Table2 className="h-3 w-3" />
            {orderedCols.length}{orderedCols.length !== columns.length && `/${columns.length}`} col{columns.length !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1">
            <Hash className="h-3 w-3" />
            {truncated ? `${records.length} of ${total}+` : records.length} row{records.length !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 hover:bg-accent transition-colors cursor-pointer"
            title="Export as CSV"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        </div>
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        className={cn("flex-1 min-h-0 overflow-auto", resizing && "select-none")}
        style={resizing ? { cursor: "col-resize" } : undefined}
      >
        <table className="border-collapse text-[13px]" style={{ minWidth: "100%" }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted border-b border-border">
              {/* Row number column */}
              <th
                className="sticky left-0 z-30 bg-muted border-r border-border px-2 py-2 text-center text-[10px] font-semibold text-muted-foreground/50 select-none"
                style={{ width: ROW_NUM_WIDTH, minWidth: ROW_NUM_WIDTH }}
              >
                #
              </th>
              {orderedCols.map((col) => {
                const ct = colTypes[col];
                const TypeIcon = COL_TYPE_META[ct].icon;
                const isSorted = sortCol === col && sortDir;
                const pinned = isPinned(col);
                const w = colWidths[col] || DEFAULT_COL_WIDTH;
                return (
                  <th
                    key={col}
                    className={cn(
                      "relative px-3 py-2 text-left whitespace-nowrap select-none border-r border-border/50 last:border-r-0 group/hdr",
                      pinned && "sticky z-20 bg-muted",
                      !pinned && "bg-muted",
                    )}
                    style={{
                      width: w,
                      minWidth: w,
                      maxWidth: w,
                      ...(pinned ? { left: pinnedLeftOffsets[col] } : {}),
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <TypeIcon className={cn("h-3 w-3 shrink-0", COL_TYPE_META[ct].color, "opacity-50")} />
                      <span
                        className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate flex-1 cursor-pointer"
                        onClick={() => handleSort(col)}
                      >
                        {col}
                      </span>
                      <span className="flex items-center gap-0.5 shrink-0">
                        {isSorted ? (
                          <button type="button" onClick={() => handleSort(col)} className="p-0.5 rounded hover:bg-accent/50">
                            {sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSort(col)}
                            className="p-0.5 rounded hover:bg-accent/50 opacity-0 group-hover/hdr:opacity-100 transition-opacity"
                          >
                            <ChevronsUpDown className="h-3 w-3 text-muted-foreground/40" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => togglePin(col)}
                          title={pinned ? "Unpin column" : "Pin column"}
                          className={cn(
                            "p-0.5 rounded transition-all",
                            pinned
                              ? "text-primary hover:bg-primary/10"
                              : "opacity-0 group-hover/hdr:opacity-100 text-muted-foreground/40 hover:text-foreground hover:bg-accent/50",
                          )}
                        >
                          {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                        </button>
                      </span>
                    </div>
                    {/* Resize handle */}
                    <div
                      className={cn(
                        "absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-30 group/resize",
                        "hover:bg-primary/30 active:bg-primary/50",
                        resizing?.col === col && "bg-primary/50",
                      )}
                      onMouseDown={(e) => handleResizeStart(col, e)}
                      onDoubleClick={() => handleAutoFit(col)}
                      title="Drag to resize, double-click to auto-fit"
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/resize:opacity-100 transition-opacity">
                        <GripVertical className="h-3 w-3 text-primary/60" />
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRecords.map((row, ri) => (
              <tr key={ri} className={cn("border-b border-border/40 hover:bg-accent/40 transition-colors", ri % 2 === 1 && "bg-muted/20")}>
                <td
                  className={cn("sticky left-0 z-10 border-r border-border px-2 py-1.5 text-center text-[11px] text-muted-foreground/40 tabular-nums font-mono select-none", ri % 2 === 1 ? "bg-muted" : "bg-card")}
                  style={{ width: ROW_NUM_WIDTH, minWidth: ROW_NUM_WIDTH }}
                >
                  {ri + 1}
                </td>
                {orderedCols.map((col) => {
                  const raw = row[col];
                  const isNull = raw === null || raw === undefined;
                  const display = formatCell(raw);
                  const cellKey = `${ri}-${col}`;
                  const ct = colTypes[col];
                  const pinned = isPinned(col);
                  const w = colWidths[col] || DEFAULT_COL_WIDTH;
                  return (
                    <td
                      key={col}
                      className={cn(
                        "px-3 py-1.5 font-mono text-xs group/cell border-r border-border/20 last:border-r-0 overflow-hidden",
                        isNull ? "text-muted-foreground/30 italic" : COL_TYPE_META[ct].color,
                        ct === "number" && "tabular-nums text-right",
                        pinned && "sticky z-5",
                        pinned && (ri % 2 === 1 ? "bg-muted" : "bg-card"),
                      )}
                      style={{
                        width: w,
                        minWidth: w,
                        maxWidth: w,
                        ...(pinned ? { left: pinnedLeftOffsets[col] } : {}),
                      }}
                      title={display}
                    >
                      <div className="flex items-center gap-1">
                        <span className="truncate">{isNull ? "NULL" : display}</span>
                        {!isNull && display.length > 0 && (
                          <button
                            type="button"
                            className="shrink-0 opacity-0 group-hover/cell:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent"
                            onClick={() => handleCopy(display, cellKey)}
                          >
                            {copiedCell === cellKey ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground/60" />}
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {truncated && (
        <div className="shrink-0 px-3 py-1.5 border-t border-border bg-amber-500/5 text-[11px] text-amber-600 dark:text-amber-400 font-medium text-center">
          Showing first {records.length} rows. Use pipelines to access the full dataset.
        </div>
      )}
    </div>
  );
}

/* ─── Preview Tab ──────────────────────────────────────────── */

function PreviewTab({
  integrationId,
  initialAsset,
}: {
  integrationId: string;
  initialAsset?: string;
}) {
  const { data: assets, isLoading: isAssetsLoading } = useIntegrationAssets(integrationId);
  const [isMaximized, setIsMaximized] = useState(false);

  const defaultAsset = useMemo(() => {
    if (initialAsset) return initialAsset;
    return assets?.[0]?.qualified_name ?? "";
  }, [initialAsset, assets]);

  const [selectedAsset, setSelectedAsset] = useState(defaultAsset);

  useEffect(() => {
    setSelectedAsset(defaultAsset);
  }, [defaultAsset]);

  const { data: preview, isLoading: isPreviewLoading, error: previewError } = useDataPreview(
    integrationId, selectedAsset || undefined, 50,
  );

  const columns = preview?.columns ?? [];
  const records = preview?.records ?? [];

  const toolbar = (
    <div className={cn("flex items-center gap-3 shrink-0", isMaximized ? "px-5 py-3 border-b border-border bg-card" : "")}>
      <div className="flex-1 max-w-sm">
        {isAssetsLoading ? (
          <Skeleton className="h-9 w-full rounded-lg" />
        ) : !assets?.length ? (
          <p className="text-sm text-muted-foreground font-medium">No assets discovered yet.</p>
        ) : (
          <Select value={selectedAsset} onValueChange={setSelectedAsset}>
            <SelectTrigger className="h-9 text-[13px] font-mono">
              <SelectValue placeholder="Select an asset" />
            </SelectTrigger>
            <SelectContent>
              {assets.map((a) => (
                <SelectItem key={a.id} value={a.qualified_name} className="font-mono text-[13px]">{a.qualified_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {!isMaximized && (
        <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setIsMaximized(true)} title="Fullscreen">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  const gridContent = isPreviewLoading && selectedAsset ? (
    <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)}</div>
  ) : !selectedAsset ? (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Table2 className="h-5 w-5" /></div>
        <p className="text-sm font-semibold">Select an asset</p>
        <p className="text-xs text-muted-foreground max-w-xs">Choose a table, view, or file from the dropdown to preview its data in a relational grid.</p>
      </div>
    </div>
  ) : previewError ? (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500"><AlertCircle className="h-5 w-5" /></div>
        <p className="text-sm font-semibold">Preview failed</p>
        <p className="text-xs text-muted-foreground max-w-sm wrap-break-word">{(previewError as Error).message || "Could not load data from this asset."}</p>
      </div>
    </div>
  ) : columns.length === 0 ? (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500"><AlertCircle className="h-5 w-5" /></div>
        <p className="text-sm font-semibold">No data returned</p>
        <p className="text-xs text-muted-foreground max-w-xs">This asset returned no columns. It may be empty or the adapter may not support reading it.</p>
      </div>
    </div>
  ) : (
    <DataGrid columns={columns} records={records as Record<string, unknown>[]} truncated={preview?.truncated ?? false} total={preview?.total ?? records.length} />
  );

  if (isMaximized) {
    return (
      <div className="fixed inset-0 z-50 bg-card flex flex-col">
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Data Preview</span>
            {selectedAsset && <Badge variant="default" className="font-mono text-[11px]">{selectedAsset}</Badge>}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setIsMaximized(false)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
        {toolbar}
        <div className="flex-1 min-h-0">{gridContent}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toolbar}
      <div className="rounded-xl border border-border overflow-hidden" style={{ height: "min(520px, calc(100vh - 340px))" }}>{gridContent}</div>
    </div>
  );
}

/* ─── Configuration Tab ────────────────────────────────────── */

function ConfigurationTab({
  integration,
  adapter,
}: {
  integration: Integration;
  adapter?: Adapter;
}) {
  const fields = useMemo(() => {
    const config = integration.config || {};
    const vaultFields = adapter?.vault_fields ?? [];
    const secretFieldNames = new Set<string>();

    const parsed = vaultFields.map((f) => {
      const parts = f.split(":");
      const name = parts[0];
      let fieldType = "text";
      let defaultVal = "";
      let isSecret = false;
      if (parts.length > 1) {
        const rest = parts.slice(1).join(":");
        if (rest.includes("secret")) { isSecret = true; secretFieldNames.add(name); }
        const typeMatch = rest.match(/^(int|string|bool)/);
        if (typeMatch) fieldType = typeMatch[1];
        const defMatch = rest.match(/=(.+)/);
        if (defMatch) defaultVal = defMatch[1];
      }
      const value = config[name];
      return { name, fieldType, defaultVal, isSecret, value, isExpected: true };
    });

    const expectedNames = new Set(parsed.map((f) => f.name));
    for (const [key, value] of Object.entries(config)) {
      if (!expectedNames.has(key)) {
        const isSecret =
          key.toLowerCase().includes("password") ||
          key.toLowerCase().includes("secret") ||
          key.toLowerCase().includes("token");
        parsed.push({ name: key, fieldType: "text", defaultVal: "", isSecret, value, isExpected: false });
        if (isSecret) secretFieldNames.add(key);
      }
    }

    return { fields: parsed, secretFieldNames };
  }, [adapter, integration.config]);

  return (
    <div className="space-y-5">
      <Card padding={false}>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold">Connection Parameters</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configuration values for this integration.
            {fields.fields.some((f) => f.isSecret) && " Secret fields are resolved from server environment variables at runtime."}
          </p>
        </div>
        {fields.fields.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">No configuration fields defined for this adapter.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {fields.fields.map((field) => {
              const hasValue = field.value !== undefined && field.value !== null && field.value !== "";
              const displayValue = field.isSecret
                ? (hasValue ? "••••••••" : "—")
                : hasValue
                  ? String(field.value)
                  : field.defaultVal
                    ? field.defaultVal
                    : "—";

              return (
                <div key={field.name} className="flex items-center justify-between px-5 py-3.5 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium font-mono text-foreground">{field.name}</span>
                    {field.isSecret && <Badge variant="warning" className="text-[9px]">Vault</Badge>}
                    {field.defaultVal && !hasValue && (
                      <Badge variant="default" className="text-[9px]">Default</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={cn(
                      "text-sm font-mono truncate max-w-[300px]",
                      hasValue ? "text-foreground" : "text-muted-foreground/50",
                    )}>
                      {displayValue}
                    </span>
                    {hasValue ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : field.defaultVal ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Secrets help — only show if there are secret fields */}
      {fields.fields.some((f) => f.isSecret) && (
        <Card className="p-4 bg-amber-500/5 border-amber-500/20">
          <div className="flex gap-3">
            <Shield className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[13px] text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground mb-1">How secrets work</p>
              <p>
                Fields marked <Badge variant="warning" className="text-[9px] mx-0.5">Vault</Badge> store an <strong>environment variable name</strong> (not the actual secret).
                At runtime, the server resolves it from <code className="text-xs bg-muted px-1 py-0.5 rounded">os.environ</code>.
                For example, if you set <code className="text-xs bg-muted px-1 py-0.5 rounded">password</code> to <code className="text-xs bg-muted px-1 py-0.5 rounded">MY_DB_PASS</code>,
                the server must be started with <code className="text-xs bg-muted px-1 py-0.5 rounded">MY_DB_PASS=actual_password</code> in its environment.
              </p>
            </div>
          </div>
        </Card>
      )}

    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────── */

export function IntegrationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: workspaces } = useWorkspaces();
  const workspaceId = workspaces?.[0]?.id ?? "";
  const { data: integrations, isLoading } = useIntegrations(workspaceId);
  const { data: adapters } = useAdapters();
  const { data: pipelines } = usePipelines(workspaceId);
  const { data: assets } = useIntegrationAssets(id);
  const { action, setParams, clearParams } = useQueryAction();

  const integration = integrations?.find((i) => i.id === id) ?? null;
  const adapter = useMemo(
    () => adapters?.find((a) => a.type === integration?.adapter_type),
    [adapters, integration],
  );

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [previewAsset, setPreviewAsset] = useState<string | undefined>();

  const [editData, setEditData] = useState<{
    id: string;
    name: string;
    adapter_type: string;
    config: Record<string, string | number>;
    ts: number;
  } | null>(null);

  const testConnection = useTestConnection();
  const { mutate: updateIntegration, isPending: isUpdating } = useUpdateIntegration(workspaceId);
  const { mutate: deleteIntegration, isPending: isDeleting } = useDeleteIntegration(workspaceId);

  const handlePreviewAsset = (assetName: string) => {
    setPreviewAsset(assetName);
    setActiveTab("preview");
  };

  const handleEdit = () => {
    if (!integration) return;
    setEditData({
      id: integration.id,
      name: integration.name,
      adapter_type: integration.adapter_type,
      config: (integration.config as Record<string, string | number>) || {},
      ts: Date.now(),
    });
    setParams({ action: "edit" });
  };

  const handleSave = (data: {
    name: string;
    adapter_type: string;
    config: Record<string, string | number>;
  }) => {
    if (!editData) return;
    updateIntegration(
      { id: editData.id, data: { name: data.name, config: data.config } },
      { onSuccess: () => { clearParams(["action"]); setEditData(null); } },
    );
  };

  if (isLoading) {
    return (
      <div className="fade-in max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="fade-in max-w-7xl mx-auto p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">Integration not found</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">This integration may have been deleted.</p>
          <Button variant="secondary" size="sm" className="mt-5" onClick={() => navigate("/integrations")}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back to Integrations
          </Button>
        </div>
      </div>
    );
  }

  const uiAdapter = ADAPTER_UI_MAP[integration.adapter_type] || DEFAULT_ADAPTER;
  const AdapterIcon = uiAdapter.icon;
  const status = integration.status || "healthy";
  const st = INTEGRATION_STATUS[status as keyof typeof INTEGRATION_STATUS] || INTEGRATION_STATUS.healthy;

  const TABS: { id: TabId; label: string; icon: typeof Table2; count?: number }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "assets", label: "Assets", icon: Database, count: assets?.length },
    { id: "preview", label: "Data Preview", icon: Eye },
    { id: "configuration", label: "Configuration", icon: Settings2 },
  ];

  return (
    <div className="fade-in max-w-7xl mx-auto p-6 lg:p-8">
      <PageHeader
        title={integration.name}
        description={integration.adapter_type}
        preTitle={
          <button
            onClick={() => navigate("/integrations")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Integrations
          </button>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => testConnection.mutate(integration.id)}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Plug2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Test
            </Button>
            <Button variant="ghost" size="sm" onClick={handleEdit}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5 text-red-500" />
                  <span className="text-red-500">Delete</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete integration?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &quot;{integration.name}&quot; and all its discovered assets.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="danger"
                    disabled={isDeleting}
                    onClick={() => deleteIntegration(integration.id, { onSuccess: () => navigate("/integrations") })}
                  >
                    {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      {/* Header bar */}
      <div className="flex items-center gap-3 mb-6 -mt-4">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", uiAdapter.color)}>
          <AdapterIcon className="h-5 w-5" />
        </div>
        <Badge variant={st.variant} dot>{st.label}</Badge>
        <span className="text-xs text-muted-foreground capitalize">{adapter?.category ?? integration.adapter_type}</span>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={cn(
                    "text-[10px] font-semibold rounded-full px-1.5 py-0.5 tabular-nums",
                    isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab
          integration={integration}
          adapter={adapter}
          assets={assets ?? []}
          pipelines={pipelines ?? []}
          onTabChange={setActiveTab}
        />
      )}
      {activeTab === "assets" && (
        <AssetsTab integrationId={integration.id} workspaceId={workspaceId} onPreviewAsset={handlePreviewAsset} />
      )}
      {activeTab === "preview" && (
        <PreviewTab integrationId={integration.id} initialAsset={previewAsset} />
      )}
      {activeTab === "configuration" && (
        <ConfigurationTab integration={integration} adapter={adapter} />
      )}

      {action === "edit" && editData && (
        <IntegrationDialog
          key={editData.ts}
          isOpen
          onClose={() => { clearParams(["action"]); setEditData(null); }}
          adapters={adapters}
          workspaceId={workspaceId}
          integrationId={editData.id}
          initialName={editData.name}
          initialAdapterType={editData.adapter_type}
          initialConfig={editData.config}
          onSave={handleSave}
          isSaving={isUpdating}
        />
      )}
    </div>
  );
}
