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
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-xl">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Discovered Assets
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {integrationName
                ? `Browsing ${integrationName}`
                : "Select an integration"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tables and views..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => discoverAssets(integrationId || "")}
              disabled={isDiscovering || !integrationId}
              className="h-8 text-[11px] font-bold rounded-lg"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${isDiscovering ? "animate-spin opacity-50" : ""}`}
              />
              {isDiscovering ? "Running..." : "Run Discovery"}
            </Button>
          </div>

          {discoverError && (
            <div className="flex items-start gap-2 p-3 text-[12px] text-red-600 dark:text-red-400 bg-red-500/10 rounded-md border border-red-500/20">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                {discoverError.message ||
                  "Failed to sync assets. Check integration credentials."}
              </p>
            </div>
          )}

          {isAssetsLoading ? (
            <div className="flex-1 flex items-center justify-center text-[12px] text-muted-foreground font-medium">
              Loading assets...
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-border/50 rounded-xl mt-4">
              <Database className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-[13px] font-bold text-foreground mb-1">
                No Assets Found
              </p>
              <p className="text-[11px] text-muted-foreground/60 font-medium">
                {searchTerm
                  ? "Try adjusting your search query."
                  : "Click 'Run Discovery' to fetch schemas from the source source."}
              </p>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 pb-2 border-b border-border/50">
                <span>Asset Name</span>
                <span>Type</span>
              </div>
              <div className="space-y-1">
                {filteredAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 group transition-colors"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {asset.asset_type === "view" ? (
                        <LayoutTemplate className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      ) : (
                        <Table2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      )}
                      <span className="text-[12px] text-foreground truncate font-mono font-medium">
                        {asset.qualified_name}
                      </span>
                    </div>
                    <Badge
                      variant="info"
                      className="text-[9px] font-bold h-4 px-1.5 shrink-0 bg-background/50 border-border/40"
                    >
                      {asset.asset_type}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
