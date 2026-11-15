import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { AudioPage } from './audio-page'

const BASE = 'http://api.test'
const server = setupServer()
const status = (missing: number) => ({ voice: 'v1', accent: 'en-US', missing, withAudio: 7, staleLivePublications: 1 })
const item = (n: number) => ({ pronunciationId: `p${n}`, wordId: `w${n}`, lemma: `word${n}` })

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><AudioPage /></MemoryRouter></QueryClientProvider>)
}

describe('AudioPage', () => {
  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('shows the counts', async () => {
    server.use(http.get(`${BASE}/admin/audio/status`, () => HttpResponse.json(status(4))))
    renderPage()
    expect(await screen.findByText('4')).toBeInTheDocument()
    expect(screen.getByText('Nghĩa live cần publish lại').parentElement?.parentElement).toHaveTextContent('1')
  })

  it('keeps generating until nothing remains, and lists failures', async () => {
    const bodies: unknown[] = []
    let remaining = 3
    server.use(
      http.get(`${BASE}/admin/audio/status`, () => HttpResponse.json(status(remaining))),
      http.post(`${BASE}/admin/audio/generate`, async ({ request }) => {
        bodies.push(await request.json())
        remaining -= 2
        const n = bodies.length
        return HttpResponse.json({
          voice: 'v1', accent: 'en-US', skippedIds: [], remaining: Math.max(0, remaining),
          generated: [{ ...item(n), audioUrl: `https://cdn.test/${n}.mp3` }],
          failed: n === 1 ? [{ ...item(9), message: 'ElevenLabs returned 429' }] : [],
        })
      }),
    )
    renderPage()
    await screen.findByText('3')
    await userEvent.clear(screen.getByLabelText(/Số phát âm mỗi lượt/))
    await userEvent.type(screen.getByLabelText(/Số phát âm mỗi lượt/), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Tạo đến hết' }))

    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies).toEqual([{ limit: 2 }, { limit: 2 }])
    expect(await screen.findByRole('link', { name: 'word2' })).toBeInTheDocument()
    expect(screen.getByText('ElevenLabs returned 429')).toBeInTheDocument()
  })

  it('stops on a provider outage', async () => {
    let calls = 0
    server.use(
      http.get(`${BASE}/admin/audio/status`, () => HttpResponse.json(status(5))),
      http.post(`${BASE}/admin/audio/generate`, () => {
        calls++
        return HttpResponse.json({ code: 'TTS_PROVIDER_UNAVAILABLE', message: 'ElevenLabs is not configured', retryable: true }, { status: 503 })
      }),
    )
    renderPage()
    await screen.findByText('5')
    await userEvent.click(screen.getByRole('button', { name: 'Tạo đến hết' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tạo đến hết' })).toBeEnabled())
    expect(calls).toBe(1)
  })
})
