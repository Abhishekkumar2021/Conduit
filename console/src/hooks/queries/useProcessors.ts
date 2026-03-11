import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ProcessorParam {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  options?: string[];
}

export interface ProcessorMeta {
  type: string;
  name: string;
  category: string;
  description: string;
  parameters: ProcessorParam[];
}

export function useProcessors() {
  return useQuery<ProcessorMeta[]>({
    queryKey: ["processors"],
    queryFn: async () => {
      const { data } = await api.get<ProcessorMeta[]>("/processors");
      return data;
    },
    staleTime: Infinity, // Processor list never changes at runtime
  });
}
