import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Zap,
  Loader2,
  ArrowRight,
  GitBranch,
  Database,
  Shield,
} from "lucide-react";
import { useLogin, useRegister, useAuthStore } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const FEATURES = [
  {
    icon: GitBranch,
    title: "Visual Pipeline Builder",
    desc: "Build complex data pipelines with a drag-and-drop DAG editor",
  },
  {
    icon: Database,
    title: "Universal Connectors",
    desc: "Connect to PostgreSQL, MySQL, MongoDB, S3, Snowflake, and more",
  },
  {
    icon: Shield,
    title: "Data Quality Gates",
    desc: "Automated validation and quarantine for data integrity",
  },
];

export function Login() {
  const { accessToken } = useAuthStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const login = useLogin();
  const register = useRegister();

  if (accessToken) return <Navigate to="/dashboard" replace />;

  const isPending = login.isPending || register.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      login.mutate(
        { email, password },
        { onSuccess: () => navigate("/dashboard", { replace: true }) },
      );
    } else {
      register.mutate(
        { email, password, display_name: displayName },
        { onSuccess: () => navigate("/dashboard", { replace: true }) },
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-card border-r border-border">
        <div className="relative z-10 flex flex-col justify-between p-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/25">
              <Zap className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight">Conduit</span>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold tracking-tight leading-tight">
                The modern data
                <br />
                integration platform
              </h2>
              <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-md">
                Build, monitor, and scale your data pipelines with confidence.
              </p>
            </div>

            <div className="space-y-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3.5 group">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-4 w-4" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground/50">
            Conduit &mdash; Open Source Data Integration
          </p>
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--primary)_0%,transparent_50%)] opacity-[0.04]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[380px] space-y-7">
          <div className="lg:hidden flex items-center gap-2.5 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/25">
              <Zap className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight">Conduit</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "login"
                ? "Sign in to continue to your dashboard"
                : "Get started with Conduit in seconds"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">Name</label>
                <Input
                  type="text"
                  placeholder="Jane Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Email</label>
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus={mode === "login"}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Password</label>
              <Input
                type="password"
                placeholder={
                  mode === "register" ? "Min. 8 characters" : "Enter password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "register" ? 8 : undefined}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full h-10 mt-1"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "Sign in" : "Create account"}
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </>
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-background text-muted-foreground/60">
                {mode === "login" ? "New to Conduit?" : "Already have an account?"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent transition-all duration-150"
          >
            {mode === "login" ? "Create an account" : "Sign in instead"}
          </button>
        </div>
      </div>
    </div>
  );
}
