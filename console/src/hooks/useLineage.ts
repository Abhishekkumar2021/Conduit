import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LineageGraph } from "@/types/api";

export function useWorkspaceLineage(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["lineage", "workspace", workspaceId],
    queryFn: async () => {
      const res = await api.get<LineageGraph>(
        `/workspaces/${workspaceId}/lineage`,
      );
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function usePipelineLineage(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ["lineage", "pipeline", pipelineId],
    queryFn: async () => {
      const res = await api.get<LineageGraph>(
        `/pipelines/${pipelineId}/lineage`,
      );
      return res.data;
    },
    enabled: !!pipelineId,
  });
}
