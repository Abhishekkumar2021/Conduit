import {
  User,
  Shield,
  Bell,
  Globe,
  Key,
  Users,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/* ─── Config ─────────────────────────────────────────────────── */

const SECTIONS = [
  {
    id: "workspace",
    label: "Workspace",
    desc: "General workspace settings",
    icon: Globe,
  },
  {
    id: "members",
    label: "Members",
    desc: "Manage team members and roles",
    icon: Users,
  },
  {
    id: "api-keys",
    label: "API Keys",
    desc: "Manage programmatic access tokens",
    icon: Key,
  },
  {
    id: "notifications",
    label: "Notifications",
    desc: "Configure alert channels",
    icon: Bell,
  },
  {
    id: "security",
    label: "Security",
    desc: "Auth, SSO, and audit settings",
    icon: Shield,
  },
];

const MEMBERS = [
  {
    name: "Abhishek",
    email: "abhishek@conduit.dev",
    role: "Owner",
    avatar: "A",
    color: "from-violet-500 to-fuchsia-500",
  },
  {
    name: "Sarah Chen",
    email: "sarah@conduit.dev",
    role: "Admin",
    avatar: "S",
    color: "from-sky-500 to-blue-500",
  },
  {
    name: "Marcus Johnson",
    email: "marcus@conduit.dev",
    role: "Editor",
    avatar: "M",
    color: "from-amber-500 to-orange-500",
  },
  {
    name: "Priya Patel",
    email: "priya@conduit.dev",
    role: "Viewer",
    avatar: "P",
    color: "from-emerald-500 to-teal-500",
  },
];

/* ─── Page ────────────────────────────────────────────────────── */

export function Settings() {
  return (
    <div className="fade-in p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Settings"
        description="Manage workspace configuration"
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Navigation */}
        <div className="lg:col-span-1">
          <div className="space-y-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-accent"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-accent">
                  <section.icon className="h-4 w-4" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground">
                    {section.label}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {section.desc}
                  </p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-all group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workspace Settings */}
          <Card>
            <h3 className="text-[14px] font-semibold text-foreground">
              Workspace
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              General workspace configuration
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="ws-name"
                  className="block text-[12px] font-medium text-foreground"
                >
                  Workspace Name
                </label>
                <input
                  id="ws-name"
                  type="text"
                  defaultValue="Conduit Production"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-[13px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label
                  htmlFor="ws-slug"
                  className="block text-[12px] font-medium text-foreground"
                >
                  Slug
                </label>
                <input
                  id="ws-slug"
                  type="text"
                  defaultValue="conduit-prod"
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-[13px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="primary" size="sm">
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>

          {/* Team Members */}
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-foreground">
                  Team Members
                </h3>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {MEMBERS.length} members in this workspace
                </p>
              </div>
              <Button variant="secondary" size="sm">
                <User className="h-3.5 w-3.5" />
                Invite
              </Button>
            </div>

            <div className="mt-4 divide-y divide-border">
              {MEMBERS.map((member) => (
                <div
                  key={member.email}
                  className="flex items-center gap-3 py-3"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br ${member.color} text-[11px] font-bold text-white`}
                  >
                    {member.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground">
                      {member.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/20!">
            <h3 className="text-[14px] font-semibold text-destructive">
              Danger Zone
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Irreversible actions that affect your entire workspace
            </p>
            <div className="mt-4">
              <Button variant="danger" size="sm">
                Delete Workspace
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
