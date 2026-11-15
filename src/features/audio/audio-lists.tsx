import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AudioLines, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Pagination, QueryState } from '@/components/common'
import { DataTable, type Column } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/labels'
import { toastError, useApiMutation } from '@/lib/query'
import type { Page } from '@/lib/types'
import { useDebounced } from '@/lib/use-debounced'
import { AUDIO_KEY, generateAudio, refreshPublications, type MissingAudio, type PublicationKey, type StalePublication } from './audio-api'

const LIMIT = 50

const wordLink = (row: { wordId: string; lemma: string }) => (
  <Link className="font-medium underline-offset-4 hover:underline" to={`/words/${row.wordId}`}>{row.lemma}</Link>
)

export function MissingAudioList() {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const q = useDebounced(search.trim())
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...AUDIO_KEY, 'missing', { q, offset }],
    queryFn: () => api<Page<MissingAudio>>('/admin/audio/missing', { query: { q, limit: LIMIT, offset } }),
  })
  const voice = useApiMutation<string, Awaited<ReturnType<typeof generateAudio>>>({
    mutationFn: (pronunciationId) => generateAudio({ pronunciationIds: [pronunciationId] }),
    invalidate: [AUDIO_KEY, ['word']],
    onSuccess: ({ generated, failed }) => {
      if (generated.length > 0) toast.success(`Đã tạo audio cho "${generated[0].lemma}"`)
      if (failed.length > 0) toast.error(`Không tạo được audio cho "${failed[0].lemma}"`, { description: failed[0].message })
    },
  })
  const columns = useMemo<Column<MissingAudio>[]>(() => [
    {
      id: 'lemma',
      header: 'Từ',
      cell: (m) => <>{wordLink(m)}{m.homographKey && <span className="ml-1 text-muted-foreground">({m.homographKey})</span>}</>,
    },
    { id: 'pos', header: 'Loại từ', cell: (m) => <Badge variant="outline">{m.partOfSpeech}</Badge> },
    { id: 'ipa', header: 'IPA', cell: (m) => m.ipa ?? '—' },
    { id: 'live', header: 'Đang live', cell: (m) => (m.live ? <Badge>Đang live</Badge> : null) },
    {
      id: 'action',
      header: '',
      cell: (m) => (
        <Button variant="ghost" size="sm" disabled={voice.isPending} onClick={() => voice.mutate(m.pronunciationId)}>
          <AudioLines /> Tạo
        </Button>
      ),
    },
  ], [voice])

  return (
    <div className="grid gap-3">
      <Input
        className="max-w-sm"
        placeholder="Tìm theo đầu từ…"
        aria-label="Tìm từ thiếu audio"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
          setOffset(0)
        }}
      />
      <QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} />
      {data && (
        <>
          <DataTable columns={columns} rows={data.items} rowKey={(m) => m.pronunciationId} empty="Mọi phát âm đều đã có audio." />
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </>
      )}
    </div>
  )
}

export function StalePublicationsList() {
  const client = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [running, setRunning] = useState(false)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...AUDIO_KEY, 'stale', { offset }],
    queryFn: () => api<Page<StalePublication>>('/admin/audio/stale-publications', { query: { limit: LIMIT, offset } }),
  })
  const refreshOne = useApiMutation<PublicationKey>({
    mutationFn: (key) => refreshPublications([key]),
    invalidate: [AUDIO_KEY, ['word']],
    success: 'Đã publish lại audio',
  })

  async function refreshAll() {
    setRunning(true)
    let total = 0
    try {
      for (;;) {
        const { refreshed, remaining } = await refreshPublications()
        total += refreshed.length
        if (remaining === 0 || refreshed.length === 0) break
      }
      toast.success(`Đã publish lại ${total} nghĩa`)
    } catch (err) {
      toastError(err)
    } finally {
      setRunning(false)
      setOffset(0)
      void client.invalidateQueries({ queryKey: AUDIO_KEY })
      void client.invalidateQueries({ queryKey: ['word'] })
    }
  }

  const columns = useMemo<Column<StalePublication>[]>(() => [
    { id: 'lemma', header: 'Từ', cell: wordLink },
    { id: 'pos', header: 'Loại từ', cell: (s) => <Badge variant="outline">{s.partOfSpeech}</Badge> },
    { id: 'meaning', header: 'Nghĩa', cell: (s) => s.meaningText },
    { id: 'locale', header: 'Locale', cell: (s) => s.locale },
    { id: 'revision', header: 'Bản live', cell: (s) => `rev ${s.revision} · ${formatDate(s.publishedAt)}` },
    {
      id: 'action',
      header: '',
      cell: (s) => (
        <Button variant="ghost" size="sm" disabled={running || refreshOne.isPending} onClick={() => refreshOne.mutate({ meaningId: s.meaningId, locale: s.locale })}>
          <Send /> Publish lại
        </Button>
      ),
    },
  ], [running, refreshOne])

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Bản live của các nghĩa này vẫn phát audio cũ hoặc chưa có audio. Publish lại chỉ cập nhật audio; các chỉnh sửa khác chưa publish vẫn giữ nguyên.
        </p>
        <Button disabled={running || !data?.total} onClick={() => void refreshAll()}>
          <Send /> {running ? 'Đang publish lại…' : 'Publish lại tất cả'}
        </Button>
      </div>
      <QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} />
      {data && (
        <>
          <DataTable columns={columns} rows={data.items} rowKey={(s) => `${s.meaningId}:${s.locale}`} empty="Mọi nghĩa đang live đều đã có audio mới nhất." />
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </>
      )}
    </div>
  )
}
