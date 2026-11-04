export interface WordRow {
  id: string
  language: string
  lemma: string
  homographKey: string | null
  createdAt: string
  partsOfSpeech: string[]
  meaningCount: number
  liveMeaningCount: number
  privateMeaningCount: number
}

export interface ExampleDetail {
  id: string
  sourceText: string
  targetLocator: { start?: number; end?: number }
  localizations: { locale: string; translationText: string }[]
}

export interface MeaningLocalization {
  locale: string
  meaningText: string
  definitionText: string
  editorialState: string
  origin: string
  updatedAt: string
}

export interface MeaningPublicationState {
  locale: string
  revision: number
  publishedAt: string
  recalledAt: string | null
}

export interface MeaningDetail {
  id: string
  cefrLevel: string | null
  coreDefinition: string | null
  origin: string
  reviewedAt: string | null
  createdAt: string
  localizations: MeaningLocalization[]
  examples: ExampleDetail[]
  publications: MeaningPublicationState[]
}

export interface PronunciationDetail {
  id: string
  accentLocale: string
  ipa: string | null
  audioAssetKey: string | null
}

export interface TypeDetail {
  id: string
  partOfSpeech: string
  pronunciations: PronunciationDetail[]
  meanings: MeaningDetail[]
}

export interface WordDetail {
  id: string
  language: string
  lemma: string
  homographKey: string | null
  createdAt: string
  privateMeaningCount: number
  identityLocked: boolean
  types: TypeDetail[]
}

export interface PublicationRevision {
  id: string
  locale: string
  revision: number
  approvedAt: string
  publishedAt: string
  recalledAt: string | null
  isCurrent: boolean
}

/** Backend stores the highlight as offsets; editors type the word they want highlighted. */
export function locateTarget(sourceText: string, target: string) {
  const start = sourceText.toLowerCase().indexOf(target.trim().toLowerCase())
  return start < 0 || !target.trim() ? null : { start, end: start + target.trim().length }
}

export function highlightedText({ sourceText, targetLocator: { start, end } }: Pick<ExampleDetail, 'sourceText' | 'targetLocator'>) {
  return start === undefined || end === undefined ? '' : sourceText.slice(start, end)
}
