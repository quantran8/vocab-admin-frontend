export interface Page<T> {
  total: number
  items: T[]
}

export interface Meta {
  locales: string[]
  cefrLevels: string[]
  partsOfSpeech: string[]
  templateVariants: Record<string, string[]>
  editorialStates: string[]
  itemStatuses: string[]
  contentStatuses: string[]
  meaningOrigins: string[]
  aiMeaningScopes: string[]
  adminRoles: string[]
  assignableRoles: string[]
  /** The only accent the backend voices. */
  audioAccent: string | null
}

export interface MeaningOption {
  id: string
  wordId: string
  lemma: string
  partOfSpeech: string
  cefrLevel: string | null
  meaningText: string | null
  liveLocales: string[]
  pronunciations: { id: string; accentLocale: string; ipa: string | null }[]
}
