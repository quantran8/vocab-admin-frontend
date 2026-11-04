import { useEffect, useState } from 'react'
import { AppSelect } from '@/components/app-select'
import { toOptions } from '@/lib/form-utils'
import { ConfirmAction } from '@/components/confirm-action'
import { StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { formatDate, statusLabel } from '@/lib/labels'
import { useApiMutation } from '@/lib/query'
import { useMeta } from '@/lib/use-meta'
import { highlightedText, type MeaningDetail } from './words-api'

const EDITORIAL = { DRAFT: 'draft', APPROVED: 'approved' }

export function MeaningLocaleEditor({ meaning, locale, wordKey }: { meaning: MeaningDetail; locale: string; wordKey: readonly unknown[] }) {
  const meta = useMeta()
  const current = meaning.localizations.find((l) => l.locale === locale)
  const publication = meaning.publications.find((p) => p.locale === locale)
  const [meaningText, setMeaningText] = useState('')
  const [definitionText, setDefinitionText] = useState('')
  const [editorialState, setEditorialState] = useState(EDITORIAL.DRAFT)
  const [translations, setTranslations] = useState<Record<string, string>>({})

  const translationsKey = JSON.stringify(meaning.examples.map((e) => e.localizations))
  useEffect(() => {
    setMeaningText(current?.meaningText ?? '')
    setDefinitionText(current?.definitionText ?? '')
    setEditorialState(current?.editorialState ?? EDITORIAL.DRAFT)
    setTranslations(Object.fromEntries(meaning.examples.map((e) => [e.id, e.localizations.find((l) => l.locale === locale)?.translationText ?? ''])))
    // Re-sync only when saved server data changes, so typing is not overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.updatedAt, locale, translationsKey])

  const invalidate = [wordKey, ['words']]
  const save = useApiMutation({
    mutationFn: () => api(`/admin/meanings/${meaning.id}/locales/${locale}`, {
      method: 'PUT',
      body: {
        meaningText,
        definitionText,
        editorialState,
        exampleTranslations: Object.entries(translations).filter(([, text]) => text.trim()).map(([exampleId, translationText]) => ({ exampleId, translationText })),
      },
    }),
    invalidate,
    success: 'Đã lưu bản dịch',
  })
  const publish = useApiMutation({
    mutationFn: () => api(`/admin/meanings/${meaning.id}/publish`, { method: 'POST', query: { locale } }),
    invalidate: [...invalidate, ['publications', meaning.id]],
    success: 'Đã publish',
  })
  const recall = useApiMutation({
    mutationFn: () => api(`/admin/meanings/${meaning.id}/recall`, { method: 'POST', query: { locale } }),
    invalidate: [...invalidate, ['publications', meaning.id]],
    success: 'Đã recall',
  })
  const removeLocale = useApiMutation({
    mutationFn: () => api(`/admin/meanings/${meaning.id}/locales/${locale}`, { method: 'DELETE' }),
    invalidate,
    success: 'Đã xoá bản dịch',
  })

  const isLive = publication && !publication.recalledAt
  const isDirty = !current
    || meaningText !== current.meaningText
    || definitionText !== current.definitionText
    || editorialState !== current.editorialState
    || meaning.examples.some((e) => (translations[e.id] ?? '') !== (e.localizations.find((l) => l.locale === locale)?.translationText ?? ''))
  const canSave = meaningText.trim() && definitionText.trim()
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {current ? <StatusBadge status={current.editorialState} /> : <span className="text-muted-foreground">Chưa có bản dịch</span>}
        {current && <StatusBadge status={current.origin} />}
        {publication && (
          <>
            <StatusBadge status={isLive ? 'live' : 'recalled'} />
            <span className="text-muted-foreground">Revision {publication.revision}, publish lúc {formatDate(publication.publishedAt)}</span>
          </>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${meaning.id}-${locale}-text`}>Nghĩa</Label>
          <Input id={`${meaning.id}-${locale}-text`} value={meaningText} onChange={(event) => setMeaningText(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Trạng thái biên tập</Label>
          <AppSelect options={toOptions(meta.editorialStates, statusLabel)} value={editorialState} onChange={(v) => setEditorialState(v ?? EDITORIAL.DRAFT)} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor={`${meaning.id}-${locale}-def`}>Định nghĩa</Label>
          <Textarea id={`${meaning.id}-${locale}-def`} rows={2} value={definitionText} onChange={(event) => setDefinitionText(event.target.value)} />
        </div>
      </div>
      {meaning.examples.length > 0 && (
        <div className="grid gap-2">
          <Label>Bản dịch ví dụ</Label>
          {meaning.examples.map((example) => (
            <div key={example.id} className="grid gap-1">
              <p className="text-sm text-muted-foreground">{example.sourceText} <span className="text-xs">(tô sáng: {highlightedText(example)})</span></p>
              <Input
                aria-label={`Bản dịch của: ${example.sourceText}`}
                value={translations[example.id] ?? ''}
                onChange={(event) => setTranslations((all) => ({ ...all, [example.id]: event.target.value }))}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!canSave || save.isPending} onClick={() => save.mutate()}>Lưu bản dịch</Button>
        <Button size="sm" variant="secondary" disabled={isDirty || publish.isPending} onClick={() => publish.mutate()}>{publication ? 'Publish bản mới' : 'Publish'}</Button>
        {isLive && (
          <ConfirmAction
            label="Recall"
            title={`Recall nghĩa ở ${locale}?`}
            description="Người học sẽ không còn thấy nghĩa này ở locale đó. Lịch sử vẫn được giữ và có thể publish lại."
            confirmLabel="Recall"
            onConfirm={() => recall.mutate()}
          />
        )}
        {current && !publication && (
          <ConfirmAction
            label="Xoá bản dịch"
            title={`Xoá bản dịch ${locale}?`}
            description="Bản dịch nghĩa và bản dịch ví dụ của locale này sẽ bị xoá."
            confirmLabel="Xoá"
            onConfirm={() => removeLocale.mutate()}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">{isDirty && current ? 'Có thay đổi chưa lưu. Hãy lưu trước khi publish. ' : ''}Lưu không làm thay đổi bản đang live. Người học chỉ thấy nội dung mới sau khi publish lại.</p>
    </div>
  )
}
