import { useState, useMemo, createContext, useContext, type ReactNode } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type VisibilityState,
  type Row,
  type Header,
  type HeaderGroup,
} from "@tanstack/react-table";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  Bars3Icon,
  ViewColumnsIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// --- Types ---
interface ColumnMeta {
  isNumeric?: boolean;
  align?: "left" | "center" | "right";
  label?: string; // usado no dropdown de colunas quando o header não é string simples
}

interface ModernTableProps<T extends object> {
  columns: ColumnDef<T, any>[];
  data: T[];
  searchPlaceholder?: string;
  isLoading?: boolean;
  emptyMessage?: string;

  // Identidade estável da linha — obrigatório se usar seleção ou drag-reorder
  getRowId?: (row: T) => string;

  // Server-side pagination
  serverPagination?: boolean;
  totalRows?: number;
  pageIndex?: number;
  pageSize?: number;
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;

  // Server-side search
  onSearchChange?: (value: string) => void;
  searchValue?: string;

  // Seleção em massa
  enableRowSelection?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  bulkActions?: (selectedIds: string[], clearSelection: () => void) => ReactNode;

  // Ações por linha (ícones/botões à direita, ex: editar/excluir)
  rowActions?: (row: T) => ReactNode;

  // Colunas configuráveis (mostrar/ocultar)
  enableColumnVisibility?: boolean;

  // Drag-and-drop pra reordenar linhas manualmente
  // Obs: só faz sentido sem sorting/search ativos — a ordem reflete `data` tal como veio.
  enableRowDragReorder?: boolean;
  onRowReorder?: (newData: T[]) => void;

  // Header fixo ao rolar (precisa de um container com altura/overflow)
  stickyHeader?: boolean;
  maxBodyHeight?: string; // ex: "60vh" — se definido, o corpo da tabela rola e o header fica fixo
}

// --- Skeleton Component ---
const SkeletonRow = <T extends object>({ columns }: { columns: ColumnDef<T, any>[] }) => (
  <tr className="border-b border-gray-100 dark:border-gray-900">
    {columns.map((_, idx) => (
      <td key={idx} className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-full" />
      </td>
    ))}
  </tr>
);

// --- Empty State ---
const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center mb-3">
      <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    </div>
    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{message}</p>
    <p className="text-xs text-gray-500 dark:text-gray-400">Nenhum resultado encontrado</p>
  </div>
);

