import { useState, type ReactElement } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import type { MeaningOption, Page } from '@/lib/types'
import { useDebounced } from '@/lib/use-debounced'
import { EmptyState, QueryState } from './common'

const PICKER_LIMIT = 20

interface MeaningPickerProps {
  trigger: ReactElement
  triggerLabel: React.ReactNode
  title: string
  description: string
  excludeIds?: string[]
  liveOnly?: boolean
  onPick: (meaning: MeaningOption) => void
}

export function MeaningPicker({ trigger, triggerLabel, title, description, excludeIds = [], liveOnly, onPick }: MeaningPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim())
  const { data, isLoading, error } = useQuery({
    queryKey: ['meanings', { q, liveOnly }],
    queryFn: () => api<Page<MeaningOption>>('/admin/meanings', { query: { q, limit: PICKER_LIMIT, live: liveOnly ? true : undefined } }),
    enabled: open,
  })
  const items = (data?.items ?? []).filter((m) => !excludeIds.includes(m.id))
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Input placeholder="Tìm theo từ…" aria-label="Tìm nghĩa theo từ" value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="max-h-80 space-y-1 overflow-y-auto">
          <QueryState isLoading={isLoading} error={error} />
          {data && items.length === 0 && <EmptyState>Không có nghĩa phù hợp.</EmptyState>}
          {items.map((meaning) => (
            <Button
              key={meaning.id}
              variant="ghost"
              className="h-auto w-full justify-start py-2 text-left whitespace-normal"
              onClick={() => {
                onPick(meaning)
                setOpen(false)
              }}
            >
              <span>
                <span className="font-medium">{meaning.lemma}</span>{' '}
                <span className="text-muted-foreground">({meaning.partOfSpeech}{meaning.cefrLevel ? `, ${meaning.cefrLevel}` : ''})</span>
                <span className="block text-sm font-normal text-muted-foreground">{meaning.meaningText ?? 'Chưa có nghĩa ở locale mặc định'}</span>
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
