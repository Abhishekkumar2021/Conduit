import { useState } from "react";
import {
  Moon,
  Sun,
  Zap,
  Shield,
  Database,
  Activity,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Check,
  X,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
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
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/hooks/useAuth";
import {
  useWorkspaces,
  useCreateWorkspace,
  useUpdateWorkspace,
  useDeleteWorkspace,
} from "@/hooks/queries/useWorkspaces";
import { useRunnerStatus } from "@/hooks/queries/useIntegrations";
import type { ReactNode } from "react";
import type { Workspace } from "@/types/api";

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuthStore();
  const { data: workspaces, isLoading: isWorkspacesLoading } = useWorkspaces();
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

  const initials = user?.display_name
    ? user.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  return (
    <div className="fade-in max-w-3xl mx-auto space-y-8 p-6 lg:p-8">
      <PageHeader
        title="Settings"
        description="Manage your workspace and preferences"
      />

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
          Profile
        </h2>
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-bold">
              {initials}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">
                  {user?.display_name || "User"}
                </p>
                <Badge variant="info">{user?.auth_provider || "local"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {user?.email || "No email"}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <User className="h-4 w-4" />
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
          Workspace
        </h2>
        {isWorkspacesLoading ? (
          <Card>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                <div className="h-3 w-48 rounded bg-muted animate-pulse" />
              </div>
            </div>
          </Card>
        ) : !workspace ? (
          <CreateWorkspaceCard />
        ) : (
          <WorkspaceCard workspace={workspace} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
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
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-all ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent"
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

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
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
          <div className="h-px bg-border" />
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
          <div className="h-px bg-border" />
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

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
          About
        </h2>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                Conduit Console
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
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

function CreateWorkspaceCard() {
  const [name, setName] = useState("");
  const { mutate: createWorkspace, isPending } = useCreateWorkspace();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createWorkspace(
      { name: trimmed, slug: trimmed.toLowerCase().replace(/\s+/g, "-") },
      { onSuccess: () => setName("") },
    );
  };

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium">No workspace found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create a workspace to get started with Conduit
            </p>
          </div>
        </div>
        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Workspace name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isPending || !name.trim()}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Create
          </Button>
        </form>
      </div>
    </Card>
  );
}

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(workspace.name);
  const { mutate: updateWorkspace, isPending: isUpdating } =
    useUpdateWorkspace();
  const { mutate: deleteWorkspace, isPending: isDeleting } =
    useDeleteWorkspace();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed || trimmed === workspace.name) {
      setIsEditing(false);
      return;
    }
    updateWorkspace(
      { id: workspace.id, data: { name: trimmed } },
      {
        onSuccess: () => setIsEditing(false),
      },
    );
  };

  const handleCancelEdit = () => {
    setEditName(workspace.name);
    setIsEditing(false);
  };

  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Zap
            className="h-5 w-5 text-primary-foreground"
            strokeWidth={2.5}
          />
        </div>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <form
              onSubmit={handleSave}
              className="flex items-center gap-2"
            >
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                className="h-8 text-sm"
                required
              />
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleCancelEdit}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </form>
          ) : (
            <>
              <p className="text-sm font-medium">{workspace.name}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                {workspace.id}
              </p>
            </>
          )}
        </div>
        {!isEditing && (
          <div className="flex items-center gap-1">
            <Badge variant="success" dot>
              Active
            </Badge>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setEditName(workspace.name);
                setIsEditing(true);
              }}
              title="Rename workspace"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-red-500"
                  title="Delete workspace"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &quot;{workspace.name}&quot; and
                    all associated pipelines, integrations, and run history.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="danger"
                    disabled={isDeleting}
                    onClick={() => deleteWorkspace(workspace.id)}
                  >
                    {isDeleting && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    )}
                    Delete Workspace
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </Card>
  );
}

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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{detail}</p>
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