// --- Pagination Component ---
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  isLoading,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}) => {
  const getPageNumbers = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 2) return [1, 2, 3, "...", totalPages];
    if (currentPage >= totalPages - 1) return [1, "...", totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", currentPage, "...", totalPages];
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isLoading || currentPage === 1}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </button>

      {getPageNumbers().map((page, idx) =>
        page === "..." ? (
          <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page as number)}
            disabled={isLoading}
            className={clsx(
              "w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors",
              page === currentPage ? "bg-teal-900 text-white" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900",
              isLoading && "opacity-40 cursor-not-allowed"
            )}
          >
            {page}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isLoading || currentPage === totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

// --- Column visibility dropdown ---
const ColumnVisibilityMenu = <T,>({ table }: { table: ReturnType<typeof useReactTable<T>> }) => {
  const [open, setOpen] = useState(false);
  const toggleable = table.getAllLeafColumns().filter((c: any) => !["__select", "__drag", "__actions"].includes(c.id) && c.getCanHide());

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
      >
        <ViewColumnsIcon className="w-4 h-4" />
        Colunas
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-52 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg py-1.5">
            {toggleable.map((col: any) => {
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
              const meta = col.columnDef.meta as ColumnMeta | undefined;
              const label = meta?.label ?? (typeof col.columnDef.header === "string" ? col.columnDef.header : col.id);
              return (
                <button
                  key={col.id}
                  onClick={() => col.toggleVisibility()}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <span className={clsx("w-4 h-4 rounded border flex items-center justify-center shrink-0", col.getIsVisible() ? "bg-teal-600 border-teal-600" : "border-gray-300 dark:border-gray-700")}>
                    {col.getIsVisible() && <CheckIcon className="w-3 h-3 text-white" />}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// --- Drag handle (compartilha attributes/listeners da linha via contexto) ---
const RowDragContext = createContext<{ attributes: any; listeners: any } | null>(null);

const DragHandle = () => {
  const ctx = useContext(RowDragContext);
  return (
    <button
      {...ctx?.attributes}
      {...ctx?.listeners}
      onClick={e => e.stopPropagation()}
      className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-500 dark:text-gray-700 dark:hover:text-gray-400 touch-none"
    >
      <Bars3Icon className="w-4 h-4" />
    </button>
  );
};

const DraggableRow = ({ rowId, children }: { rowId: string; children: ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rowId });
  return (
    <RowDragContext.Provider value={{ attributes, listeners }}>
      <tr
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, position: "relative", zIndex: isDragging ? 10 : "auto" }}
        className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors bg-white dark:bg-gray-950"
      >
        {children}
      </tr>
    </RowDragContext.Provider>
  );
};

// --- Main Table Component ---
export const TableAll = <T extends object>({
  columns,
  data = [],
  searchPlaceholder = "Pesquisar...",
  isLoading = false,
  emptyMessage = "Sem dados",
  getRowId,
  serverPagination = false,
  totalRows = 0,
  pageIndex = 0,
  pageSize = 10,
  onPaginationChange,
  onSearchChange,
  searchValue = "",
  enableRowSelection = false,
  onSelectionChange,
  bulkActions,
  rowActions,
  enableColumnVisibility = false,
  enableRowDragReorder = false,
  onRowReorder,
  stickyHeader = true,
  maxBodyHeight,
}: ModernTableProps<T>) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [localSearch, setLocalSearch] = useState(searchValue);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const safePageIndex = Math.max(0, pageIndex);
  const safePageSize = Math.max(1, pageSize);
  const safeTotalRows = Math.max(0, totalRows);
  const safePageCount = Math.max(1, Math.ceil(safeTotalRows / safePageSize));

  // injeta colunas especiais (drag / seleção / ações) em torno das colunas reais
  const tableColumns = useMemo<ColumnDef<T, any>[]>(() => {
    const cols: ColumnDef<T, any>[] = [];

    if (enableRowDragReorder) {
      cols.push({
        id: "__drag",
        header: () => null,
        cell: () => <DragHandle />,
        enableSorting: false,
        enableHiding: false,
        size: 32,
        meta: { align: "center" },
      });
    }

    if (enableRowSelection) {
      cols.push({
        id: "__select",
        header: ({ table }: { table: any }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            ref={el => {
              if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="rounded border-gray-300 dark:border-gray-700 text-teal-600 focus:ring-teal-500"
          />
        ),
        cell: ({ row }: { row: Row<T> }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={e => e.stopPropagation()}
            className="rounded border-gray-300 dark:border-gray-700 text-teal-600 focus:ring-teal-500"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 32,
        meta: { align: "center" },
      });
    }

    cols.push(...columns);

    if (rowActions) {
      cols.push({
        id: "__actions",
        header: () => null,
        cell: ({ row }: { row: Row<T> }) => <div className="flex items-center justify-end gap-1">{rowActions(row.original)}</div>,
        enableSorting: false,
        enableHiding: false,
        meta: { align: "right" },
      });
    }

    return cols;
  }, [columns, enableRowDragReorder, enableRowSelection, rowActions]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getRowId: getRowId ? ((row: T) => getRowId(row)) : undefined,
    state: {
      sorting,
      rowSelection,
      columnVisibility,
      pagination: { pageIndex: safePageIndex, pageSize: safePageSize },
    },
    onSortingChange: setSorting,
    onRowSelectionChange: (updater: any) => {
      setRowSelection(updater);
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
      onSelectionChange?.(Object.keys(next));
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: serverPagination,
    pageCount: serverPagination ? safePageCount : undefined,
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    onSearchChange?.(value);
  };

  const handlePageChange = (page: number) => {
    if (!serverPagination || !onPaginationChange) return;
    onPaginationChange({ pageIndex: page - 1, pageSize: safePageSize });
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!serverPagination || !onPaginationChange) return;
    onPaginationChange({ pageIndex: 0, pageSize: Number(e.target.value) });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onRowReorder || !getRowId) return;
    const ids = data.map(getRowId);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onRowReorder(arrayMove(data, oldIndex, newIndex));
  };

  const selectedIds = Object.keys(rowSelection);
  const clearSelection = () => setRowSelection({});

  const startEntry = safeTotalRows === 0 ? 0 : safePageIndex * safePageSize + 1;
  const endEntry = Math.min((safePageIndex + 1) * safePageSize, safeTotalRows);

  const rowIdsForDrag = enableRowDragReorder && getRowId ? table.getRowModel().rows.map((r: Row<T>) => r.id) : [];

  const renderRows = () =>
    table.getRowModel().rows.map((row: Row<T>) => {
      const cells = row.getVisibleCells().map((cell: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
              const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
        return (
          <td
            key={cell.id}
            className={clsx(
              "px-4 py-3 text-sm text-gray-900 dark:text-gray-100",
              meta?.align === "center" && "text-center",
              meta?.align === "right" && "text-right",
              !meta?.align && "text-left"
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext()) as ReactNode}
          </td>
        );
      });

      if (enableRowDragReorder) {
        return (
          <DraggableRow key={row.id} rowId={row.id}>
            {cells}
          </DraggableRow>
        );
      }

      return (
        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
          {cells}
        </tr>
      );
    });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={localSearch}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
            className="w-full px-3 py-2 pr-8 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg placeholder-gray-400 dark:placeholder-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <svg className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-2">
          {enableColumnVisibility && <ColumnVisibilityMenu table={table} />}

          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Mostrar:</span>
            <select
              value={safePageSize}
              onChange={handlePageSizeChange}
              className="px-2 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              {[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Barra de ações em massa */}
      {enableRowSelection && selectedIds.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-800 rounded-xl">
          <span className="text-sm font-medium text-teal-800 dark:text-teal-300">
            {selectedIds.length} selecionado{selectedIds.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            {bulkActions?.(selectedIds, clearSelection)}
            <button onClick={clearSelection} className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-950">
        <div className="overflow-x-auto" style={maxBodyHeight ? { maxHeight: maxBodyHeight, overflowY: "auto" } : undefined}>
          <table className="w-full">
            <thead className={clsx("bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800", stickyHeader && "sticky top-0 z-10")}>
              {table.getHeaderGroups().map((headerGroup: HeaderGroup<T>) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header: Header<T, unknown>) => {
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                    const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                    const canSort = header.column.getCanSort();
                    return (
                      <th
                        key={header.id}
                        className={clsx(
                          "px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap",
                          canSort && "cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800/50",
                          meta?.align === "center" && "text-center",
                          meta?.align === "right" && "text-right",
                          !meta?.align && "text-left"
                        )}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      >
                        {header.isPlaceholder ? null : (
                          <div className="flex items-center gap-2 justify-between">
                            <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            {canSort && <ChevronUpDownIcon className="w-3.5 h-3.5 text-gray-400" />}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => <SkeletonRow key={idx} columns={tableColumns} />)
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={tableColumns.length}>
                    <EmptyState message={emptyMessage} />
                  </td>
                </tr>
              ) : enableRowDragReorder ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={rowIdsForDrag} strategy={verticalListSortingStrategy}>
                    {renderRows()}
                  </SortableContext>
                </DndContext>
              ) : (
                renderRows()
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      {safeTotalRows > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between text-sm">
          <div className="text-gray-600 dark:text-gray-400 order-2 sm:order-1">
            Mostrando {startEntry} a {endEntry} de {safeTotalRows} resultados
          </div>
          <div className="order-1 sm:order-2">
            <Pagination currentPage={safePageIndex + 1} totalPages={safePageCount} onPageChange={handlePageChange} isLoading={isLoading} />
          </div>
        </div>
      )}
    </div>
  );
};

export default TableAll;