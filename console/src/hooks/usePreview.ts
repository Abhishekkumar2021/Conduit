import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DataPreview } from "@/types/api";

export function useDataPreview(
  integrationId: string | undefined,
  asset: string | undefined,
  limit = 50,
) {
  return useQuery({
    queryKey: ["preview", integrationId, asset, limit],
    queryFn: async () => {
      const res = await api.get<DataPreview>(
        `/integrations/${integrationId}/preview`,
        { params: { asset, limit } },
      );
      return res.data;
    },
    enabled: !!integrationId && !!asset,
  });
}
