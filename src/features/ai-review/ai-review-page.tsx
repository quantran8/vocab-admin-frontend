import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, PageHeader, Pagination, QueryState, StatusBadge } from '@/components/common'
import { ConfirmAction } from '@/components/confirm-action'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { formatDate, SCOPE_LABELS } from '@/lib/labels'
import { useApiMutation } from '@/lib/query'

const LIMIT = 20
const SCOPES = ['all', 'shared', 'private']

interface AiMeaning {
  meaningId: string
  wordId: string
  lemma: string
  partOfSpeech: string
  cefrLevel: string | null
  ipa: string | null
  isPrivate: boolean
  createdAt: string
  localizations: { locale: string; meaningText: string; definitionText: string; origin: string }[]
  examples: { id: string; sourceText: string; translations: { locale: string; translationText: string }[] }[]
  liveLocales: string[]
  recalledLocales: string[]
}

function ReviewCard({ meaning }: { meaning: AiMeaning }) {
  const invalidate = [['ai-meanings'], ['words'], ['word', meaning.wordId]]
  const approve = useApiMutation({
    mutationFn: () => api(`/admin/ai-meanings/${meaning.meaningId}/approve`, { method: 'POST' }),
    invalidate,
    success: 'Đã duyệt nghĩa',
  })
  const recall = useApiMutation<string>({
    mutationFn: (locale) => api(`/admin/meanings/${meaning.meaningId}/recall`, { method: 'POST', query: { locale } }),
    invalidate,
    success: 'Đã recall',
  })
  const canApprove = meaning.liveLocales.length > 0 && meaning.recalledLocales.length === 0
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {meaning.isPrivate ? meaning.lemma : <Link className="underline-offset-4 hover:underline" to={`/words/${meaning.wordId}`}>{meaning.lemma}</Link>}
            <Badge variant="outline">{meaning.partOfSpeech}</Badge>
            {meaning.cefrLevel && <Badge variant="outline">{meaning.cefrLevel}</Badge>}
            <Badge variant={meaning.isPrivate ? 'secondary' : 'outline'}>{meaning.isPrivate ? 'Riêng tư' : 'Dùng chung'}</Badge>
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{meaning.ipa ?? 'Chưa có IPA'} · tạo lúc {formatDate(meaning.createdAt)}</p>
        </div>
        <ConfirmAction
          variant="default"
          disabled={!canApprove || approve.isPending}
          label={<><Check /> Duyệt</>}
          title={`Duyệt nghĩa của "${meaning.lemma}"?`}
          description={meaning.isPrivate ? 'Nội dung AI đã lưu sẽ được chia sẻ cho mọi người học.' : 'Nghĩa sẽ được đánh dấu là đã biên tập và có thể dùng làm phương án nhiễu.'}
          confirmLabel="Duyệt"
          onConfirm={() => approve.mutate()}
        />
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {meaning.localizations.map((l) => (
          <div key={l.locale} className="rounded-md border p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-medium">{l.locale}</span>
              <StatusBadge status={l.origin} />
              {meaning.liveLocales.includes(l.locale) && <StatusBadge status="live" />}
              {meaning.recalledLocales.includes(l.locale) && <StatusBadge status="recalled" />}
            </div>
            <p className="font-medium">{l.meaningText}</p>
            <p className="text-muted-foreground">{l.definitionText}</p>
            {meaning.liveLocales.includes(l.locale) && (
              <div className="mt-2">
                <ConfirmAction
                  label="Recall"
                  title={`Recall nghĩa ở ${l.locale}?`}
                  description="Người học sẽ không còn thấy nghĩa này ở locale đó. Sau khi recall, không thể duyệt nghĩa cho tới khi publish lại."
                  confirmLabel="Recall"
                  disabled={recall.isPending}
                  onConfirm={() => recall.mutate(l.locale)}
                />
              </div>
            )}
          </div>
        ))}
        {meaning.examples.length > 0 && (
          <div>
            <p className="mb-1 font-medium">Ví dụ</p>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              {meaning.examples.map((e) => (
                <li key={e.id}>{e.sourceText}{e.translations.map((t) => <span key={t.locale} className="block pl-5 text-xs">{t.locale}: {t.translationText}</span>)}</li>
              ))}
            </ul>
          </div>
        )}
        {!canApprove && <p className="text-xs text-muted-foreground">Chỉ duyệt được khi nghĩa đang live và không có locale nào bị recall.</p>}
      </CardContent>
    </Card>
  )
}

export function AiReviewPage() {
  const [scope, setScope] = useState('all')
  const [offset, setOffset] = useState(0)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ai-meanings', { scope, offset }],
    queryFn: () => api<{ total: number; meanings: AiMeaning[] }>('/admin/ai-meanings', { query: { scope, limit: LIMIT, offset } }),
  })
  return (
    <>
      <PageHeader title="Duyệt nghĩa AI" description="Chỉ hiển thị nội dung AI đã lưu. Nội dung dùng chung đã live, nên việc duyệt là kiểm duyệt sau khi đăng." />
      <Tabs value={scope} onValueChange={(value) => { setScope(value as string); setOffset(0) }} className="mb-4">
        <TabsList>
          {SCOPES.map((s) => <TabsTrigger key={s} value={s}>{SCOPE_LABELS[s]}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} />
      {data && (
        <>
          {data.meanings.length === 0 && <EmptyState>Không có nghĩa nào chờ duyệt.</EmptyState>}
          <div className="grid gap-4">
            {data.meanings.map((meaning) => <ReviewCard key={meaning.meaningId} meaning={meaning} />)}
          </div>
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </>
      )}
    </>
  )
}
