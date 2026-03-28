import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { QuarantinedRecord, QuarantineSummary } from "@/types/api";

export function useQuarantineRecords(
  workspaceId: string | undefined,
  pipelineId?: string,
) {
  return useQuery({
    queryKey: ["quarantine", workspaceId, pipelineId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (pipelineId) params.pipeline_id = pipelineId;
      const res = await api.get<QuarantinedRecord[]>(
        `/workspaces/${workspaceId}/quarantine`,
        { params },
      );
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useQuarantineSummary(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["quarantine", "summary", workspaceId],
    queryFn: async () => {
      const res = await api.get<QuarantineSummary>(
        `/workspaces/${workspaceId}/quarantine/summary`,
      );
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useResolveQuarantine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      resolution,
    }: {
      id: string;
      resolution: "approved" | "rejected";
    }) => {
      const res = await api.patch(`/quarantine/${id}`, { resolution });
      return res.data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["quarantine"] });
      toast.success(
        `Record ${vars.resolution === "approved" ? "approved" : "rejected"}`,
      );
    },
  });
}

export function useBulkResolve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      resolution,
    }: {
      ids: string[];
      resolution: "approved" | "rejected";
    }) => {
      const res = await api.post("/quarantine/bulk-resolve", {
        ids,
        resolution,
      });
      return res.data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["quarantine"] });
      toast.success(
        `${vars.ids.length} record${vars.ids.length === 1 ? "" : "s"} ${vars.resolution === "approved" ? "approved" : "rejected"}`,
      );
    },
  });
}
