import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PipelineSchedule } from "@/types/api";

export function usePipelineSchedule(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ["schedule", pipelineId],
    queryFn: async () => {
      const res = await api.get<PipelineSchedule>(
        `/pipelines/${pipelineId}/schedule`,
      );
      return res.data;
    },
    enabled: !!pipelineId,
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pipelineId,
      schedule_cron,
      schedule_timezone,
    }: {
      pipelineId: string;
      schedule_cron: string | null;
      schedule_timezone?: string;
    }) => {
      const res = await api.put(`/pipelines/${pipelineId}/schedule`, {
        schedule_cron,
        schedule_timezone: schedule_timezone || "UTC",
      });
      return res.data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["schedule", vars.pipelineId] });
      qc.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
}

export function useClearSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pipelineId: string) => {
      await api.delete(`/pipelines/${pipelineId}/schedule`);
    },
    onSuccess: (_, pipelineId) => {
      qc.invalidateQueries({ queryKey: ["schedule", pipelineId] });
      qc.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
}
