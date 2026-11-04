import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login } from '@/lib/api'
import { describeError } from '@/lib/errors'

const schema = z.object({
  email: z.string().trim().min(1, 'Nhập tài khoản'),
  password: z.string().min(8, 'Mật khẩu có ít nhất 8 ký tự').max(72, 'Mật khẩu có tối đa 72 ký tự'),
})
type Values = z.infer<typeof schema>

export function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) })

  const submit = handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      await login(email, password)
    } catch (failure) {
      setError(describeError(failure).title)
    }
  })

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Vocab Flow Admin</CardTitle>
          <CardDescription>Đăng nhập bằng tài khoản quản trị.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Tài khoản</Label>
              <Input id="email" type="text" autoCapitalize="none" spellCheck={false} autoComplete="username" aria-invalid={!!formState.errors.email} {...register('email')} />
              {formState.errors.email && <p className="text-xs text-destructive">{formState.errors.email.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register('password')} />
              {formState.errors.password && <p className="text-xs text-destructive">{formState.errors.password.message}</p>}
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={formState.isSubmitting}>Đăng nhập</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
