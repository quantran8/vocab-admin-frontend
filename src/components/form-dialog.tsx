import { useEffect, useState, type ReactElement } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, type FieldValues, type Path } from 'react-hook-form'
import type { z } from 'zod'
import { AppSelect } from '@/components/app-select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { describeError, parseFieldErrors } from '@/lib/errors'
import type { Option } from '@/lib/form-utils'

export interface FieldConfig {
  name: string
  label: string
  type?: 'text' | 'textarea' | 'select'
  options?: Option[]
  clearLabel?: string
  hint?: string
}

interface FormDialogProps<T extends FieldValues> {
  trigger: ReactElement
  triggerLabel: React.ReactNode
  title: string
  description?: string
  schema: z.ZodType<T, FieldValues>
  fields: FieldConfig[]
  defaultValues: FieldValues
  submitLabel?: string
  onSubmit: (values: T) => Promise<unknown>
}

export function FormDialog<T extends FieldValues>({ trigger, triggerLabel, title, description, schema, fields, defaultValues, submitLabel = 'Lưu', onSubmit }: FormDialogProps<T>) {
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FieldValues, unknown, T>({ resolver: zodResolver(schema), defaultValues })

  useEffect(() => {
    if (open) {
      form.reset(defaultValues)
      setFormError(null)
    }
    // defaultValues is rebuilt on each render; only opening should reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      await onSubmit(values)
      setOpen(false)
    } catch (error) {
      const fieldErrors = parseFieldErrors(error)
      const known = Object.entries(fieldErrors).filter(([name]) => fields.some((f) => f.name === name))
      known.forEach(([name, message]) => form.setError(name as Path<FieldValues>, { message }))
      if (known.length === 0 || !(error instanceof ApiError)) {
        const { title: errorTitle, detail } = describeError(error)
        setFormError(detail ? `${errorTitle} ${detail}` : errorTitle)
      }
    }
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {fields.map((field) => {
            const message = form.formState.errors[field.name]?.message
            const id = `field-${field.name}`
            return (
              <div key={field.name} className="grid gap-1.5">
                <Label htmlFor={id}>{field.label}</Label>
                {field.type === 'select' ? (
                  <Controller
                    control={form.control}
                    name={field.name}
                    render={({ field: control }) => (
                      <AppSelect id={id} options={field.options ?? []} value={(control.value as string | null) ?? null} onChange={control.onChange} clearLabel={field.clearLabel} placeholder="Chọn" />
                    )}
                  />
                ) : field.type === 'textarea' ? (
                  <Textarea id={id} aria-invalid={!!message} {...form.register(field.name)} />
                ) : (
                  <Input id={id} aria-invalid={!!message} {...form.register(field.name)} />
                )}
                {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                {message && <p className="text-xs text-destructive">{String(message)}</p>}
              </div>
            )
          })}
          {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
