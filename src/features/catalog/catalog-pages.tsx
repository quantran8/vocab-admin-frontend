import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { toOptions } from '@/lib/form-utils'
import { EmptyState, PageHeader, Pagination, QueryState, StatusBadge } from '@/components/common'
import { ConfirmAction } from '@/components/confirm-action'
import { DataTable, type Column } from '@/components/data-table'
import { FormDialog } from '@/components/form-dialog'
import { MeaningPicker } from '@/components/meaning-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { statusLabel } from '@/lib/labels'
import { useApiMutation } from '@/lib/query'
import type { Page } from '@/lib/types'
import { useMeta } from '@/lib/use-meta'

const LIMIT = 50
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const slugMessage = 'Chỉ dùng chữ thường, số và dấu gạch ngang'

const entrySchema = z.object({
  slug: z.string().regex(SLUG, slugMessage),
  title: z.string().trim().min(1, 'Nhập tiêu đề'),
  status: z.string(),
})
type Entry = z.infer<typeof entrySchema>
const localeSchema = z.object({ locale: z.string({ error: 'Chọn locale' }).min(1, 'Chọn locale'), title: z.string().trim().min(1, 'Nhập tiêu đề'), description: z.string() })
type LocaleValues = z.infer<typeof localeSchema>

interface Localization {
  locale: string
  title: string
  description: string | null
}
interface CollectionRow {
  id: string
  slug: string
  title: string
  status: string
  topicCount: number
  locales: string[]
}
interface TopicRow {
  id: string
  slug: string
  title: string
  status: string
  meaningCount: number
  locales: string[]
}
interface CollectionDetail {
  id: string
  slug: string
  title: string
  status: string
  localizations: Localization[]
  topics: TopicRow[]
}
interface TopicDetail {
  id: string
  collectionId: string
  slug: string
  title: string
  status: string
  localizations: Localization[]
}
interface TopicMeaning {
  meaningId: string
  rank: number
  wordId: string
  lemma: string
  partOfSpeech: string
  cefrLevel: string | null
  meaningText: string | null
  liveLocales: string[]
}

function useEntryFields() {
  const meta = useMeta()
  return [
    { name: 'title', label: 'Tiêu đề' },
    { name: 'slug', label: 'Slug', hint: slugMessage },
    { name: 'status', label: 'Trạng thái', type: 'select' as const, options: toOptions(meta.contentStatuses, statusLabel) },
  ]
}

