"use client";

import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ReactNode } from "react";

export interface Column<T> {
  header: string;
  accessor?: keyof T;
  render?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  link?: (row: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  link,
}: DataTableProps<T>) {
  const router = useRouter();
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    column.headerClassName || ""
                  }`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className={clsx(
                  "hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors",
                  link ? "cursor-pointer" : ""
                )}
                onClick={() => (link ? router.push(link(row)) : null)}
              >
                {columns.map((column, index) => (
                  <td
                    key={index}
                    className={`px-6 py-4 ${column.className || ""}`}
                  >
                    {column.render
                      ? column.render(row)
                      : column.accessor
                      ? String(row[column.accessor])
                      : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
