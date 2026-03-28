import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Workspace } from "@/types/api";

export const workspaceKeys = {
  all: ["workspaces"] as const,
  detail: (id: string) => [...workspaceKeys.all, id] as const,
};

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.all,
    queryFn: async () => {
      const { data } = await api.get<Workspace[]>(`/workspaces`);
      return data;
    },
  });
}

export function useWorkspace(id: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Workspace>(`/workspaces/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; slug?: string }) => {
      const { data } = await api.post<Workspace>("/workspaces", payload);
      return data;
    },
    onSuccess: (ws) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      toast.success(`Workspace "${ws.name}" created`);
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Workspace>;
    }) => {
      const res = await api.patch<Workspace>(`/workspaces/${id}`, data);
      return res.data;
    },
    onSuccess: (ws, variables) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(variables.id),
      });
      toast.success(`Workspace "${ws.name}" updated`);
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/workspaces/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      toast.success("Workspace deleted");
    },
  });
}
