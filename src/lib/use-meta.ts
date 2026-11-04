import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { Meta } from './types'

const EMPTY: Meta = {
  locales: [], cefrLevels: [], partsOfSpeech: [], templateVariants: {}, editorialStates: [],
  itemStatuses: [], contentStatuses: [], meaningOrigins: [], aiMeaningScopes: [], adminRoles: [], assignableRoles: [],
}

export function useMeta() {
  const { data } = useQuery({ queryKey: ['meta'], queryFn: () => api<Meta>('/admin/meta'), staleTime: Infinity })
  return data ?? EMPTY
}
