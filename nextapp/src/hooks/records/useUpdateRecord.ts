import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useUpdateRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recordId,
      data,
    }: {
      recordId: string;
      data: {
        title?: string;
        description?: string;
        category?: string;
      };
    }) => {
      const response = await fetch(`/api/records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update record");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records"] });
    },
  });
}

