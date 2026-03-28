import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { Run } from "@/types/api";

export function useRetryRun() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (runId: string) => {
      const res = await api.post<Run>(`/runs/${runId}/retry`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Run retried — opening new run`);
      qc.invalidateQueries({ queryKey: ["runs"] });
      navigate(`/runs/${data.id}`);
    },
  });
}

export function useCancelRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      const res = await api.post<Run>(`/runs/${runId}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Run cancelled");
      qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}
