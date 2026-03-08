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

export function useUpdateIntegration(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    Integration,
    Error,
    {
      id: string;
      data: {
        name?: string;
        config?: Record<string, string | number | boolean | null>;
      };
    }
  >({
    mutationFn: async ({ id, data }) => {
      const { data: response } = await api.patch<Integration>(
        `/integrations/${id}`,
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

export function useDeleteIntegration(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await api.delete(`/integrations/${id}`);
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

export function useDiscoverAssets(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation<Integration, Error, string>({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Integration>(
        `/integrations/${id}/discover`,
      );
      if (
        data.status === "unreachable" ||
        data.status === ("error" as string)
      ) {
        throw new Error(data.status_message || "Failed to discover assets.");
      }
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({
        queryKey: [...integrationKeys.all, "assets", id],
      });
      queryClient.invalidateQueries({
        queryKey: integrationKeys.list(workspaceId),
      });
    },
  });
}

export function useTestConnection() {
  const queryClient = useQueryClient();

  return useMutation<Integration, Error, string>({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Integration>(`/integrations/${id}/test`);
      if (
        data.status === "unreachable" ||
        data.status === ("error" as string)
      ) {
        throw new Error(data.status_message || "Connection test failed.");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: integrationKeys.all,
      });
    },
  });
}

interface RunnerStatus {
  missing_variables: string[];
  is_healthy: boolean;
}

export function useRunnerStatus() {
  return useQuery({
    queryKey: ["runner-status"],
    queryFn: async () => {
      const { data } = await api.get<RunnerStatus>("/system/runner-status");
      return data;
    },
    refetchInterval: 30000,
  });
}
