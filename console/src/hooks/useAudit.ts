import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AuditLogEntry } from "@/types/api";

export function useAuditLog(
  workspaceId: string | undefined,
  filters?: { entity_type?: string; action?: string; limit?: number },
) {
  return useQuery({
    queryKey: ["audit", workspaceId, filters],
    queryFn: async () => {
      const res = await api.get<AuditLogEntry[]>(
        `/workspaces/${workspaceId}/audit`,
        { params: filters },
      );
      return res.data;
    },
    enabled: !!workspaceId,
  });
}
