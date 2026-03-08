import {
  Settings as SettingsIcon,
  User,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  useWorkspaces,
  useDeleteWorkspace,
} from "@/hooks/queries/useWorkspaces";

export function Settings() {
  const { data: workspaces } = useWorkspaces();
  const activeWorkspace = workspaces?.[0];

  const deleteWorkspace = useDeleteWorkspace();

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspace) return;

    const confirmed = window.confirm(
      "Are you absolutely sure you want to delete this workspace? This action is permanent and will delete all pipelines, integrations, and run history.",
    );

    if (confirmed) {
      deleteWorkspace.mutate(activeWorkspace.id, {
        onSuccess: () => {
          // Redirect to a logout page or landing page as workspace is gone
          window.location.href = "/";
        },
      });
    }
  };

  return (
    <div className="fade-in p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your workspace and account preferences"
      />

      <div className="max-w-3xl space-y-8">
        {/* Workspace Details */}
        <Card className="p-0 overflow-hidden border-border/40 bg-card shadow-sm rounded-3xl">
          <div className="border-b border-border/40 bg-muted/10 px-8 py-5">
            <h2 className="flex items-center gap-2.5 text-sm font-semibold text-foreground tracking-tight">
              <SettingsIcon className="h-4 w-4 text-primary/70" />
              Workspace Configuration
            </h2>
          </div>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 max-w-2xl">
              <div className="space-y-2.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  defaultValue={activeWorkspace?.name || ""}
                  className="w-full bg-muted/30 border-none rounded-2xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/30 transition-all font-medium"
                  placeholder="My Workspace"
                />
              </div>
              <div className="space-y-2.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">
                  Workspace Slug
                </label>
                <input
                  type="text"
                  value={activeWorkspace?.slug || ""}
                  className="w-full bg-muted/50 border-none rounded-2xl px-5 py-3.5 text-sm text-muted-foreground/60 cursor-not-allowed font-medium"
                  readOnly
                />
              </div>
            </div>
            <div className="flex justify-start pt-2">
              <Button
                variant="primary"
                size="sm"
                className="h-11 px-8 rounded-xl font-bold transition-all hover:scale-[1.02] shadow-xl shadow-primary/10"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Card>

        {/* Account Settings */}
        <Card className="p-0 overflow-hidden border-border/40 bg-card shadow-sm rounded-3xl">
          <div className="border-b border-border/40 bg-muted/10 px-8 py-5">
            <h2 className="flex items-center gap-2.5 text-sm font-semibold text-foreground tracking-tight">
              <User className="h-4 w-4 text-primary/70" />
              Profile Settings
            </h2>
          </div>
          <div className="divide-y divide-border/40">
            <div className="flex items-center justify-between p-8 group transition-colors hover:bg-muted/5">
              <div className="space-y-1.5">
                <h3 className="text-[14px] font-semibold text-foreground">
                  Personal Information
                </h3>
                <p className="text-[11px] text-muted-foreground/70 font-medium">
                  Update your name and avatar displayed across the platform.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-5 rounded-xl text-xs font-bold bg-muted/20 hover:bg-muted/40 transition-all"
              >
                Configure
              </Button>
            </div>
            <div className="flex items-center justify-between p-8 group transition-colors hover:bg-muted/5">
              <div className="space-y-1.5">
                <h3 className="text-[14px] font-semibold text-foreground">
                  Security & Authentication
                </h3>
                <p className="text-[11px] text-muted-foreground/70 font-medium">
                  Manage your password and 2FA settings.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-5 rounded-xl text-xs font-bold bg-muted/20 hover:bg-muted/40 transition-all"
              >
                Manage
              </Button>
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card className="p-0 overflow-hidden border-destructive/20 bg-destructive/5 rounded-3xl">
          <div className="border-b border-destructive/20 bg-destructive/10 px-8 py-5">
            <h2 className="flex items-center gap-2.5 text-sm font-semibold text-destructive tracking-tight">
              <AlertTriangle className="h-4 w-4" />
              Danger Zone
            </h2>
          </div>
          <div className="p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <h3 className="text-[14px] font-semibold text-foreground">
                  Delete Workspace
                </h3>
                <p className="text-[11px] text-muted-foreground/70 font-medium max-w-sm leading-relaxed">
                  Once you delete a workspace, there is no going back. All data
                  will be wiped from our systems including all pipelines and
                  history.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                className="h-11 px-6 rounded-xl font-bold shadow-xl shadow-destructive/10 transition-all hover:scale-[1.02]"
                onClick={handleDeleteWorkspace}
                disabled={deleteWorkspace.isPending}
              >
                {deleteWorkspace.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                )}
                Delete Workspace
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
