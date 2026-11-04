const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
const REFRESH_KEY = 'vocab-admin.refresh-token'
const REFRESH_LOCK = 'vocab-admin.refresh'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly retryable: boolean
  readonly requestId?: string

  constructor(status: number, code: string, message: string, retryable = false, requestId?: string) {
    super(message)
    this.status = status
    this.code = code
    this.retryable = retryable
    this.requestId = requestId
  }
}

export interface Session {
  email: string | null
  subject: string
  role: string | null
}

interface SessionResponse {
  accessToken: string
  refreshToken: string
  user: { id: string; email: string | null }
}

let accessToken: string | null = null
let session: Session | null = null
let inFlightRefresh: Promise<void> | null = null
const listeners = new Set<() => void>()

const readRefreshToken = () => {
  try {
    return localStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

const writeRefreshToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(REFRESH_KEY, token)
    else localStorage.removeItem(REFRESH_KEY)
  } catch {
    // Private mode can block storage: the session then lasts until reload.
  }
}

/** For display only: the backend verifies the signature and enforces the role. */
export function decodeRole(token: string): string | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(payload)) as { app_metadata?: { role?: unknown } }
    const role = claims.app_metadata?.role
    return typeof role === 'string' ? role : null
  } catch {
    return null
  }
}

function applySession(response: SessionResponse | null) {
  accessToken = response?.accessToken ?? null
  writeRefreshToken(response?.refreshToken ?? null)
  session = response
    ? { email: response.user.email, subject: response.user.id, role: decodeRole(response.accessToken) }
    : null
  listeners.forEach((listener) => listener())
}

export const getSession = () => session
export const hasStoredSession = () => readRefreshToken() !== null
export function subscribeSession(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const logout = () => applySession(null)

async function toApiError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as { code?: string; message?: string; retryable?: boolean; requestId?: string }
  return new ApiError(response.status, body.code ?? 'INTERNAL_ERROR', body.message ?? response.statusText, body.retryable ?? false, body.requestId)
}

async function postAuth(path: string, body: object) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as SessionResponse
}

export async function login(email: string, password: string) {
  applySession(await postAuth('/v1/auth/login', { email, password }))
}

async function doRefresh() {
  const token = readRefreshToken()
  if (!token) {
    applySession(null)
    return
  }
  try {
    applySession(await postAuth('/v1/auth/refresh', { refreshToken: token }))
  } catch (error) {
    // Keep the session through an outage; only a rejected token ends it.
    if (error instanceof ApiError && error.status === 401) applySession(null)
    throw error
  }
}

/** Refresh tokens are single use, so one refresh runs at a time, across tabs too. */
export function refreshSession(): Promise<void> {
  inFlightRefresh ??= (navigator.locks ? navigator.locks.request(REFRESH_LOCK, doRefresh) : doRefresh()).finally(() => {
    inFlightRefresh = null
  })
  return inFlightRefresh
}

type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, QueryValue>
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const search = params.toString()
  return `${BASE_URL}${path}${search ? `?${search}` : ''}`
}

async function send(path: string, { method = 'GET', body, query }: RequestOptions) {
  const headers: Record<string, string> = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return fetch(buildUrl(path, query), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!accessToken && hasStoredSession()) await refreshSession()
  let response = await send(path, options)
  // A 401 means the guard refused before the handler ran, so resending a write is safe.
  if (response.status === 401 && hasStoredSession()) {
    await refreshSession()
    response = await send(path, options)
  }
  if (response.status === 401) applySession(null)
  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
