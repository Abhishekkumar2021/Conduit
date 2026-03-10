import {
  Moon,
  Sun,
  Zap,
  Shield,
  Database,
  Activity,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useTheme } from "@/hooks/useTheme";
import { useWorkspaces } from "@/hooks/queries/useWorkspaces";
import { useRunnerStatus } from "@/hooks/queries/useIntegrations";
import type { ReactNode } from "react";

/* ─── Page ────────────────────────────────────────────────────── */

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { data: workspaces } = useWorkspaces();
  const workspace = workspaces?.[0];
  const {
    data: runnerStatus,
    isLoading: isRunnerLoading,
    isError: isRunnerError,
  } = useRunnerStatus();

  const themeOptions = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
  ];

  const isRunnerHealthy = runnerStatus?.is_healthy ?? false;
  const missingVars = runnerStatus?.missing_variables ?? [];

  return (
    <div className="fade-in p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your workspace and preferences"
      />

      {/* Workspace */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 px-1">
          Workspace
        </h2>
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/20">
              <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-foreground tracking-tight">
                {workspace?.name ?? "Loading..."}
              </p>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                {workspace?.id ?? "—"}
              </p>
            </div>
            <Badge variant={workspace ? "success" : "default"} dot>
              {workspace ? "Active" : "Loading"}
            </Badge>
          </div>
        </Card>
      </section>

      {/* Appearance */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 px-1">
          Appearance
        </h2>
        <Card>
          <div className="flex items-center gap-3">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-3 text-[12px] font-bold transition-all ${
                    isActive
                      ? "border-primary/40 bg-primary/5 text-primary shadow-sm"
                      : "border-border/50 text-muted-foreground hover:border-border hover:bg-muted/30"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Environment Health */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 px-1">
          Environment Health
        </h2>
        <Card className="space-y-4">
          <HealthRow
            label="API Server"
            status={workspace ? "healthy" : "unknown"}
            detail={
              workspace
                ? `Connected · Workspace "${workspace.name}"`
                : "Unable to connect"
            }
            icon={<Activity className="h-4 w-4" />}
          />
          <div className="h-px bg-border/30" />
          <HealthRow
            label="Vault Provider"
            status={
              isRunnerLoading
                ? "unknown"
                : isRunnerError
                  ? "unhealthy"
                  : isRunnerHealthy
                    ? "healthy"
                    : "unhealthy"
            }
            detail={
              isRunnerLoading
                ? "Checking..."
                : isRunnerError
                  ? "Unable to reach runner status endpoint"
                  : isRunnerHealthy
                    ? `Active · ${missingVars.length === 0 ? "All secrets resolved" : `${missingVars.length} missing`}`
                    : `${missingVars.length} missing secret(s)`
            }
            icon={<Shield className="h-4 w-4" />}
          />
          <div className="h-px bg-border/30" />
          <HealthRow
            label="Runner Daemon"
            status={
              isRunnerLoading
                ? "unknown"
                : isRunnerError
                  ? "unhealthy"
                  : isRunnerHealthy
                    ? "healthy"
                    : "unhealthy"
            }
            detail={
              isRunnerLoading
                ? "Checking..."
                : isRunnerError
                  ? "Runner not reachable — may not be started"
                  : isRunnerHealthy
                    ? "Online · Polling for pending runs"
                    : `Offline · Missing: ${missingVars.join(", ") || "Check runner logs"}`
            }
            icon={<Database className="h-4 w-4" />}
          />
        </Card>
      </section>

      {/* About */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 px-1">
          About
        </h2>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-foreground tracking-tight">
                Conduit Console
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Open-source data orchestration platform
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open("https://github.com", "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              GitHub
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}

/* ─── Health Row Component ───────────────────────────────────── */

function HealthRow({
  label,
  status,
  detail,
  icon,
}: {
  label: string;
  status: "healthy" | "unhealthy" | "unknown";
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/30 text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground truncate">{detail}</p>
      </div>
      {status === "healthy" ? (
        <Badge variant="success" dot>
          Healthy
        </Badge>
      ) : status === "unknown" ? (
        <Badge variant="default" dot>
          Unknown
        </Badge>
      ) : (
        <Badge variant="danger" dot>
          Issue
        </Badge>
      )}
    </div>
  );
}
