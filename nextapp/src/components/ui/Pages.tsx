import { Button } from "./button";
import { PaginationType } from "@/hooks/usePaginatedQuery";
import { FastForward, Rewind, SkipForward, SkipBack } from "lucide-react";

export const Pages = ({
  pagination,
  setCurrentPage,
}: {
  pagination: PaginationType | null;
  setCurrentPage: (page: number) => void;
}) => {
  return (
    <div className="flex justify-center items-center gap-2">
      <Button
        variant="outline"
        className="cursor-pointer"
        disabled={pagination?.page === 1}
        onClick={() => setCurrentPage(1)}
      >
        <SkipBack />
      </Button>
      <Button
        variant="outline"
        className="cursor-pointer"
        disabled={pagination?.page === 1}
        onClick={() => {
          if (!pagination?.page) return;
          setCurrentPage(Math.max(pagination.page - 1, 1));
        }}
      >
        <Rewind />
      </Button>
      {pagination &&
        pagination.pages &&
        Array.from({ length: pagination.pages }, (_, i) => i + 1).map(
          (page) => (
            <Button
              variant="outline"
              key={page}
              className="cursor-pointer"
              onClick={() => setCurrentPage(page)}
              disabled={page === pagination?.page}
            >
              {page}
            </Button>
          )
        )}
      <Button
        variant="outline"
        className="cursor-pointer"
        disabled={pagination?.page === pagination?.pages}
        onClick={() => {
          if (!pagination?.page) return;
          setCurrentPage(Math.min(pagination.page + 1, pagination?.pages));
        }}
      >
        <FastForward />
      </Button>
      <Button
        variant="outline"
        className="cursor-pointer"
        disabled={pagination?.page === pagination?.pages}
        onClick={() => setCurrentPage(pagination?.pages || 1)}
      >
        <SkipForward />
      </Button>
    </div>
  );
};
