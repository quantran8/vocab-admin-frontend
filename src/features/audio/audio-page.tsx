import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, RefreshCw, Square } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { EmptyState, PageHeader, QueryState } from '@/components/common'
import { DataTable, type Column } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AppSelect } from '@/components/app-select'
import { api } from '@/lib/api'
import { toastError } from '@/lib/query'
import { MissingAudioList, StalePublicationsList } from './audio-lists'
import { AUDIO_KEY, AUDIO_STATUS_KEY, DEFAULT_BATCH, generateAudio, MAX_BATCH, playAudio, type AudioStatus, type FailedAudio, type GeneratedAudio } from './audio-api'

const LOG_SIZE = 100

const wordLink = (row: { wordId: string; lemma: string }) => (
  <Link className="font-medium underline-offset-4 hover:underline" to={`/words/${row.wordId}`}>{row.lemma}</Link>
)

const GENERATED_COLUMNS: Column<GeneratedAudio>[] = [
  { id: 'lemma', header: 'Từ', cell: wordLink },
  { id: 'ipa', header: 'IPA', cell: (g) => g.ipa },
  {
    id: 'play',
    header: 'Nghe',
    cell: (g) => <Button variant="ghost" size="icon" aria-label={`Nghe ${g.lemma}`} onClick={() => playAudio(g.audioUrl)}><Play /></Button>,
  },
]

const FAILED_COLUMNS: Column<FailedAudio>[] = [
  { id: 'lemma', header: 'Từ', cell: wordLink },
  { id: 'ipa', header: 'IPA', cell: (f) => f.ipa },
  { id: 'message', header: 'Lỗi', cell: (f) => <span className="text-sm text-muted-foreground">{f.message}</span> },
]

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export function AudioPage() {
  const client = useQueryClient()
  const { data: status, isLoading, error, refetch } = useQuery({ queryKey: AUDIO_STATUS_KEY, queryFn: () => api<AudioStatus>('/admin/audio/status') })
  const [batch, setBatch] = useState(String(DEFAULT_BATCH))
  // Null follows the backend default, so the page never sends a voice it was not offered.
  const [pickedVoice, setPickedVoice] = useState<string | null>(null)
  const voiceId = pickedVoice ?? status?.voice
  const [running, setRunning] = useState(false)
  const [generated, setGenerated] = useState<GeneratedAudio[]>([])
  const [failed, setFailed] = useState<FailedAudio[]>([])
  const [doneCount, setDoneCount] = useState(0)
  const stopRef = useRef(false)

  const limit = Math.min(MAX_BATCH, Math.max(1, Math.trunc(Number(batch)) || DEFAULT_BATCH))

  async function run(untilDone: boolean) {
    stopRef.current = false
    setRunning(true)
    setFailed([])
    let total = 0
    try {
      for (;;) {
        const result = await generateAudio({ limit, voiceId })
        total += result.generated.length
        setDoneCount(total)
        setGenerated((prev) => [...result.generated, ...prev].slice(0, LOG_SIZE))
        // A word that keeps failing is listed once, with its latest error.
        setFailed((prev) => [...result.failed, ...prev.filter((p) => !result.failed.some((f) => f.pronunciationId === p.pronunciationId))])
        client.setQueryData<AudioStatus>(AUDIO_STATUS_KEY, (old) => old && { ...old, missing: result.remaining })
        // Nothing new means only failing words are left; looping would spend credits for nothing.
        if (!untilDone || stopRef.current || result.remaining === 0 || result.generated.length === 0) break
      }
      toast.success(`Đã tạo ${total} audio`)
    } catch (err) {
      toastError(err)
    } finally {
      setRunning(false)
      void client.invalidateQueries({ queryKey: AUDIO_KEY })
      void client.invalidateQueries({ queryKey: ['word'] })
    }
  }

  return (
    <>
      <PageHeader
        title="Âm thanh"
        description="Tạo audio phát âm hàng loạt bằng ElevenLabs, lưu trên Cloudflare R2."
        actions={<Button variant="outline" size="sm" onClick={() => void refetch()} disabled={running}><RefreshCw /> Làm mới</Button>}
      />
      <QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} />
      {status && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Chưa có audio" value={status.missing} hint={`Phát âm ${status.accent} đã có IPA`} />
          <Stat label="Thiếu IPA" value={status.missingIpa} hint="Audio được tạo từ IPA nên cần thêm IPA trước." />
          <Stat label="Đã có audio" value={status.withAudio} />
          <Stat label="Nghĩa live cần publish lại" value={status.staleLivePublications} hint="Bản live vẫn phát audio cũ. Xem tab Cần publish lại." />
        </div>
      )}

      <Tabs defaultValue="generate">
        <TabsList className="mb-4">
          <TabsTrigger value="generate">Tạo hàng loạt</TabsTrigger>
          <TabsTrigger value="missing">Thiếu audio{status ? ` (${status.missing})` : ''}</TabsTrigger>
          <TabsTrigger value="stale">Cần publish lại{status ? ` (${status.staleLivePublications})` : ''}</TabsTrigger>
        </TabsList>
        <TabsContent value="missing"><MissingAudioList voiceId={voiceId} /></TabsContent>
        <TabsContent value="stale"><StalePublicationsList /></TabsContent>
        <TabsContent value="generate">
          <Card className="mb-6">
            <CardHeader><CardTitle>Tạo audio còn thiếu</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="audio-voice">Voice</Label>
                  <AppSelect
                    id="audio-voice"
                    className="w-56"
                    disabled={running || !status?.voices.length}
                    options={(status?.voices ?? []).map((v) => ({ value: v.id, label: v.id === status?.voice ? `${v.name} (mặc định)` : v.name }))}
                    value={voiceId ?? null}
                    onChange={setPickedVoice}
                    placeholder="Chưa cấu hình voice"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="audio-batch">Số phát âm mỗi lượt (tối đa {MAX_BATCH})</Label>
                  <Input id="audio-batch" className="w-32" type="number" min={1} max={MAX_BATCH} value={batch} disabled={running} onChange={(e) => setBatch(e.target.value)} />
                </div>
                <Button variant="outline" disabled={running || status?.missing === 0} onClick={() => void run(false)}>Tạo một lượt</Button>
                {running ? (
                  <Button variant="destructive" onClick={() => { stopRef.current = true }}><Square /> Dừng sau lượt này</Button>
                ) : (
                  <Button disabled={status?.missing === 0} onClick={() => void run(true)}>Tạo đến hết</Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {running ? `Đang tạo… đã xong ${doneCount} audio trong lần chạy này.` : 'Audio được đọc từ IPA của từng nghĩa. Mỗi IPA chỉ gọi ElevenLabs một lần cho mỗi voice; các nghĩa trùng IPA dùng chung file.'}
              </p>
            </CardContent>
          </Card>

          {failed.length > 0 && (
            <section className="mb-6 grid gap-2">
              <h2 className="font-medium text-destructive">Lỗi ({failed.length})</h2>
              <DataTable columns={FAILED_COLUMNS} rows={failed} rowKey={(f) => f.pronunciationId} />
            </section>
          )}
          <section className="grid gap-2">
            <h2 className="font-medium">Vừa tạo</h2>
            {generated.length === 0
              ? <EmptyState>Chưa tạo audio nào trong phiên này.</EmptyState>
              : <DataTable columns={GENERATED_COLUMNS} rows={generated} rowKey={(g) => g.pronunciationId} />}
          </section>
        </TabsContent>
      </Tabs>
    </>
  )
}
