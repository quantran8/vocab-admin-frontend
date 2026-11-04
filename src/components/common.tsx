import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { describeError } from '@/lib/errors'
import { statusLabel } from '@/lib/labels'

export function PageHeader({ title, description, back, actions }: { title: ReactNode; description?: ReactNode; back?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link to={back} className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Quay lại
          </Link>
        )}
        <h1 className="text-2xl font-semibold break-words">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  published: 'default',
  live: 'default',
  approved: 'secondary',
  curated: 'secondary',
  admin: 'default',
  editor: 'secondary',
  retired: 'destructive',
  recalled: 'destructive',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={VARIANTS[status] ?? 'outline'}>{statusLabel(status)}</Badge>
}

export function Pagination({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) {
  const last = Math.min(offset + limit, total)
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>{total === 0 ? 'Không có kết quả' : `${offset + 1}–${last} trên ${total}`}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          <ChevronLeft className="size-4" /> Trước
        </Button>
        <Button variant="outline" size="sm" disabled={last >= total} onClick={() => onChange(offset + limit)}>
          Sau <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export function QueryState({ isLoading, error, onRetry }: { isLoading: boolean; error: unknown; onRetry?: () => void }) {
  if (isLoading) {
    return (
      <div className="space-y-2" aria-label="Đang tải">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    )
  }
  if (!error) return null
  const { title, detail } = describeError(error)
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">
      <p className="font-medium text-destructive">{title}</p>
      {detail && <p className="mt-1 text-muted-foreground">{detail}</p>}
      {onRetry && <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Thử lại</Button>}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>
}
