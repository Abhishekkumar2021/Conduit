import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  WorkspaceSummary,
  RunTrendPoint,
  PipelineStat,
  Throughput,
} from "@/types/api";

export function useWorkspaceSummary(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["metrics", "summary", workspaceId],
    queryFn: async () => {
      const res = await api.get<WorkspaceSummary>(
        `/workspaces/${workspaceId}/metrics/summary`,
      );
      return res.data;
    },
    enabled: !!workspaceId,
    refetchInterval: 30_000,
  });
}

export function useRunTrend(workspaceId: string | undefined, days = 14) {
  return useQuery({
    queryKey: ["metrics", "run-trend", workspaceId, days],
    queryFn: async () => {
      const res = await api.get<RunTrendPoint[]>(
        `/workspaces/${workspaceId}/metrics/run-trend`,
        { params: { days } },
      );
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function usePipelineStats(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["metrics", "pipeline-stats", workspaceId],
    queryFn: async () => {
      const res = await api.get<PipelineStat[]>(
        `/workspaces/${workspaceId}/metrics/pipeline-stats`,
      );
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useThroughput(workspaceId: string | undefined, days = 7) {
  return useQuery({
    queryKey: ["metrics", "throughput", workspaceId, days],
    queryFn: async () => {
      const res = await api.get<Throughput>(
        `/workspaces/${workspaceId}/metrics/throughput`,
        { params: { days } },
      );
      return res.data;
    },
    enabled: !!workspaceId,
  });
}
