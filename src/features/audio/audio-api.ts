import { api } from '@/lib/api'

export const AUDIO_STATUS_KEY = ['audio-status'] as const
export const MAX_BATCH = 50
export const DEFAULT_BATCH = 20

export interface AudioStatus {
  voice: string
  accent: string
  missing: number
  withAudio: number
  /** Live meanings whose published snapshot still lacks the current audio: they need a republish. */
  staleLivePublications: number
}

export interface GeneratedAudio {
  pronunciationId: string
  wordId: string
  lemma: string
  audioUrl: string
}

export interface FailedAudio {
  pronunciationId: string
  wordId: string
  lemma: string
  message: string
}

export interface GenerateResult {
  voice: string
  accent: string
  generated: GeneratedAudio[]
  failed: FailedAudio[]
  skippedIds: string[]
  remaining: number
}

export interface GenerateBody {
  pronunciationIds?: string[]
  wordIds?: string[]
  overwrite?: boolean
  limit?: number
}

export const generateAudio = (body: GenerateBody) => api<GenerateResult>('/admin/audio/generate', { method: 'POST', body })

export function playAudio(url: string) {
  // Autoplay rules can refuse; the click itself is the user gesture, so this rarely fails.
  void new Audio(url).play().catch(() => undefined)
}
