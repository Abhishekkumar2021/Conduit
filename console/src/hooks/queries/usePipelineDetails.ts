import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Revision, Run, RevisionCreate } from "@/types/api";

export const pipelineKeys = {
  all: ["pipelines"] as const,
  revisions: (pipelineId: string) =>
    [...pipelineKeys.all, "revisions", pipelineId] as const,
  latestRevision: (pipelineId: string) =>
    [...pipelineKeys.all, "revision-latest", pipelineId] as const,
  runs: (pipelineId: string) =>
    [...pipelineKeys.all, "runs", pipelineId] as const,
};

export function usePipelineRevisions(pipelineId: string) {
  return useQuery({
    queryKey: pipelineKeys.revisions(pipelineId),
    queryFn: async () => {
      const { data } = await api.get<Revision[]>(
        `/pipelines/${pipelineId}/revisions`,
      );
      return data;
    },
    enabled: !!pipelineId,
  });
}

export function useLatestRevision(pipelineId: string) {
  return useQuery({
    queryKey: pipelineKeys.latestRevision(pipelineId),
    queryFn: async () => {
      // Assuming a GET /pipelines/{id}/latest returns the latest revision or revision embedded in pipeline
      // For now, let's fetch all and take the first (highest number) or assume backend provides it.
      const { data } = await api.get<Revision[]>(
        `/pipelines/${pipelineId}/revisions`,
      );
      return data.sort((a, b) => b.number - a.number)[0];
    },
    enabled: !!pipelineId,
  });
}

export function usePipelineRuns(pipelineId: string) {
  return useQuery({
    queryKey: pipelineKeys.runs(pipelineId),
    queryFn: async () => {
      const { data } = await api.get<Run[]>(`/pipelines/${pipelineId}/runs`);
      return data;
    },
    enabled: !!pipelineId,
    refetchInterval: (query) => {
      const runs = query.state.data as Run[] | undefined;
      const hasActiveRun = runs?.some((r) =>
        ["pending", "queued", "running"].includes(r.status),
      );
      return hasActiveRun ? 3000 : false;
    },
  });
}

export function useTriggerRun(pipelineId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Run>(`/pipelines/${pipelineId}/runs`);
      return data;
    },
    onSuccess: () => {
      // Refresh runs list immediately when a run is triggered
      queryClient.invalidateQueries({
        queryKey: pipelineKeys.runs(pipelineId),
      });
    },
  });
}

export function useCreateRevision(pipelineId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RevisionCreate) => {
      const { data: response } = await api.post<Revision>(
        `/pipelines/${pipelineId}/revisions`,
        data,
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: pipelineKeys.latestRevision(pipelineId),
      });
      queryClient.invalidateQueries({
        queryKey: pipelineKeys.revisions(pipelineId),
      });
    },
  });
}
