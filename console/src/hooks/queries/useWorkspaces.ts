import { useQuery } from "@tanstack/react-query";
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
