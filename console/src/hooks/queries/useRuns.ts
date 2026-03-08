import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Run, RunDetail } from "@/types/api";

export interface RunListFilters {
  limit?: number;
  status?: Run["status"];
  trigger_type?: Run["trigger_type"];
  search?: string;
}

export const runKeys = {
  all: ["runs"] as const,
  list: (workspaceId: string, filters?: RunListFilters) =>
    [
      ...runKeys.all,
      "list",
      workspaceId,
      filters?.limit ?? 50,
      filters?.status ?? "",
      filters?.trigger_type ?? "",
      filters?.search ?? "",
    ] as const,
  detail: (runId: string) => [...runKeys.all, "detail", runId] as const,
};

export function useRuns(workspaceId: string, filters?: RunListFilters) {
  return useQuery({
    queryKey: runKeys.list(workspaceId, filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(filters?.limit ?? 50));
      if (filters?.status) params.set("status", filters.status);
      if (filters?.trigger_type)
        params.set("trigger_type", filters.trigger_type);
      if (filters?.search?.trim()) params.set("search", filters.search.trim());

      const { data } = await api.get<Run[]>(
        `/workspaces/${workspaceId}/runs?${params.toString()}`,
      );
      return data;
    },
    enabled: !!workspaceId,
  });
}

export function useRunDetail(runId: string) {
  return useQuery({
    queryKey: runKeys.detail(runId),
    queryFn: async () => {
      const { data } = await api.get<RunDetail>(`/runs/${runId}`);
      return data;
    },
    enabled: !!runId,
    refetchInterval: (query) => {
      const run = query.state.data as RunDetail | undefined;
      return run && ["pending", "queued", "running"].includes(run.status)
        ? 3000
        : false;
    },
  });
}
