import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuthStore } from "@/hooks/useAuth";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { Pipelines } from "@/pages/Pipelines";
import { PipelineDetail } from "@/pages/PipelineDetail";
import { Integrations } from "@/pages/Integrations";
import { IntegrationDetail } from "@/pages/IntegrationDetail";
import { Runs } from "@/pages/Runs";
import { RunDetail } from "@/pages/RunDetail";
import { Settings } from "@/pages/Settings";
import { AuditLog } from "@/pages/AuditLog";
import { Quarantine } from "@/pages/Quarantine";
import { Lineage } from "@/pages/Lineage";
import { NotFound } from "@/pages/NotFound";
import type { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
  },
});

function AuthGuard({ children }: { children: ReactNode }) {
  const { accessToken } = useAuthStore();
  if (!accessToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="login" element={<Login />} />
            <Route
              element={
                <AuthGuard>
                  <AppLayout />
                </AuthGuard>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="pipelines" element={<Pipelines />} />
              <Route path="pipelines/:id" element={<PipelineDetail />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="integrations/:id" element={<IntegrationDetail />} />
              <Route path="runs" element={<Runs />} />
              <Route path="runs/:id" element={<RunDetail />} />
              <Route path="audit" element={<AuditLog />} />
              <Route path="quarantine" element={<Quarantine />} />
              <Route path="lineage" element={<Lineage />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!bg-card !text-foreground !border-border !text-sm !rounded-lg",
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
