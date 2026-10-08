"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ColumnDef<TData> {
  key: string;
  header: React.ReactNode;
  accessor?: (row: TData) => React.ReactNode;
  render?: (row: TData, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: "left" | "center" | "right";
  hideOnMobile?: boolean;
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData, index: number) => void;
  keyExtractor?: (row: TData, index: number) => string;
  renderMobileCard?: (row: TData, index: number) => React.ReactNode;
  maxHeight?: string;
  className?: string;
}

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "No data available.",
  onRowClick,
  keyExtractor,
  renderMobileCard,
  maxHeight,
  className,
}: DataTableProps<TData>) {
  const getKey = (row: TData, index: number): string => {
    if (keyExtractor) return keyExtractor(row, index);
    const rowObj = row as Record<string, unknown>;
    if (rowObj?.id !== undefined && rowObj?.id !== null) return String(rowObj.id);
    if (rowObj?._id !== undefined && rowObj?._id !== null) return String(rowObj._id);
    return String(index);
  };

  const getCellValue = (
    col: ColumnDef<TData>,
    row: TData,
    index: number
  ): React.ReactNode => {
    if (col.render) return col.render(row, index);
    if (col.accessor) return col.accessor(row);
    const val = (row as Record<string, unknown>)?.[col.key];
    if (val === undefined || val === null) return "—";
    if (typeof val === "boolean") return val ? "Yes" : "No";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  const mobileColumns = columns.filter((col) => !col.hideOnMobile);

  return (
    <div className={cn("w-full space-y-3", className)}>
      {/* =========================================================
          MOBILE VIEW: Responsive Card Layout (Zero Horizontal Scroll!)
          ========================================================= */}
      <div className={cn("sm:hidden space-y-2.5", maxHeight && cn(maxHeight, "overflow-y-auto pr-1"))}>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`mobile-skeleton-${i}`}
              className="p-3.5 rounded-2xl border border-border/70 bg-card space-y-3 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 rounded bg-muted/70" />
                <div className="h-4 w-16 rounded-full bg-muted/70" />
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="h-3 w-full rounded bg-muted/50" />
                <div className="h-3 w-4/5 rounded bg-muted/50" />
              </div>
            </div>
          ))
        ) : data.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-xs rounded-2xl border border-dashed border-border/70 p-6">
            <p>{emptyMessage}</p>
          </div>
        ) : (
          data.map((row, index) => {
            const key = getKey(row, index);
            if (renderMobileCard) {
              return (
                <div
                  key={key}
                  onClick={() => onRowClick?.(row, index)}
                  className={cn(
                    onRowClick && "cursor-pointer active:scale-[0.99] transition-transform"
                  )}
                >
                  {renderMobileCard(row, index)}
                </div>
              );
            }

            // Default Touch-Friendly Mobile Data Card
            const firstCol = mobileColumns[0];
            const otherCols = mobileColumns.slice(1);

            return (
              <div
                key={key}
                onClick={() => onRowClick?.(row, index)}
                className={cn(
                  "p-3.5 rounded-2xl border border-border/70 bg-card shadow-2xs space-y-2 transition-all",
                  onRowClick && "cursor-pointer active:bg-muted/50"
                )}
              >
                {firstCol && (
                  <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/50">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {firstCol.header}
                    </span>
                    <div className="text-xs font-bold text-foreground">
                      {getCellValue(firstCol, row, index)}
                    </div>
                  </div>
                )}
                <div className="space-y-1.5 text-xs">
                  {otherCols.map((col) => (
                    <div
                      key={col.key}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {col.header}
                      </span>
                      <span className="font-medium text-foreground text-right truncate max-w-[65%]">
                        {getCellValue(col, row, index)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* =========================================================
          DESKTOP VIEW: High-Density 9-Column Table
          ========================================================= */}
      <div
        className={cn(
          "hidden sm:block overflow-x-auto no-scrollbar rounded-2xl border border-border/70 bg-card",
          maxHeight && cn(maxHeight, "overflow-y-auto")
        )}
      >
        <table className="w-full text-left text-xs">
          <thead className={cn(maxHeight && "sticky top-0 bg-card/95 backdrop-blur-md z-10")}>
            <tr className="border-b border-border/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "py-3 px-3 font-bold",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={`table-skeleton-${i}`} className="animate-pulse">
                  {columns.map((col) => (
                    <td key={col.key} className="py-3 px-3">
                      <div className="h-4 w-20 rounded bg-muted/60" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-muted-foreground text-xs"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const key = getKey(row, index);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row, index)}
                    className={cn(
                      "hover:bg-muted/40 transition-colors group",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "py-3 px-3",
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center",
                          col.className
                        )}
                      >
                        {getCellValue(col, row, index)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
