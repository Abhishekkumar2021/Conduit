import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function useClonePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pipelineId,
      name,
      description,
    }: {
      pipelineId: string;
      name: string;
      description?: string;
    }) => {
      const res = await api.post(`/pipelines/${pipelineId}/clone`, {
        name,
        description,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Pipeline cloned: ${data.name}`);
      qc.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
}

export function useExportPipeline() {
  return useMutation({
    mutationFn: async (pipelineId: string) => {
      const res = await api.get(`/pipelines/${pipelineId}/export`);
      return res.data;
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.pipeline?.name || "pipeline"}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Pipeline exported");
    },
  });
}

export function useImportPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workspaceId,
      file,
    }: {
      workspaceId: string;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(
        `/workspaces/${workspaceId}/pipelines/import`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Pipeline imported: ${data.name}`);
      qc.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });
}
