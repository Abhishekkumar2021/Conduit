import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { Dashboard } from "@/pages/Dashboard";
import { Pipelines } from "@/pages/Pipelines";
import { PipelineDetail } from "@/pages/PipelineDetail";
import { Integrations } from "@/pages/Integrations";
import { Runs } from "@/pages/Runs";
import { Settings } from "@/pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
  },
});

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="pipelines" element={<Pipelines />} />
              <Route path="pipelines/:id" element={<PipelineDetail />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="runs" element={<Runs />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!bg-card !text-foreground !border-border !text-[13px]",
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
