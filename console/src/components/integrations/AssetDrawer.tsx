import {
  X,
  Search,
  Table2,
  LayoutTemplate,
  RefreshCw,
  AlertCircle,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  useIntegrationAssets,
  useDiscoverAssets,
} from "@/hooks/queries/useIntegrations";
import { useState } from "react";

interface AssetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  integrationId: string | null;
  integrationName: string | null;
}

export function AssetDrawer({
  isOpen,
  onClose,
  workspaceId,
  integrationId,
  integrationName,
}: AssetDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: assets, isLoading: isAssetsLoading } =
    useIntegrationAssets(integrationId);
  const {
    mutate: discoverAssets,
    isPending: isDiscovering,
    error: discoverError,
  } = useDiscoverAssets(workspaceId);

  if (!isOpen) return null;

  const filteredAssets = (assets || []).filter(
    (a) =>
      a.qualified_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.asset_type.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[450px] sm:w-[500px] h-full bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-foreground/90 tracking-tight">
                Discovered Assets
              </h2>
              <p className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-widest mt-0.5">
                {integrationName ? integrationName : "Schema Browser"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground/40 hover:bg-muted hover:text-foreground transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search & Actions */}
        <div className="p-6 border-b border-border bg-muted/2">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <Input
                placeholder="Filter by name or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-[13px] bg-background/80"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => discoverAssets(integrationId || "")}
              disabled={isDiscovering || !integrationId}
              className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-2 ${isDiscovering ? "animate-spin" : ""}`}
              />
              {isDiscovering ? "Scanning" : "Discover"}
            </Button>
          </div>

          {discoverError && (
            <div className="mt-4 flex items-start gap-3 p-3 text-[12px] text-rose-600 bg-rose-500/5 rounded-lg border border-rose-500/10">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 opacity-70" />
              <p className="font-medium">
                {discoverError.message ||
                  "Failed to sync assets. Check credentials."}
              </p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isAssetsLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3 opacity-40">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="text-[12px] font-bold uppercase tracking-widest">
                Fetching Schema
              </span>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
              <div className="h-16 w-16 rounded-full bg-muted/10 flex items-center justify-center border border-border/50 border-dashed">
                <Database className="h-8 w-8 text-muted-foreground/20" />
              </div>
              <div className="space-y-1">
                <p className="text-[14px] font-bold text-foreground/80">
                  {searchTerm ? "No results match" : "No assets discovered"}
                </p>
                <p className="text-[12px] text-muted-foreground/50 font-medium max-w-[240px]">
                  {searchTerm
                    ? `We couldn't find anything matching "${searchTerm}"`
                    : "Run discovery to sync the latest tables and views from this integration."}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-0">
              <Table className="border-none rounded-none shadow-none">
                <TableHeader className="bg-muted/10 sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 h-10">Asset Name</TableHead>
                    <TableHead className="pr-6 text-right h-10">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => (
                    <TableRow
                      key={asset.id}
                      className="group transition-colors border-border/10"
                    >
                      <TableCell className="pl-6 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {asset.asset_type === "view" ? (
                            <LayoutTemplate className="h-3.5 w-3.5 text-blue-500/70 shrink-0" />
                          ) : (
                            <Table2 className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                          )}
                          <span className="text-[12.5px] text-foreground/80 font-mono font-medium truncate">
                            {asset.qualified_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-6 py-3 text-right">
                        <Badge
                          variant="info"
                          className="text-[9px] font-bold uppercase tracking-wider h-4.5 px-2 bg-muted/20 border-none text-muted-foreground/60"
                        >
                          {asset.asset_type}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-6 text-center border-t border-border/10">
                <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-[0.2em]">
                  {filteredAssets.length} Total Assets Discovered
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
