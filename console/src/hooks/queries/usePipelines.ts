import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Pipeline, PipelineCreate } from "@/types/api";

export const pipelineKeys = {
  all: ["pipelines"] as const,
  list: (workspaceId: string) =>
    [...pipelineKeys.all, "list", workspaceId] as const,
  detail: (id: string) => [...pipelineKeys.all, "detail", id] as const,
};

export function usePipelines(workspaceId: string) {
  return useQuery({
    queryKey: pipelineKeys.list(workspaceId),
    queryFn: async () => {
      const { data } = await api.get<Pipeline[]>(
        `/workspaces/${workspaceId}/pipelines`,
      );
      return data;
    },
    enabled: !!workspaceId,
  });
}

export function usePipeline(id: string) {
  return useQuery({
    queryKey: pipelineKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Pipeline>(`/pipelines/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreatePipeline(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newPipeline: PipelineCreate) => {
      const { data } = await api.post<Pipeline>(
        `/workspaces/${workspaceId}/pipelines`,
        newPipeline,
      );
      return data;
    },
    onSuccess: (pipeline) => {
      queryClient.invalidateQueries({
        queryKey: pipelineKeys.list(workspaceId),
      });
      toast.success(`Pipeline "${pipeline.name}" created`);
    },
  });
}

export function useUpdatePipeline(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; description?: string };
    }) => {
      const { data: response } = await api.patch<Pipeline>(
        `/pipelines/${id}`,
        data,
      );
      return response;
    },
    onSuccess: (pipeline, variables) => {
      queryClient.invalidateQueries({
        queryKey: pipelineKeys.list(workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: pipelineKeys.detail(variables.id),
      });
      toast.success(`Pipeline "${pipeline.name}" updated`);
    },
  });
}

export function useDeletePipeline(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pipelines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: pipelineKeys.list(workspaceId),
      });
      toast.success("Pipeline deleted");
    },
  });
}
