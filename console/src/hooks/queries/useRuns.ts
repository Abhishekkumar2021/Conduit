import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Run } from "@/types/api";

export const runKeys = {
  all: ["runs"] as const,
  list: (workspaceId: string) => [...runKeys.all, "list", workspaceId] as const,
};

export function useRuns(workspaceId: string) {
  return useQuery({
    queryKey: runKeys.list(workspaceId),
    queryFn: async () => {
      const { data } = await api.get<Run[]>(`/workspaces/${workspaceId}/runs`);
      return data;
    },
    enabled: !!workspaceId,
  });
}
