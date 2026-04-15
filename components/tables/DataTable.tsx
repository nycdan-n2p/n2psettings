"use client";

import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchKey?: string | boolean;
  searchPlaceholder?: string;
  initialSorting?: SortingState;
  pageSize?: number;
  flush?: boolean;
}

export function DataTable<TData>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  initialSorting = [],
  pageSize = 20,
  flush = false,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: { pageSize },
    },
  });

  const filteredRows = table.getFilteredRowModel().rows;
  const totalRows = filteredRows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSizeState = table.getState().pagination.pageSize;
  const startRow = pageIndex * pageSizeState + 1;
  const endRow = Math.min((pageIndex + 1) * pageSizeState, totalRows);

  return (
    <div>
      {(searchKey ?? searchPlaceholder) && (
        <div className="mb-4">
          <input
            type="search"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="n2p-table-search-input w-full max-w-sm px-3 py-2 bg-[#F9F9FB] rounded-[12px] text-sm focus:outline-none"
          />
        </div>
      )}
      <div className="rounded-lg bg-white">
        <div className="overflow-x-auto">
          <table className="n2p-table w-full text-sm min-w-[500px]">
            <thead className="sticky top-0">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const isSorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        className={`${canSort ? "cursor-pointer select-none hover:bg-gray-100" : ""}`}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {canSort && (
                            <span className="text-gray-400 shrink-0">
                              {isSorted === "asc" ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : isSorted === "desc" ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronsUpDown className="w-4 h-4 opacity-50" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No results found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
      {(table.getPageCount() > 1 || totalRows > 0) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 px-1">
          <p className="text-sm text-gray-600 order-2 sm:order-1">
            {totalRows > 0 ? (
              <>Showing {startRow}–{endRow} of {totalRows}</>
            ) : (
              <>No results</>
            )}
          </p>
          {table.getPageCount() > 1 && (
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <span className="text-sm text-gray-500">
                Page {pageIndex + 1} of {table.getPageCount()}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="p-2 rounded-[12px] bg-[#F9F9FB] hover:bg-[#eeeff4] disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="p-2 rounded-[12px] bg-[#F9F9FB] hover:bg-[#eeeff4] disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
