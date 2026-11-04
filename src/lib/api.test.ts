import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const BASE = 'http://api.test'
const server = setupServer()

const jwt = (role?: string) => `h.${btoa(JSON.stringify({ app_metadata: role ? { role } : {} }))}.s`
const sessionBody = (token: string, refreshToken = 'refresh-next') => ({ accessToken: token, refreshToken, expiresIn: 3600, user: { id: 'uid-1', email: 'a@example.com' } })

async function loadApi() {
  vi.resetModules()
  return import('./api')
}

describe('api client', () => {
  beforeAll(() => server.listen())
  beforeEach(() => localStorage.clear())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('refreshes once when several requests hit an expired token, then retries each', async () => {
    const { api, login } = await loadApi()
    let refreshes = 0
    const fresh = jwt('admin')
    server.use(
      http.post(`${BASE}/v1/auth/login`, () => HttpResponse.json(sessionBody('expired', 'refresh-1'))),
      http.post(`${BASE}/v1/auth/refresh`, async ({ request }) => {
        refreshes += 1
        expect(await request.json()).toEqual({ refreshToken: 'refresh-1' })
        return HttpResponse.json(sessionBody(fresh))
      }),
      http.get(`${BASE}/admin/:name`, ({ request, params }) => {
        if (request.headers.get('Authorization') !== `Bearer ${fresh}`) {
          return HttpResponse.json({ code: 'UNAUTHORIZED', message: 'expired' }, { status: 401 })
        }
        return HttpResponse.json({ name: params.name })
      }),
    )
    await login('a@example.com', 'correct-horse')
    const results = await Promise.all([api('/admin/a'), api('/admin/b'), api('/admin/c')])
    expect(results).toEqual([{ name: 'a' }, { name: 'b' }, { name: 'c' }])
    expect(refreshes).toBe(1)
    expect(localStorage.getItem('vocab-admin.refresh-token')).toBe('refresh-next')
  })

  it('ends the session when the refresh token is rejected', async () => {
    const { api, getSession, login, ApiError } = await loadApi()
    server.use(
      http.post(`${BASE}/v1/auth/login`, () => HttpResponse.json(sessionBody(jwt('admin'), 'refresh-1'))),
      http.post(`${BASE}/v1/auth/refresh`, () => HttpResponse.json({ code: 'UNAUTHORIZED', message: 'Invalid credentials' }, { status: 401 })),
      http.get(`${BASE}/admin/words`, () => HttpResponse.json({ code: 'UNAUTHORIZED', message: 'expired' }, { status: 401 })),
    )
    await login('a@example.com', 'correct-horse')
    await expect(api('/admin/words')).rejects.toBeInstanceOf(ApiError)
    expect(getSession()).toBeNull()
    expect(localStorage.getItem('vocab-admin.refresh-token')).toBeNull()
  })

  it('keeps the session through a provider outage', async () => {
    const { refreshSession, getSession, login } = await loadApi()
    server.use(
      http.post(`${BASE}/v1/auth/login`, () => HttpResponse.json(sessionBody(jwt('editor'), 'refresh-1'))),
      http.post(`${BASE}/v1/auth/refresh`, () => HttpResponse.json({ code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'down', retryable: true }, { status: 503 })),
    )
    await login('a@example.com', 'correct-horse')
    await expect(refreshSession()).rejects.toMatchObject({ status: 503 })
    expect(getSession()?.role).toBe('editor')
    expect(localStorage.getItem('vocab-admin.refresh-token')).toBe('refresh-1')
  })

  it('does not resend a write that failed for another reason', async () => {
    const { api, login } = await loadApi()
    let writes = 0
    server.use(
      http.post(`${BASE}/v1/auth/login`, () => HttpResponse.json(sessionBody(jwt('admin')))),
      http.post(`${BASE}/admin/words`, () => {
        writes += 1
        return HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'Internal error', retryable: true, requestId: 'r-1' }, { status: 500 })
      }),
    )
    await login('a@example.com', 'correct-horse')
    await expect(api('/admin/words', { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'INTERNAL_ERROR', requestId: 'r-1' })
    expect(writes).toBe(1)
  })

  it('handles empty 204 responses and drops empty query values', async () => {
    const { api, login } = await loadApi()
    let search = ''
    server.use(
      http.post(`${BASE}/v1/auth/login`, () => HttpResponse.json(sessionBody(jwt('admin')))),
      http.delete(`${BASE}/admin/words/1`, ({ request }) => {
        search = new URL(request.url).search
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await login('a@example.com', 'correct-horse')
    await expect(api('/admin/words/1', { method: 'DELETE', query: { q: '', status: null, limit: 5 } })).resolves.toBeUndefined()
    expect(search).toBe('?limit=5')
  })

  it('reads the role from the token and treats a bad token as no role', async () => {
    const { decodeRole } = await loadApi()
    expect(decodeRole(jwt('editor'))).toBe('editor')
    expect(decodeRole(jwt())).toBeNull()
    expect(decodeRole('garbage')).toBeNull()
  })
})
