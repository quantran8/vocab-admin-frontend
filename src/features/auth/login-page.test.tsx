import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getSession, logout } from '@/lib/api'
import { LoginPage } from './login-page'

const server = setupServer()

describe('LoginPage', () => {
  beforeAll(() => server.listen())
  afterEach(() => {
    server.resetHandlers()
    logout()
  })
  afterAll(() => server.close())

  it('validates before calling the server', async () => {
    render(<LoginPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByText('Nhập tài khoản')).toBeInTheDocument()
  })

  it('shows a rejected login', async () => {
    server.use(http.post('http://api.test/v1/auth/login', () => HttpResponse.json({ code: 'UNAUTHORIZED', message: 'Invalid credentials' }, { status: 401 })))
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('Tài khoản'), 'a@example.com')
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('sai thông tin')
    expect(getSession()).toBeNull()
  })

  it('stores the session on success', async () => {
    const token = `h.${btoa(JSON.stringify({ app_metadata: { role: 'admin' } }))}.s`
    server.use(http.post('http://api.test/v1/auth/login', () => HttpResponse.json({ accessToken: token, refreshToken: 'r', expiresIn: 3600, user: { id: 'u', email: 'a@example.com' } })))
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('Tài khoản'), 'a@example.com')
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'correct-horse')
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    await waitFor(() => expect(getSession()?.role).toBe('admin'))
  })
})
