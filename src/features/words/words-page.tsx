import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, Pagination, QueryState } from '@/components/common'
import { DataTable, type Column } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/labels'
import type { Page } from '@/lib/types'
import { useDebounced } from '@/lib/use-debounced'
import type { WordRow } from './words-api'

const LIMIT = 50

export function WordsPage() {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const q = useDebounced(search.trim())
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['words', { q, offset }],
    queryFn: () => api<Page<WordRow>>('/admin/words', { query: { q, limit: LIMIT, offset } }),
  })
  const columns = useMemo<Column<WordRow>[]>(() => [
    {
      id: 'lemma',
      header: 'Từ',
      cell: (w) => (
        <Link className="font-medium underline-offset-4 hover:underline" to={`/words/${w.id}`}>
          {w.lemma}
          {w.homographKey && <span className="ml-1 font-normal text-muted-foreground">({w.homographKey})</span>}
        </Link>
      ),
    },
    { id: 'pos', header: 'Loại từ', cell: (w) => <div className="flex flex-wrap gap-1">{w.partsOfSpeech.map((p) => <Badge key={p} variant="outline">{p}</Badge>)}</div> },
    { id: 'meanings', header: 'Nghĩa dùng chung', cell: (w) => w.meaningCount },
    { id: 'live', header: 'Đang live', cell: (w) => w.liveMeaningCount },
    { id: 'private', header: 'Nghĩa riêng', cell: (w) => w.privateMeaningCount },
    { id: 'created', header: 'Tạo lúc', cell: (w) => formatDate(w.createdAt) },
  ], [])

  return (
    <>
      <PageHeader
        title="Từ vựng"
        description="Quản lý từ, loại từ, nghĩa và bản dịch dùng chung."
        actions={<Link to="/words/new" className={buttonVariants()}><Plus /> Thêm từ</Link>}
      />
      <Input
        className="mb-4 max-w-sm"
        placeholder="Tìm theo đầu từ…"
        aria-label="Tìm từ"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
          setOffset(0)
        }}
      />
      <QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} />
      {data && (
        <>
          <DataTable columns={columns} rows={data.items} rowKey={(w) => w.id} empty="Không tìm thấy từ nào." />
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </>
      )}
    </>
  )
}
