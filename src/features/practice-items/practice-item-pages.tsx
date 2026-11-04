import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppSelect } from '@/components/app-select'
import { formatJson, parseJsonObject, toOptions } from '@/lib/form-utils'
import { EmptyState, PageHeader, Pagination, QueryState, StatusBadge } from '@/components/common'
import { ConfirmAction } from '@/components/confirm-action'
import { DataTable, type Column } from '@/components/data-table'
import { JsonEditor } from '@/components/json-editor'
import { MeaningPicker } from '@/components/meaning-picker'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { describeError } from '@/lib/errors'
import { formatDate, statusLabel } from '@/lib/labels'
import { useApiMutation } from '@/lib/query'
import type { MeaningOption, Page } from '@/lib/types'
import { useMeta } from '@/lib/use-meta'
import { SAMPLES } from './samples'

const LIMIT = 50

interface Target {
  ordinal?: number
  meaningId: string | null
  pronunciationId: string | null
  lemma: string | null
}
interface ItemRow {
  id: string
  template: string
  variant: string | null
  status: string
  contextCefrLevel: string | null
  supersedesItemId: string | null
  createdAt: string
  targets: Target[]
  locales: { locale: string; editorialState: string }[]
}
interface ItemLocalization {
  locale: string
  localizedContent: Record<string, unknown>
  contextualExplain: string | null
  editorialState: string
}
interface ItemDetail extends Omit<ItemRow, 'locales'> {
  sourceContent: Record<string, unknown>
  sourceEvaluation: Record<string, unknown>
  localizations: ItemLocalization[]
  supersededByItemId: string | null
}

export function ItemsPage() {
  const meta = useMeta()
  const [template, setTemplate] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['practice-items', { template, status, offset }],
    queryFn: () => api<Page<ItemRow>>('/admin/practice-items', { query: { template, status, limit: LIMIT, offset } }),
  })
  const columns = useMemo<Column<ItemRow>[]>(() => [
    { id: 'template', header: 'Dạng bài', cell: (i) => <Link className="font-medium underline-offset-4 hover:underline" to={`/practice-items/${i.id}`}>{i.template} / {i.variant}</Link> },
    { id: 'status', header: 'Trạng thái', cell: (i) => <StatusBadge status={i.status} /> },
    { id: 'targets', header: 'Target', cell: (i) => i.targets.map((t) => t.lemma).join(', ') },
    { id: 'locales', header: 'Locale', cell: (i) => <div className="flex flex-wrap gap-1">{i.locales.map((l) => <Badge key={l.locale} variant={l.editorialState === 'approved' ? 'secondary' : 'outline'}>{l.locale}</Badge>)}</div> },
    { id: 'created', header: 'Tạo lúc', cell: (i) => formatDate(i.createdAt) },
  ], [])
  const change = (setter: (value: string | null) => void) => (value: string | null) => {
    setter(value)
    setOffset(0)
  }
  return (
    <>
      <PageHeader title="Bài luyện" description="Bài đã publish không sửa được. Hãy tạo bản thay thế để cập nhật nội dung." actions={<Link to="/practice-items/new" className={buttonVariants()}><Plus /> Tạo bài luyện</Link>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <AppSelect className="w-48" options={toOptions(Object.keys(meta.templateVariants))} value={template} onChange={change(setTemplate)} clearLabel="Mọi dạng bài" />
        <AppSelect className="w-48" options={toOptions(meta.itemStatuses, statusLabel)} value={status} onChange={change(setStatus)} clearLabel="Mọi trạng thái" />
      </div>
      <QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} />
      {data && (
        <>
          <DataTable columns={columns} rows={data.items} rowKey={(i) => i.id} empty="Không có bài luyện nào." />
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </>
      )}
    </>
  )
}

interface ItemFormValues {
  template: string | null
  variant: string | null
  contextCefrLevel: string | null
  sourceContent: string
  sourceEvaluation: string
  targets: Target[]
}

function targetLabel(target: Target) {
  const kinds = [target.meaningId && 'nghĩa', target.pronunciationId && 'phát âm'].filter(Boolean).join(' + ')
  return `${target.lemma ?? 'Không rõ'} (${kinds})`
}