function LocalizationsCard({ basePath, localizations, invalidate }: { basePath: string; localizations: Localization[]; invalidate: readonly (readonly unknown[])[] }) {
  const meta = useMeta()
  const save = useApiMutation<LocaleValues>({
    mutationFn: ({ locale, title, description }) => api(`${basePath}/locales/${locale}`, { method: 'PUT', body: { title, description: description.trim() || null } }),
    invalidate: [...invalidate],
    success: 'Đã lưu bản dịch',
    silent: true,
  })
  const remove = useApiMutation<string>({
    mutationFn: (locale) => api(`${basePath}/locales/${locale}`, { method: 'DELETE' }),
    invalidate: [...invalidate],
    success: 'Đã xoá bản dịch',
  })
  const fields = (locales: string[]) => [
    { name: 'locale', label: 'Locale', type: 'select' as const, options: toOptions(locales) },
    { name: 'title', label: 'Tiêu đề' },
    { name: 'description', label: 'Mô tả', type: 'textarea' as const },
  ]
  const missing = meta.locales.filter((locale) => !localizations.some((l) => l.locale === locale))
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Bản dịch</CardTitle>
        {missing.length > 0 && (
          <FormDialog
            trigger={<Button variant="outline" size="sm" />}
            triggerLabel={<><Plus /> Thêm bản dịch</>}
            title="Thêm bản dịch"
            schema={localeSchema}
            fields={fields(missing)}
            defaultValues={{ locale: missing[0], title: '', description: '' }}
            onSubmit={(values) => save.mutateAsync(values)}
          />
        )}
      </CardHeader>
      <CardContent className="grid gap-2">
        {localizations.length === 0 && <EmptyState>Chưa có bản dịch. Người học cần bản dịch để thấy tiêu đề theo ngôn ngữ của họ.</EmptyState>}
        {localizations.map((l) => (
          <div key={l.locale} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
            <span className="min-w-0 break-words"><span className="font-medium">{l.locale}</span>: {l.title}{l.description && <span className="block text-muted-foreground">{l.description}</span>}</span>
            <div className="flex gap-1">
              <FormDialog
                trigger={<Button variant="ghost" size="icon" aria-label={`Sửa bản dịch ${l.locale}`} />}
                triggerLabel={<Pencil />}
                title={`Sửa bản dịch ${l.locale}`}
                schema={localeSchema}
                fields={fields([l.locale])}
                defaultValues={{ locale: l.locale, title: l.title, description: l.description ?? '' }}
                onSubmit={(values) => save.mutateAsync(values)}
              />
              <ConfirmAction variant="ghost" size="icon" ariaLabel={`Xoá bản dịch ${l.locale}`} label={<Trash2 />} title={`Xoá bản dịch ${l.locale}?`} description="Bản dịch này sẽ bị xoá." confirmLabel="Xoá" onConfirm={() => remove.mutate(l.locale)} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function CatalogPage() {
  const fields = useEntryFields()
  const [offset, setOffset] = useState(0)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['collections', offset],
    queryFn: () => api<Page<CollectionRow>>('/admin/collections', { query: { limit: LIMIT, offset } }),
  })
  const create = useApiMutation<Entry>({
    mutationFn: (body) => api('/admin/collections', { method: 'POST', body }),
    invalidate: [['collections']],
    success: 'Đã tạo collection',
    silent: true,
  })
  const columns = useMemo<Column<CollectionRow>[]>(() => [
    { id: 'title', header: 'Collection', cell: (c) => <Link className="font-medium underline-offset-4 hover:underline" to={`/catalog/collections/${c.id}`}>{c.title}</Link> },
    { id: 'slug', header: 'Slug', cell: (c) => c.slug },
    { id: 'status', header: 'Trạng thái', cell: (c) => <StatusBadge status={c.status} /> },
    { id: 'topics', header: 'Topic', cell: (c) => c.topicCount },
    { id: 'locales', header: 'Bản dịch', cell: (c) => <div className="flex flex-wrap gap-1">{c.locales.map((l) => <Badge key={l} variant="outline">{l}</Badge>)}</div> },
  ], [])
  return (
    <>
      <PageHeader
        title="Catalog"
        description="Collection và topic mà người học nhìn thấy. Collection cá nhân của người học không xuất hiện ở đây."
        actions={
          <FormDialog
            trigger={<Button />}
            triggerLabel={<><Plus /> Tạo collection</>}
            title="Tạo collection"
            schema={entrySchema}
            fields={fields}
            defaultValues={{ slug: '', title: '', status: 'draft' }}
            onSubmit={(values) => create.mutateAsync(values)}
          />
        }
      />
      <QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} />
      {data && (
        <>
          <DataTable columns={columns} rows={data.items} rowKey={(c) => c.id} empty="Chưa có collection nào." />
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </>
      )}
    </>
  )
}

export function CollectionPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const fields = useEntryFields()
  const key = ['collection', id] as const
  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => api<CollectionDetail>(`/admin/collections/${id}`) })
  const invalidate = [key, ['collections']]
  const patch = useApiMutation<Entry>({ mutationFn: (body) => api(`/admin/collections/${id}`, { method: 'PATCH', body }), invalidate, success: 'Đã lưu collection', silent: true })
  const remove = useApiMutation({
    mutationFn: () => api(`/admin/collections/${id}`, { method: 'DELETE' }),
    invalidate: [['collections']],
    success: 'Đã xoá collection',
    onSuccess: () => navigate('/catalog'),
  })
  const createTopic = useApiMutation<Entry>({ mutationFn: (body) => api(`/admin/collections/${id}/topics`, { method: 'POST', body }), invalidate, success: 'Đã tạo topic', silent: true })
  const columns = useMemo<Column<TopicRow>[]>(() => [
    { id: 'title', header: 'Topic', cell: (t) => <Link className="font-medium underline-offset-4 hover:underline" to={`/catalog/topics/${t.id}`}>{t.title}</Link> },
    { id: 'slug', header: 'Slug', cell: (t) => t.slug },
    { id: 'status', header: 'Trạng thái', cell: (t) => <StatusBadge status={t.status} /> },
    { id: 'meanings', header: 'Nghĩa', cell: (t) => t.meaningCount },
    { id: 'locales', header: 'Bản dịch', cell: (t) => <div className="flex flex-wrap gap-1">{t.locales.map((l) => <Badge key={l} variant="outline">{l}</Badge>)}</div> },
  ], [])
  if (!data) return <QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} />
  return (
    <>
      <PageHeader
        title={data.title}
        description={<span className="inline-flex items-center gap-2">{data.slug} <StatusBadge status={data.status} /></span>}
        back="/catalog"
        actions={
          <>
            <FormDialog
              trigger={<Button variant="outline" size="sm" />}
              triggerLabel={<><Pencil /> Sửa</>}
              title="Sửa collection"
              schema={entrySchema}
              fields={fields}
              defaultValues={{ slug: data.slug, title: data.title, status: data.status }}
              onSubmit={(values) => patch.mutateAsync(values)}
            />
            {data.status === 'draft' && (
              <ConfirmAction variant="destructive" label={<><Trash2 /> Xoá</>} title="Xoá collection?" description="Chỉ xoá được collection nháp không còn topic và không có người học đang dùng." confirmLabel="Xoá" onConfirm={() => remove.mutate()} />
            )}
          </>
        }
      />
      <div className="grid gap-6">
        <LocalizationsCard basePath={`/admin/collections/${id}`} localizations={data.localizations} invalidate={invalidate} />
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Topic</CardTitle>
            <FormDialog
              trigger={<Button variant="outline" size="sm" />}
              triggerLabel={<><Plus /> Tạo topic</>}
              title="Tạo topic"
              schema={entrySchema}
              fields={fields}
              defaultValues={{ slug: '', title: '', status: 'draft' }}
              onSubmit={(values) => createTopic.mutateAsync(values)}
            />
          </CardHeader>
          <CardContent><DataTable columns={columns} rows={data.topics} rowKey={(t) => t.id} empty="Chưa có topic nào." /></CardContent>
        </Card>
      </div>
    </>
  )
}

