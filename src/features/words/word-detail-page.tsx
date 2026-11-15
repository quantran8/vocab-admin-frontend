import { AudioLines, History, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { toOptions } from '@/lib/form-utils'
import { EmptyState, PageHeader, QueryState, StatusBadge } from '@/components/common'
import { ConfirmAction } from '@/components/confirm-action'
import { FormDialog } from '@/components/form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/labels'
import { useApiMutation } from '@/lib/query'
import { useMeta } from '@/lib/use-meta'
import { AUDIO_KEY, generateAudio, playAudio, refreshPublications, type GenerateBody, type GenerateResult, type PublicationKey } from '../audio/audio-api'
import { MeaningLocaleEditor } from './meaning-locale-editor'
import { highlightedText, locateTarget, type ExampleDetail, type MeaningDetail, type PublicationRevision, type TypeDetail, type WordDetail } from './words-api'

const emptyToNull = (text: string) => text.trim() || null

const wordSchema = z.object({ lemma: z.string().trim().min(1, 'Nhập từ'), homographKey: z.string() })
const pronunciationSchema = z.object({ accentLocale: z.string().trim().min(2, 'Nhập accent'), ipa: z.string(), audioAssetKey: z.string() })
const meaningSchema = z.object({ cefrLevel: z.string().nullable(), coreDefinition: z.string() })
const newMeaningSchema = meaningSchema.extend({ ipa: z.string() })
const typeSchema = z.object({ partOfSpeech: z.string({ error: 'Chọn loại từ' }).min(1, 'Chọn loại từ') })
const exampleSchema = z.object({ sourceText: z.string().trim().min(1, 'Nhập câu ví dụ'), target: z.string().trim().min(1, 'Nhập từ cần tô sáng') })
  .refine((e) => locateTarget(e.sourceText, e.target) !== null, { path: ['target'], message: 'Không tìm thấy trong câu ví dụ' })
const EXAMPLE_FIELDS = [{ name: 'sourceText', label: 'Câu ví dụ', type: 'textarea' as const }, { name: 'target', label: 'Từ tô sáng', hint: 'Phải xuất hiện trong câu.' }]
const PRONUNCIATION_FIELDS = [{ name: 'accentLocale', label: 'Accent' }, { name: 'ipa', label: 'IPA' }, { name: 'audioAssetKey', label: 'URL âm thanh' }]

const livePublications = (meanings: MeaningDetail[]): PublicationKey[] =>
  meanings.flatMap((m) => m.publications.filter((p) => !p.recalledAt).map((p) => ({ meaningId: m.id, locale: p.locale })))

/** Live snapshots keep their old audio, so offer to republish just the audio right away. */
function useGenerateAudio(wordKey: readonly unknown[], live: PublicationKey[]) {
  const republish = useApiMutation({
    mutationFn: () => refreshPublications(live),
    invalidate: [wordKey, AUDIO_KEY],
    success: 'Đã publish lại audio cho các nghĩa đang live',
  })
  return useApiMutation<GenerateBody, GenerateResult>({
    mutationFn: generateAudio,
    invalidate: [wordKey, AUDIO_KEY],
    onSuccess: ({ generated, failed }) => {
      if (generated.length === 0 && failed.length === 0) return void toast.info('Không có phát âm nào cần tạo audio.')
      if (generated.length > 0) {
        toast.success(`Đã tạo ${generated.length} audio`, live.length > 0
          ? { description: 'Bản live vẫn phát audio cũ cho tới khi publish lại.', action: { label: 'Publish lại audio', onClick: () => republish.mutate() }, duration: 10_000 }
          : undefined)
      }
      if (failed.length > 0) toast.error(`${failed.length} audio bị lỗi`, { description: failed[0].message })
    },
  })
}

function PublicationHistory({ meaningId }: { meaningId: string }) {
  const [open, setOpen] = useState(false)
  const { data, isLoading, error } = useQuery({
    queryKey: ['publications', meaningId],
    queryFn: () => api<{ items: PublicationRevision[] }>(`/admin/meanings/${meaningId}/publications`),
    enabled: open,
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}><History /> Lịch sử publish</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Lịch sử publish</DialogTitle></DialogHeader>
        <QueryState isLoading={isLoading} error={error} />
        {data?.items.length === 0 && <EmptyState>Nghĩa này chưa từng được publish.</EmptyState>}
        <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
          {data?.items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
              <span>{p.locale} · revision {p.revision} · {formatDate(p.publishedAt)}</span>
              {p.isCurrent && <StatusBadge status={p.recalledAt ? 'recalled' : 'live'} />}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

function ExamplesSection({ meaning, wordKey }: { meaning: MeaningDetail; wordKey: readonly unknown[] }) {
  const neverPublished = meaning.publications.length === 0
  const invalidate = [wordKey]
  const remove = useApiMutation<string>({ mutationFn: (id) => api(`/admin/examples/${id}`, { method: 'DELETE' }), invalidate, success: 'Đã xoá ví dụ' })
  const save = useApiMutation<{ example?: ExampleDetail; sourceText: string; target: string }>({
    mutationFn: ({ example, sourceText, target }) => {
      const body = { sourceText, targetLocator: locateTarget(sourceText, target) }
      return example
        ? api(`/admin/examples/${example.id}`, { method: 'PATCH', body })
        : api(`/admin/meanings/${meaning.id}/examples`, { method: 'POST', body })
    },
    invalidate,
    success: 'Đã lưu ví dụ',
    silent: true,
  })
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Ví dụ</p>
        <FormDialog
          trigger={<Button variant="outline" size="sm" />}
          triggerLabel={<><Plus /> Thêm ví dụ</>}
          title="Thêm ví dụ"
          schema={exampleSchema}
          fields={EXAMPLE_FIELDS}
          defaultValues={{ sourceText: '', target: '' }}
          onSubmit={(values) => save.mutateAsync(values)}
        />
      </div>
      {meaning.examples.length === 0 && <EmptyState>Chưa có ví dụ. Cần ít nhất một ví dụ để publish.</EmptyState>}
      {meaning.examples.map((example) => (
        <div key={example.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
          <span className="min-w-0 break-words">{example.sourceText} <span className="text-xs text-muted-foreground">(tô sáng: {highlightedText(example) || 'chưa hợp lệ'})</span></span>
          <div className="flex gap-1">
            <FormDialog
              trigger={<Button variant="ghost" size="icon" aria-label="Sửa ví dụ" />}
              triggerLabel={<Pencil />}
              title="Sửa ví dụ"
              schema={exampleSchema}
              fields={EXAMPLE_FIELDS}
              defaultValues={{ sourceText: example.sourceText, target: highlightedText(example) }}
              onSubmit={(values) => save.mutateAsync({ ...values, example })}
            />
            {neverPublished && (
              <ConfirmAction
                variant="ghost"
                size="icon"
                ariaLabel="Xoá ví dụ"
                label={<Trash2 />}
                title="Xoá ví dụ?"
                description="Ví dụ và các bản dịch của nó sẽ bị xoá."
                confirmLabel="Xoá"
                onConfirm={() => remove.mutate(example.id)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/** IPA and audio belong to the meaning: senses of one spelling can sound different. */
function PronunciationsSection({ meaning, wordKey }: { meaning: MeaningDetail; wordKey: readonly unknown[] }) {
  const meta = useMeta()
  const invalidate = [wordKey, ['words']]
  const published = meaning.publications.length > 0
  const voice = useGenerateAudio(wordKey, livePublications([meaning]))
  const remove = useApiMutation<string>({ mutationFn: (id) => api(`/admin/pronunciations/${id}`, { method: 'DELETE' }), invalidate, success: 'Đã xoá phát âm' })
  const toBody = ({ accentLocale, ipa, audioAssetKey }: z.infer<typeof pronunciationSchema>) => ({ accentLocale, ipa: emptyToNull(ipa), audioAssetKey: emptyToNull(audioAssetKey) })
  const save = useApiMutation<{ id?: string; values: z.infer<typeof pronunciationSchema> }>({
    mutationFn: ({ id, values }) => {
      if (id) return api(`/admin/pronunciations/${id}`, { method: 'PATCH', body: toBody(values) })
      const { ipa, audioAssetKey } = toBody(values)
      return api(`/admin/meanings/${meaning.id}/pronunciations`, {
        method: 'POST',
        body: { accentLocale: values.accentLocale, ...(ipa && { ipa }), ...(audioAssetKey && { audioAssetKey }) },
      })
    },
    invalidate,
    success: 'Đã lưu phát âm',
    silent: true,
  })
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Phát âm</p>
        <FormDialog
          trigger={<Button variant="outline" size="sm" />}
          triggerLabel={<><Plus /> Thêm phát âm</>}
          title="Thêm phát âm"
          schema={pronunciationSchema}
          fields={PRONUNCIATION_FIELDS}
          defaultValues={{ accentLocale: meta.audioAccent ?? 'en-US', ipa: '', audioAssetKey: '' }}
          onSubmit={(values) => save.mutateAsync({ values })}
        />
      </div>
      {meaning.pronunciations.length === 0 && <EmptyState>Chưa có phát âm. Cần có IPA để publish và để tạo audio.</EmptyState>}
      {meaning.pronunciations.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
          <span>{p.accentLocale} · {p.ipa ?? <span className="text-destructive">Thiếu IPA</span>}{p.audioAssetKey && ' · có âm thanh'}</span>
          <div className="flex gap-1">
            {p.audioAssetKey && (
              <Button variant="ghost" size="icon" aria-label={`Nghe ${p.accentLocale}`} onClick={() => playAudio(p.audioAssetKey!)}><Play /></Button>
            )}
            {p.accentLocale === meta.audioAccent && p.ipa && (
              <ConfirmAction
                variant="ghost"
                size="icon"
                ariaLabel={p.audioAssetKey ? 'Tạo lại audio' : 'Tạo audio'}
                label={<AudioLines />}
                title={p.audioAssetKey ? 'Tạo lại audio?' : 'Tạo audio?'}
                description={`ElevenLabs đọc theo IPA ${p.ipa}. ${p.audioAssetKey ? 'Audio hiện tại sẽ bị thay. ' : ''}Việc này tốn credit.`}
                confirmLabel="Tạo"
                onConfirm={() => voice.mutate({ pronunciationIds: [p.id], overwrite: true })}
              />
            )}
            <FormDialog
              trigger={<Button variant="ghost" size="icon" aria-label="Sửa phát âm" />}
              triggerLabel={<Pencil />}
              title="Sửa phát âm"
              schema={pronunciationSchema}
              fields={PRONUNCIATION_FIELDS}
              defaultValues={{ accentLocale: p.accentLocale, ipa: p.ipa ?? '', audioAssetKey: p.audioAssetKey ?? '' }}
              onSubmit={(values) => save.mutateAsync({ id: p.id, values })}
            />
            {!published && (
              <ConfirmAction variant="ghost" size="icon" ariaLabel="Xoá phát âm" label={<Trash2 />} title="Xoá phát âm?" description="Phát âm này sẽ bị xoá." confirmLabel="Xoá" onConfirm={() => remove.mutate(p.id)} />
            )}
          </div>
        </div>
      ))}
    </section>
  )
}

function MeaningCard({ meaning, index, wordKey }: { meaning: MeaningDetail; index: number; wordKey: readonly unknown[] }) {
  const meta = useMeta()
  const invalidate = [wordKey, ['words']]
  const patch = useApiMutation<z.infer<typeof meaningSchema>>({
    mutationFn: ({ cefrLevel, coreDefinition }) => api(`/admin/meanings/${meaning.id}`, { method: 'PATCH', body: { cefrLevel, coreDefinition: emptyToNull(coreDefinition) } }),
    invalidate,
    success: 'Đã lưu nghĩa',
    silent: true,
  })
  const remove = useApiMutation({ mutationFn: () => api(`/admin/meanings/${meaning.id}`, { method: 'DELETE' }), invalidate, success: 'Đã xoá nghĩa' })
  return (
    <div className="grid gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">Nghĩa {index + 1}</p>
          {meaning.cefrLevel ? <Badge variant="outline">{meaning.cefrLevel}</Badge> : <Badge variant="destructive">Thiếu CEFR</Badge>}
          <StatusBadge status={meaning.origin} />
        </div>
        <div className="flex flex-wrap gap-1">
          <PublicationHistory meaningId={meaning.id} />
          <FormDialog
            trigger={<Button variant="ghost" size="sm" />}
            triggerLabel={<><Pencil /> Sửa</>}
            title="Sửa nghĩa"
            schema={meaningSchema}
            fields={[
              { name: 'cefrLevel', label: 'CEFR', type: 'select', options: toOptions(meta.cefrLevels), clearLabel: 'Chưa chọn' },
              { name: 'coreDefinition', label: 'Định nghĩa gốc', type: 'textarea' },
            ]}
            defaultValues={{ cefrLevel: meaning.cefrLevel, coreDefinition: meaning.coreDefinition ?? '' }}
            onSubmit={(values) => patch.mutateAsync(values)}
          />
          {meaning.publications.length === 0 && (
            <ConfirmAction variant="ghost" label={<><Trash2 /> Xoá</>} title="Xoá nghĩa?" description="Nghĩa, ví dụ và mọi bản dịch sẽ bị xoá." confirmLabel="Xoá" onConfirm={() => remove.mutate()} />
          )}
        </div>
      </div>
      {meaning.coreDefinition && <p className="text-sm text-muted-foreground">{meaning.coreDefinition}</p>}
      <PronunciationsSection meaning={meaning} wordKey={wordKey} />
      <ExamplesSection meaning={meaning} wordKey={wordKey} />
      <Separator />
      <Tabs defaultValue={meta.locales[0] ?? 'vi-VN'}>
        <TabsList>
          {meta.locales.map((locale) => <TabsTrigger key={locale} value={locale}>{locale}</TabsTrigger>)}
        </TabsList>
        {meta.locales.map((locale) => (
          <TabsContent key={locale} value={locale} className="pt-3">
            <MeaningLocaleEditor meaning={meaning} locale={locale} wordKey={wordKey} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function TypeCard({ type, wordKey }: { type: TypeDetail; wordKey: readonly unknown[] }) {
  const meta = useMeta()
  const invalidate = [wordKey, ['words']]
  const hasPublication = type.meanings.some((m) => m.publications.length > 0)
  const removeType = useApiMutation({ mutationFn: () => api(`/admin/word-types/${type.id}`, { method: 'DELETE' }), invalidate, success: 'Đã xoá loại từ' })
  const createMeaning = useApiMutation<z.infer<typeof newMeaningSchema>>({
    mutationFn: ({ cefrLevel, coreDefinition, ipa }) => api(`/admin/word-types/${type.id}/meanings`, {
      method: 'POST',
      body: {
        ...(cefrLevel && { cefrLevel }),
        ...(coreDefinition.trim() && { coreDefinition }),
        pronunciations: [{ accentLocale: meta.audioAccent ?? 'en-US', ...(ipa.trim() && { ipa: ipa.trim() }) }],
      },
    }),
    invalidate,
    success: 'Đã thêm nghĩa',
    silent: true,
  })
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{type.partOfSpeech}</CardTitle>
        {!hasPublication && (
          <ConfirmAction variant="ghost" label={<><Trash2 /> Xoá loại từ</>} title={`Xoá loại từ ${type.partOfSpeech}?`} description="Nghĩa, phát âm, ví dụ và bản dịch thuộc loại từ này sẽ bị xoá." confirmLabel="Xoá" onConfirm={() => removeType.mutate()} />
        )}
      </CardHeader>
      <CardContent className="grid gap-5">
        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Nghĩa dùng chung</p>
            <FormDialog
              trigger={<Button variant="outline" size="sm" />}
              triggerLabel={<><Plus /> Thêm nghĩa</>}
              title="Thêm nghĩa"
              schema={newMeaningSchema}
              fields={[
                { name: 'cefrLevel', label: 'CEFR', type: 'select', options: toOptions(meta.cefrLevels), clearLabel: 'Chưa chọn' },
                { name: 'ipa', label: `IPA (${meta.audioAccent ?? 'en-US'})`, hint: 'Nghĩa khác của cùng từ có thể đọc khác, vd. read /riːd/ và /rɛd/.' },
                { name: 'coreDefinition', label: 'Định nghĩa gốc', type: 'textarea' },
              ]}
              defaultValues={{ cefrLevel: null, ipa: '', coreDefinition: '' }}
              onSubmit={(values) => createMeaning.mutateAsync(values)}
            />
          </div>
          {type.meanings.length === 0 && <EmptyState>Chưa có nghĩa dùng chung.</EmptyState>}
          {type.meanings.map((meaning, index) => <MeaningCard key={meaning.id} meaning={meaning} index={index} wordKey={wordKey} />)}
        </section>
      </CardContent>
    </Card>
  )
}

export function WordDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const meta = useMeta()
  const wordKey = ['word', id] as const
  const { data: word, isLoading, error, refetch } = useQuery({ queryKey: wordKey, queryFn: () => api<WordDetail>(`/admin/words/${id}`) })
  const invalidate = [wordKey, ['words']]
  const patch = useApiMutation<z.infer<typeof wordSchema>>({
    mutationFn: ({ lemma, homographKey }) => api(`/admin/words/${id}`, { method: 'PATCH', body: { lemma, homographKey: emptyToNull(homographKey) } }),
    invalidate,
    success: 'Đã lưu từ',
    silent: true,
  })
  const remove = useApiMutation({
    mutationFn: () => api(`/admin/words/${id}`, { method: 'DELETE' }),
    invalidate: [['words']],
    success: 'Đã xoá từ',
    onSuccess: () => navigate('/words'),
  })
  const voice = useGenerateAudio(wordKey, livePublications(word?.types.flatMap((t) => t.meanings) ?? []))
  const addType = useApiMutation<z.infer<typeof typeSchema>>({
    mutationFn: (body) => api(`/admin/words/${id}/types`, { method: 'POST', body }),
    invalidate,
    success: 'Đã thêm loại từ',
    silent: true,
  })

  if (!word) return <QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} />
  const usedPos = word.types.map((t) => t.partOfSpeech)
  const missingAudio = word.types.some((t) => t.meanings.some((m) => m.pronunciations.some((p) => p.accentLocale === meta.audioAccent && p.ipa && !p.audioAssetKey)))
  return (
    <>
      <PageHeader
        title={word.lemma}
        description={[word.language, word.homographKey && `khoá đồng hình: ${word.homographKey}`].filter(Boolean).join(' · ')}
        back="/words"
        actions={
          <>
            {!word.identityLocked && (
              <FormDialog
                trigger={<Button variant="outline" size="sm" />}
                triggerLabel={<><Pencil /> Sửa từ</>}
                title="Sửa từ"
                schema={wordSchema}
                fields={[{ name: 'lemma', label: 'Từ' }, { name: 'homographKey', label: 'Khoá đồng hình' }]}
                defaultValues={{ lemma: word.lemma, homographKey: word.homographKey ?? '' }}
                onSubmit={(values) => patch.mutateAsync(values)}
              />
            )}
            {missingAudio && (
              <Button variant="outline" size="sm" disabled={voice.isPending} onClick={() => voice.mutate({ wordIds: [id] })}>
                <AudioLines /> {voice.isPending ? 'Đang tạo audio…' : 'Tạo audio còn thiếu'}
              </Button>
            )}
            <FormDialog
              trigger={<Button variant="outline" size="sm" />}
              triggerLabel={<><Plus /> Thêm loại từ</>}
              title="Thêm loại từ"
              schema={typeSchema}
              fields={[{ name: 'partOfSpeech', label: 'Loại từ', type: 'select', options: toOptions(meta.partsOfSpeech.filter((p) => !usedPos.includes(p))) }]}
              defaultValues={{ partOfSpeech: '' }}
              onSubmit={(values) => addType.mutateAsync(values)}
            />
            {!word.identityLocked && (
              <ConfirmAction variant="destructive" label={<><Trash2 /> Xoá từ</>} title={`Xoá từ "${word.lemma}"?`} description="Toàn bộ loại từ, phát âm, nghĩa, ví dụ và bản dịch sẽ bị xoá vĩnh viễn." confirmLabel="Xoá" onConfirm={() => remove.mutate()} />
            )}
          </>
        }
      />
      {word.identityLocked && <p className="mb-4 text-sm text-muted-foreground">Từ đã có nội dung publish hoặc nghĩa riêng của người học, nên không đổi lemma và không xoá được.</p>}
      {word.privateMeaningCount > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          Có {word.privateMeaningCount} nghĩa riêng của người học không hiển thị ở đây. Xem ở <Link className="underline underline-offset-4" to="/ai-review">Duyệt nghĩa AI</Link>.
        </p>
      )}
      <div className="grid gap-6">
        {word.types.map((type) => <TypeCard key={type.id} type={type} wordKey={wordKey} />)}
      </div>
    </>
  )
}
