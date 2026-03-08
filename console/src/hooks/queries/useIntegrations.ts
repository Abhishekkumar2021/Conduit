import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Integration, Asset } from "@/types/api";

export type Adapter = {
  type: string;
  name: string;
  category: string;
  vault_fields: string[];
  capabilities: string[];
};

export const integrationKeys = {
  all: ["integrations"] as const,
  list: (workspaceId: string) =>
    [...integrationKeys.all, "list", workspaceId] as const,
  adapters: ["adapters"] as const,
};

export function useAdapters() {
  return useQuery({
    queryKey: integrationKeys.adapters,
    queryFn: async () => {
      const { data } = await api.get<Adapter[]>("/integrations/adapters");
      return data;
    },
  });
}

export function useIntegrations(workspaceId: string) {
  return useQuery({
    queryKey: integrationKeys.list(workspaceId),
    queryFn: async () => {
      const { data } = await api.get<Integration[]>(
        `/workspaces/${workspaceId}/integrations`,
      );
      return data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateIntegration(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      adapter_type: string;
      config: Record<string, string | number>;
    }) => {
      const { data: response } = await api.post<Integration>(
        `/workspaces/${workspaceId}/integrations`,
        data,
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: integrationKeys.list(workspaceId),
      });
    },
  });
}

export function useIntegrationAssets(integrationId?: string | null) {
  return useQuery({
    queryKey: [...integrationKeys.all, "assets", integrationId],
    queryFn: async () => {
      if (!integrationId) return [];
      const { data } = await api.get<Asset[]>(
        `/integrations/${integrationId}/assets`,
      );
      return data;
    },
    enabled: !!integrationId,
  });
}

export function useDiscoverAssets(integrationId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!integrationId) throw new Error("No integration selected");
      const { data } = await api.post<Integration>(
        `/integrations/${integrationId}/discover`,
      );
      if (
        data.status === "unreachable" ||
        data.status === ("error" as string)
      ) {
        throw new Error(data.status_message || "Failed to discover assets.");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...integrationKeys.all, "assets", integrationId],
      });
      // We also invalidate integrations list because its status might change to healthy/error
      queryClient.invalidateQueries({
        queryKey: integrationKeys.all,
      });
    },
  });
}