export function TopicPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const fields = useEntryFields()
  const key = ['topic', id] as const
  const meaningsKey = ['topic-meanings', id] as const
  const topic = useQuery({ queryKey: key, queryFn: () => api<TopicDetail>(`/admin/topics/${id}`) })
  const meanings = useQuery({ queryKey: meaningsKey, queryFn: () => api<{ items: TopicMeaning[] }>(`/admin/topics/${id}/meanings`) })
  const collectionKey = ['collection', topic.data?.collectionId]
  const invalidate = [key, collectionKey]
  const patch = useApiMutation<Entry>({ mutationFn: (body) => api(`/admin/topics/${id}`, { method: 'PATCH', body }), invalidate, success: 'Đã lưu topic', silent: true })
  const remove = useApiMutation({
    mutationFn: () => api(`/admin/topics/${id}`, { method: 'DELETE' }),
    invalidate: [collectionKey],
    success: 'Đã xoá topic',
    onSuccess: () => navigate(`/catalog/collections/${topic.data?.collectionId}`),
  })
  const meaningInvalidate = [meaningsKey, collectionKey]
  const add = useApiMutation<string>({
    mutationFn: (meaningId) => api(`/admin/topics/${id}/meanings`, { method: 'POST', body: { meaningIds: [meaningId] } }),
    invalidate: meaningInvalidate,
    success: 'Đã thêm nghĩa vào topic',
  })
  const removeMeaning = useApiMutation<string>({
    mutationFn: (meaningId) => api(`/admin/topics/${id}/meanings/${meaningId}`, { method: 'DELETE' }),
    invalidate: meaningInvalidate,
    success: 'Đã gỡ nghĩa khỏi topic',
  })
  const reorder = useApiMutation<string[]>({
    mutationFn: (meaningIds) => api(`/admin/topics/${id}/meanings/order`, { method: 'PUT', body: { meaningIds } }),
    invalidate: [meaningsKey],
  })
  const items = meanings.data?.items ?? []
  const move = (index: number, delta: number) => {
    const ids = items.map((m) => m.meaningId)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + delta, 0, moved)
    reorder.mutate(ids)
  }
  if (!topic.data) return <QueryState isLoading={topic.isLoading} error={topic.error} onRetry={() => void topic.refetch()} />
  const data = topic.data
  return (
    <>
      <PageHeader
        title={data.title}
        description={<span className="inline-flex items-center gap-2">{data.slug} <StatusBadge status={data.status} /></span>}
        back={`/catalog/collections/${data.collectionId}`}
        actions={
          <>
            <FormDialog
              trigger={<Button variant="outline" size="sm" />}
              triggerLabel={<><Pencil /> Sửa</>}
              title="Sửa topic"
              schema={entrySchema}
              fields={fields}
              defaultValues={{ slug: data.slug, title: data.title, status: data.status }}
              onSubmit={(values) => patch.mutateAsync(values)}
            />
            {data.status === 'draft' && (
              <ConfirmAction variant="destructive" label={<><Trash2 /> Xoá</>} title="Xoá topic?" description="Chỉ xoá được topic nháp mà người học chưa chọn. Danh sách nghĩa của topic cũng được gỡ." confirmLabel="Xoá" onConfirm={() => remove.mutate()} />
            )}
          </>
        }
      />
      <div className="grid gap-6">
        <LocalizationsCard basePath={`/admin/topics/${id}`} localizations={data.localizations} invalidate={invalidate} />
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Nghĩa trong topic</CardTitle>
            <MeaningPicker
              trigger={<Button variant="outline" size="sm" />}
              triggerLabel={<><Plus /> Thêm nghĩa</>}
              title="Thêm nghĩa vào topic"
              description="Chỉ hiện nghĩa dùng chung đang live ở locale mặc định."
              liveOnly
              excludeIds={items.map((m) => m.meaningId)}
              onPick={(meaning) => add.mutate(meaning.id)}
            />
          </CardHeader>
          <CardContent className="grid gap-2">
            <QueryState isLoading={meanings.isLoading} error={meanings.error} />
            {meanings.data && items.length === 0 && <EmptyState>Topic chưa có nghĩa nào.</EmptyState>}
            {items.map((m, index) => (
              <div key={m.meaningId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span className="min-w-0 break-words">
                  <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                  <Link className="font-medium underline-offset-4 hover:underline" to={`/words/${m.wordId}`}>{m.lemma}</Link>{' '}
                  <span className="text-muted-foreground">({m.partOfSpeech}{m.cefrLevel ? `, ${m.cefrLevel}` : ''}) {m.meaningText}</span>
                  {m.liveLocales.length === 0 && <Badge variant="destructive" className="ml-2">Không live</Badge>}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Chuyển ${m.lemma} lên`} disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)}><ArrowUp /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Chuyển ${m.lemma} xuống`} disabled={index === items.length - 1 || reorder.isPending} onClick={() => move(index, 1)}><ArrowDown /></Button>
                  <ConfirmAction variant="ghost" size="icon" ariaLabel={`Gỡ ${m.lemma}`} label={<Trash2 />} title={`Gỡ "${m.lemma}" khỏi topic?`} description="Nghĩa không bị xoá, chỉ gỡ khỏi topic này." confirmLabel="Gỡ" onConfirm={() => removeMeaning.mutate(m.meaningId)} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
