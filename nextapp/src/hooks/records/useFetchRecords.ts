import { useQuery } from "@tanstack/react-query";

export function useFetchRecords(params?: {
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["records", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set("search", params.search);
      if (params?.category) searchParams.set("category", params.category);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      if (params?.offset) searchParams.set("offset", params.offset.toString());

      const response = await fetch(`/api/records?${searchParams}`);
      if (!response.ok) throw new Error("Failed to fetch records");
      return response.json();
    },
  });
}

