import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface PaginationProps {
  pageIndex: number
  pageSize: number
  totalRows: number
  onPageChange: (pageIndex: number) => void
}

/**
 * Paginação simples p/ listas mobile card (TableAll já traz a sua própria no desktop).
 * pageIndex é 0-based.
 */
export const Pagination = ({ pageIndex, pageSize, totalRows, onPageChange }: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min(totalRows, (pageIndex + 1) * pageSize)

  if (totalRows <= pageSize) return null

  return (
    <div className="flex items-center justify-between mt-3 px-1">
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {from}–{to} de {totalRows}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
          disabled={pageIndex === 0}
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400 px-1">
          {pageIndex + 1} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages - 1, pageIndex + 1))}
          disabled={pageIndex >= totalPages - 1}
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
