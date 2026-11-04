import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppSelect } from '@/components/app-select'
import { PageHeader, Pagination, QueryState } from '@/components/common'
import { DataTable, type Column } from '@/components/data-table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { api } from '@/lib/api'
import { formatDate, statusLabel } from '@/lib/labels'
import { useApiMutation } from '@/lib/query'
import type { Page } from '@/lib/types'
import { useMeta } from '@/lib/use-meta'

const PER_PAGE = 50
const ADMIN_ROLE = 'admin'

interface UserRow {
  id: string
  email: string | null
  role: string | null
  createdAt: string | null
  lastSignInAt: string | null
  appUserId: string | null
  proficiencyLevel: string | null
}

export function UsersPage() {
  const meta = useMeta()
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState<{ id: string; email: string | null; role: string | null } | null>(null)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['users', page],
    queryFn: () => api<Page<UserRow>>('/admin/users', { query: { page, perPage: PER_PAGE } }),
  })
  const setRole = useApiMutation<{ id: string; role: string | null }>({
    mutationFn: ({ id, role }) => api(`/admin/users/${id}/role`, { method: 'PUT', body: { role } }),
    invalidate: [['users']],
    onSuccess: () => toast.success('Đã đổi role', { description: 'Có hiệu lực khi người đó làm mới phiên đăng nhập.' }),
  })
  const options = useMemo(() => meta.assignableRoles.map((value) => ({ value, label: statusLabel(value) })), [meta.assignableRoles])
  const columns: Column<UserRow>[] = [
    { id: 'email', header: 'Email', cell: (u) => u.email ?? '—' },
    {
      id: 'role',
      header: 'Role',
      cell: (u) => (
        <AppSelect
          className="w-40"
          options={u.role === ADMIN_ROLE ? [{ value: ADMIN_ROLE, label: statusLabel(ADMIN_ROLE) }] : options}
          value={u.role}
          clearLabel="Người học"
          disabled={u.role === ADMIN_ROLE || setRole.isPending}
          onChange={(role) => setPending({ id: u.id, email: u.email, role })}
        />
      ),
    },
    { id: 'level', header: 'Trình độ', cell: (u) => u.proficiencyLevel ?? '—' },
    { id: 'signin', header: 'Đăng nhập gần nhất', cell: (u) => formatDate(u.lastSignInAt) },
    { id: 'created', header: 'Tạo lúc', cell: (u) => formatDate(u.createdAt) },
  ]
  return (
    <>
      <PageHeader title="Người dùng" description="Chỉ cấp hoặc gỡ được quyền biên tập viên. Role mới có hiệu lực khi người đó làm mới phiên đăng nhập. Tài khoản admin không thể thay đổi." />
      <QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} />
      {data && (
        <>
          <DataTable columns={columns} rows={data.items} rowKey={(u) => u.id} />
          <Pagination total={data.total} limit={PER_PAGE} offset={(page - 1) * PER_PAGE} onChange={(offset) => setPage(offset / PER_PAGE + 1)} />
        </>
      )}
      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đổi role của {pending?.email ?? 'người dùng này'}?</AlertDialogTitle>
            <AlertDialogDescription>Role mới: {pending?.role ? statusLabel(pending.role) : 'Người học (không có quyền quản trị)'}.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) setRole.mutate({ id: pending.id, role: pending.role })
                setPending(null)
              }}
            >
              Đổi role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
