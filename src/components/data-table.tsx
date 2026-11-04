import { useMemo, type ReactNode } from 'react'
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from './common'

export interface Column<T> {
  id: string
  header: string
  cell: (row: T) => ReactNode
}

const features = tableFeatures({})

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: string
}

export function DataTable<T extends object>({ columns, rows, rowKey, empty = 'Chưa có dữ liệu.' }: DataTableProps<T>) {
  const defs = useMemo(() => {
    const helper = createColumnHelper<typeof features, T>()
    return columns.map((column) => helper.display({ id: column.id, header: column.header, cell: ({ row }) => column.cell(row.original) }))
    // Column cells close over callers' state, so they rebuild with each render of the caller.
  }, [columns])
  const table = useTable({ features, columns: defs, data: rows, getRowId: rowKey })

  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id}><table.FlexRender header={header} /></TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}><table.FlexRender cell={cell} /></TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
