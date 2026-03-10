import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Pages } from "@/components/ui/Pages";

export type SearchParamsType = Record<string, string>;

export type PaginationType = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export const usePaginatedQuery = <T,>({
  queryKey,
  queryFn,
  searchParams = {},
  limit = "12",
}: {
  queryKey: string[];
  queryFn: (params: URLSearchParams) => Promise<T>;
  searchParams?: SearchParamsType;
  limit?: string;
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const PageNavigation = () => {
    return (
      <Pages
        pagination={{
          ...pagination,
          page: currentPage,
          limit: pagination?.limit ?? +limit,
          total: pagination?.total ?? 0,
          pages: pagination?.pages ?? 1,
        }}
        setCurrentPage={setCurrentPage}
      />
    );
  };

  const params = new URLSearchParams({
    page: currentPage.toString(),
    limit,
    ...searchParams,
  });

  const queryResult = useQuery({
    queryKey: [...queryKey, currentPage, searchParams],
    queryFn: () => queryFn(params),
  });

  useEffect(() => {
    if (queryResult.data) {
      setPagination(
        (queryResult.data as T & { pagination: PaginationType }).pagination
      );
    }
  }, [queryResult.data]);

  return {
    ...queryResult,
    currentPage,
    setCurrentPage,
    numPages: pagination?.pages,
    PageNavigation,
  };
};