function ItemForm({ initial, submitLabel, onSubmit, editableKind = true }: { initial: ItemFormValues; submitLabel: string; onSubmit: (body: Record<string, unknown>) => Promise<unknown>; editableKind?: boolean }) {
  const meta = useMeta()
  const [values, setValues] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) => setValues((all) => ({ ...all, [key]: value }))
  const variants = values.template ? meta.templateVariants[values.template] ?? [] : []

  const chooseTemplate = (template: string | null) => {
    const sample = template ? SAMPLES[template] : undefined
    setValues((all) => ({
      ...all,
      template,
      variant: null,
      sourceContent: sample ? formatJson(sample.content) : all.sourceContent,
      sourceEvaluation: sample ? formatJson(sample.evaluation) : all.sourceEvaluation,
    }))
  }
  const addTarget = (meaning: MeaningOption, withPronunciation: boolean) => {
    const pronunciation = meaning.pronunciations[0]
    if (withPronunciation && !pronunciation) return setError(`"${meaning.lemma}" chưa có phát âm.`)
    setError(null)
    set('targets', [...values.targets, {
      meaningId: withPronunciation ? null : meaning.id,
      pronunciationId: withPronunciation ? pronunciation?.id ?? null : null,
      lemma: meaning.lemma,
    }])
  }
  const submit = async () => {
    const sourceContent = parseJsonObject(values.sourceContent)
    const sourceEvaluation = parseJsonObject(values.sourceEvaluation)
    if (!values.template || !values.variant) return setError('Chọn dạng bài và biến thể.')
    if (!sourceContent || !sourceEvaluation) return setError('sourceContent và sourceEvaluation phải là JSON object hợp lệ.')
    if (values.targets.length === 0) return setError('Cần ít nhất một target.')
    setError(null)
    setSaving(true)
    try {
      await onSubmit({
        template: values.template,
        variant: values.variant,
        sourceContent,
        sourceEvaluation,
        contextCefrLevel: values.contextCefrLevel,
        targets: values.targets.map(({ meaningId, pronunciationId }) => ({ ...(meaningId && { meaningId }), ...(pronunciationId && { pronunciationId }) })),
      })
    } catch (failure) {
      const { title, detail } = describeError(failure)
      setError(detail ? `${title} ${detail}` : title)
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label>Dạng bài</Label>
          <AppSelect options={toOptions(Object.keys(meta.templateVariants))} value={values.template} onChange={chooseTemplate} placeholder="Chọn" disabled={!editableKind} />
        </div>
        <div className="grid gap-1.5">
          <Label>Biến thể</Label>
          <AppSelect options={toOptions(variants)} value={values.variant} onChange={(v) => set('variant', v)} placeholder="Chọn" disabled={!editableKind || !values.template} />
        </div>
        <div className="grid gap-1.5">
          <Label>CEFR ngữ cảnh</Label>
          <AppSelect options={toOptions(meta.cefrLevels)} value={values.contextCefrLevel} onChange={(v) => set('contextCefrLevel', v)} clearLabel="Không đặt" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Target</Label>
        {values.targets.length === 0 && <EmptyState>Chưa có target.</EmptyState>}
        {values.targets.map((target, index) => (
          <div key={`${target.meaningId}-${target.pronunciationId}-${index}`} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
            <span>{targetLabel(target)}</span>
            <Button type="button" variant="ghost" size="icon" aria-label="Gỡ target" onClick={() => set('targets', values.targets.filter((_, i) => i !== index))}><Trash2 /></Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <MeaningPicker
            trigger={<Button type="button" variant="outline" size="sm" />}
            triggerLabel={<><Plus /> Thêm target nghĩa</>}
            title="Chọn nghĩa"
            description="Chỉ hiện nghĩa dùng chung."
            onPick={(meaning) => addTarget(meaning, false)}
          />
          <MeaningPicker
            trigger={<Button type="button" variant="outline" size="sm" />}
            triggerLabel={<><Plus /> Thêm target phát âm</>}
            title="Chọn từ để lấy phát âm"
            description="Dùng phát âm đầu tiên của loại từ đã chọn."
            onPick={(meaning) => addTarget(meaning, true)}
          />
        </div>
      </div>
      <JsonEditor label="sourceContent" value={values.sourceContent} onChange={(v) => set('sourceContent', v)} rows={12} />
      <JsonEditor label="sourceEvaluation" value={values.sourceEvaluation} onChange={(v) => set('sourceEvaluation', v)} rows={6} />
      <p className="text-xs text-muted-foreground">Khi chọn dạng bài, nội dung mẫu sẽ được điền sẵn. Publish dùng nội dung đã lưu, nên hãy lưu trước. Khi publish, backend kiểm tra bài có phục vụ được cho người học hay không.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div><Button disabled={saving} onClick={() => void submit()}>{submitLabel}</Button></div>
    </div>
  )
}

export function ItemNewPage() {
  const navigate = useNavigate()
  const client = useQueryClient()
  const { state } = useLocation() as { state: { source?: ItemDetail } | null }
  const source = state?.source
  const initial: ItemFormValues = source
    ? {
        template: source.template, variant: source.variant, contextCefrLevel: source.contextCefrLevel,
        sourceContent: formatJson(source.sourceContent), sourceEvaluation: formatJson(source.sourceEvaluation), targets: source.targets,
      }
    : { template: null, variant: null, contextCefrLevel: null, sourceContent: '{}', sourceEvaluation: '{}', targets: [] }
  return (
    <>
      <PageHeader title={source ? 'Tạo bản thay thế' : 'Tạo bài luyện'} description={source ? 'Khi publish, bản này sẽ thay thế và retire bản cũ.' : undefined} back="/practice-items" />
      <Card>
        <CardContent>
          <ItemForm
            initial={initial}
            submitLabel="Tạo bản nháp"
            onSubmit={async ({ contextCefrLevel, ...body }) => {
              const { id } = await api<{ id: string }>('/admin/practice-items', {
                method: 'POST',
                body: { ...body, ...(contextCefrLevel ? { contextCefrLevel } : {}), ...(source && { supersedesItemId: source.id }) },
              })
              await client.invalidateQueries({ queryKey: ['practice-items'] })
              navigate(`/practice-items/${id}`)
            }}
          />
        </CardContent>
      </Card>
    </>
  )
}

function ItemLocaleEditor({ itemId, locale, current, itemKey, readOnlyContent }: { itemId: string; locale: string; current?: ItemLocalization; itemKey: readonly unknown[]; readOnlyContent: boolean }) {
  const meta = useMeta()
  const [content, setContent] = useState(() => formatJson(current?.localizedContent ?? {}))
  const [explain, setExplain] = useState(current?.contextualExplain ?? '')
  const [state, setState] = useState(current?.editorialState ?? 'draft')
  const parsed = parseJsonObject(content)
  const save = useApiMutation({
    mutationFn: () => api(`/admin/practice-items/${itemId}/locales/${locale}`, {
      method: 'PUT',
      body: { localizedContent: parsed, editorialState: state, ...(explain.trim() && { contextualExplain: explain.trim() }) },
    }),
    invalidate: [itemKey, ['practice-items']],
    success: 'Đã lưu locale',
  })
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">{current ? <StatusBadge status={current.editorialState} /> : <span className="text-sm text-muted-foreground">Chưa có nội dung cho locale này</span>}</div>
      <JsonEditor label="localizedContent" value={content} onChange={setContent} rows={6} />
      <div className="grid gap-1.5">
        <Label htmlFor={`explain-${locale}`}>Giải thích theo ngữ cảnh</Label>
        <Textarea id={`explain-${locale}`} rows={2} value={explain} onChange={(event) => setExplain(event.target.value)} />
      </div>
      <div className="grid max-w-xs gap-1.5">
        <Label>Trạng thái biên tập</Label>
        <AppSelect options={toOptions(meta.editorialStates, statusLabel)} value={state} onChange={(v) => setState(v ?? 'draft')} />
      </div>
      {readOnlyContent && <p className="text-xs text-muted-foreground">Bài đã publish: thay đổi locale có hiệu lực với các phiên mới.</p>}
      <div><Button size="sm" disabled={!parsed || save.isPending} onClick={() => save.mutate()}>Lưu locale</Button></div>
    </div>
  )
}

export function ItemDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const meta = useMeta()
  const key = ['practice-item', id] as const
  const { data: item, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => api<ItemDetail>(`/admin/practice-items/${id}`) })
  const invalidate = [key, ['practice-items']]
  const publish = useApiMutation({ mutationFn: () => api(`/admin/practice-items/${id}/publish`, { method: 'POST' }), invalidate, success: 'Đã publish' })
  const retire = useApiMutation({ mutationFn: () => api(`/admin/practice-items/${id}/retire`, { method: 'POST' }), invalidate, success: 'Đã retire' })
  const remove = useApiMutation({
    mutationFn: () => api(`/admin/practice-items/${id}`, { method: 'DELETE' }),
    invalidate: [['practice-items']],
    success: 'Đã xoá bài luyện',
    onSuccess: () => navigate('/practice-items'),
  })
  const patch = useApiMutation<Record<string, unknown>>({
    mutationFn: (body) => api(`/admin/practice-items/${id}`, { method: 'PATCH', body }),
    invalidate,
    success: 'Đã lưu bản nháp',
    silent: true,
  })
  if (!item) return <QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} />
  const isDraft = item.status === 'draft'
  const isPublished = item.status === 'published'
  return (
    <>
      <PageHeader
        title={`${item.template} / ${item.variant}`}
        description={<span className="inline-flex items-center gap-2"><StatusBadge status={item.status} /> Tạo lúc {formatDate(item.createdAt)}</span>}
        back="/practice-items"
        actions={
          <>
            {isDraft && <Button size="sm" disabled={publish.isPending} onClick={() => publish.mutate()}>Publish</Button>}
            {!isDraft && <Link to="/practice-items/new" state={{ source: item }} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Tạo bản thay thế</Link>}
            {isPublished && <ConfirmAction label="Retire" title="Retire bài luyện?" description="Bài sẽ không được dùng cho phiên học mới và không thể publish lại." confirmLabel="Retire" onConfirm={() => retire.mutate()} />}
            {isDraft && <ConfirmAction variant="destructive" label={<><Trash2 /> Xoá</>} title="Xoá bài luyện?" description="Bản nháp và các locale của nó sẽ bị xoá." confirmLabel="Xoá" onConfirm={() => remove.mutate()} />}
          </>
        }
      />
      {item.supersedesItemId && <p className="mb-4 text-sm text-muted-foreground">Thay thế cho <Link className="underline underline-offset-4" to={`/practice-items/${item.supersedesItemId}`}>bản trước</Link>.</p>}
      {item.supersededByItemId && <p className="mb-4 text-sm text-muted-foreground">Đã có <Link className="underline underline-offset-4" to={`/practice-items/${item.supersededByItemId}`}>bản thay thế</Link>.</p>}
      <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle>Nội dung</CardTitle></CardHeader>
          <CardContent>
            {isDraft ? (
              <ItemForm
                key={item.id}
                initial={{
                  template: item.template, variant: item.variant, contextCefrLevel: item.contextCefrLevel,
                  sourceContent: formatJson(item.sourceContent), sourceEvaluation: formatJson(item.sourceEvaluation), targets: item.targets,
                }}
                editableKind={false}
                submitLabel="Lưu bản nháp"
                onSubmit={(body) => patch.mutateAsync(body)}
              />
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label>Target</Label>
                  <ul className="list-inside list-disc text-sm">{item.targets.map((t) => <li key={t.ordinal}>{targetLabel(t)}</li>)}</ul>
                </div>
                <JsonEditor label="sourceContent" value={formatJson(item.sourceContent)} readOnly rows={12} />
                <JsonEditor label="sourceEvaluation" value={formatJson(item.sourceEvaluation)} readOnly rows={6} />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Locale</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue={meta.locales[0] ?? 'vi-VN'}>
              <TabsList>{meta.locales.map((locale) => <TabsTrigger key={locale} value={locale}>{locale}</TabsTrigger>)}</TabsList>
              {meta.locales.map((locale) => (
                <TabsContent key={locale} value={locale} className="pt-3">
                  <ItemLocaleEditor
                    key={JSON.stringify(item.localizations.find((l) => l.locale === locale) ?? null)}
                    itemId={id}
                    locale={locale}
                    current={item.localizations.find((l) => l.locale === locale)}
                    itemKey={key}
                    readOnlyContent={!isDraft}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
