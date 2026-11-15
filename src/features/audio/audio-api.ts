import { api } from '@/lib/api'

/** Prefix of every audio query, so one invalidation refreshes the status and both lists. */
export const AUDIO_KEY = ['audio'] as const
export const AUDIO_STATUS_KEY = ['audio', 'status'] as const
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

export interface MissingAudio {
  pronunciationId: string
  wordId: string
  lemma: string
  homographKey: string | null
  partOfSpeech: string
  ipa: string | null
  /** The word type has a live meaning, so learners are missing this audio now. */
  live: boolean
}

export interface StalePublication {
  meaningId: string
  locale: string
  wordId: string
  lemma: string
  partOfSpeech: string
  meaningText: string
  revision: number
  publishedAt: string
}

export interface PublicationKey {
  meaningId: string
  locale: string
}

export interface RefreshResult {
  refreshed: (PublicationKey & { revision: number })[]
  remaining: number
}

/** Republishes only the audio: the live snapshot is copied with the new audioUrl, other edits stay unpublished. */
export const refreshPublications = (publications?: PublicationKey[]) =>
  api<RefreshResult>('/admin/audio/stale-publications/refresh', { method: 'POST', body: publications ? { publications } : {} })

export const generateAudio = (body: GenerateBody) => api<GenerateResult>('/admin/audio/generate', { method: 'POST', body })

export function playAudio(url: string) {
  // Autoplay rules can refuse; the click itself is the user gesture, so this rarely fails.
  void new Audio(url).play().catch(() => undefined)
}
