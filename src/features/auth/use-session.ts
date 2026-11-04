import { useEffect, useState, useSyncExternalStore } from 'react'
import { getSession, hasStoredSession, refreshSession, subscribeSession } from '@/lib/api'

const ADMIN_ROLES = ['editor', 'admin']

export const useSession = () => useSyncExternalStore(subscribeSession, getSession)
export const isContentRole = (role: string | null | undefined) => ADMIN_ROLES.includes(role ?? '')
export const isFullAdmin = (role: string | null | undefined) => role === 'admin'

/** Restores a stored session once on load. */
export function useSessionRestore() {
  const [restoring, setRestoring] = useState(() => !getSession() && hasStoredSession())
  useEffect(() => {
    if (!restoring) return
    refreshSession().catch(() => undefined).finally(() => setRestoring(false))
  }, [restoring])
  return restoring
}
