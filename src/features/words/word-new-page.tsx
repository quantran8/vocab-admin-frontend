import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { Controller, useFieldArray, useForm, type Control, type UseFormRegister, type FieldErrors } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AppSelect } from '@/components/app-select'
import { toOptions } from '@/lib/form-utils'
import { PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { describeError } from '@/lib/errors'
import { useMeta } from '@/lib/use-meta'
import { locateTarget } from './words-api'

const example = z.object({ sourceText: z.string().trim().min(1, 'Nhập câu ví dụ'), target: z.string().trim().min(1, 'Nhập từ cần tô sáng') })
  .refine((e) => locateTarget(e.sourceText, e.target) !== null, { path: ['target'], message: 'Không tìm thấy trong câu ví dụ' })
const schema = z.object({
  lemma: z.string().trim().min(1, 'Nhập từ'),
  homographKey: z.string().trim(),
  types: z.array(z.object({
    partOfSpeech: z.string().min(1, 'Chọn loại từ'),
    accentLocale: z.string().trim().min(2, 'Nhập accent'),
    ipa: z.string().trim(),
    meanings: z.array(z.object({ cefrLevel: z.string().nullable(), coreDefinition: z.string().trim(), examples: z.array(example) })).min(1),
  })).min(1).refine((types) => new Set(types.map((t) => t.partOfSpeech)).size === types.length, 'Mỗi loại từ chỉ xuất hiện một lần'),
})
type Values = z.infer<typeof schema>

const emptyMeaning = () => ({ cefrLevel: null, coreDefinition: '', examples: [{ sourceText: '', target: '' }] })
const emptyType = () => ({ partOfSpeech: '', accentLocale: 'en-US', ipa: '', meanings: [emptyMeaning()] })

function toRequest(values: Values) {
  return {
    lemma: values.lemma,
    ...(values.homographKey && { homographKey: values.homographKey }),
    types: values.types.map((type) => ({
      partOfSpeech: type.partOfSpeech,
      pronunciations: [{ accentLocale: type.accentLocale, ...(type.ipa && { ipa: type.ipa }) }],
      meanings: type.meanings.map((meaning) => ({
        ...(meaning.cefrLevel && { cefrLevel: meaning.cefrLevel }),
        ...(meaning.coreDefinition && { coreDefinition: meaning.coreDefinition }),
        examples: meaning.examples.map((e) => ({ sourceText: e.sourceText, targetLocator: locateTarget(e.sourceText, e.target) })),
      })),
    })),
  }
}

const FieldError = ({ message }: { message?: string }) => (message ? <p className="text-xs text-destructive">{message}</p> : null)

interface NestedProps {
  control: Control<Values>
  register: UseFormRegister<Values>
  errors: FieldErrors<Values>
  typeIndex: number
}

function ExamplesFields({ control, register, errors, typeIndex, meaningIndex }: NestedProps & { meaningIndex: number }) {
  const { fields, append, remove } = useFieldArray({ control, name: `types.${typeIndex}.meanings.${meaningIndex}.examples` })
  const fieldErrors = errors.types?.[typeIndex]?.meanings?.[meaningIndex]?.examples
  return (
    <div className="grid gap-3">
      <Label>Ví dụ</Label>
      {fields.map((field, index) => (
        <div key={field.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_12rem_auto]">
          <div className="grid gap-1">
            <Input placeholder="Câu ví dụ" aria-label="Câu ví dụ" {...register(`types.${typeIndex}.meanings.${meaningIndex}.examples.${index}.sourceText`)} />
            <FieldError message={fieldErrors?.[index]?.sourceText?.message} />
          </div>
          <div className="grid gap-1">
            <Input placeholder="Từ tô sáng" aria-label="Từ tô sáng trong câu" {...register(`types.${typeIndex}.meanings.${meaningIndex}.examples.${index}.target`)} />
            <FieldError message={fieldErrors?.[index]?.target?.message} />
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Xoá ví dụ" onClick={() => remove(index)}><Trash2 /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => append({ sourceText: '', target: '' })}><Plus /> Thêm ví dụ</Button>
    </div>
  )
}

function MeaningsFields({ control, register, errors, typeIndex }: NestedProps) {
  const meta = useMeta()
  const { fields, append, remove } = useFieldArray({ control, name: `types.${typeIndex}.meanings` })
  return (
    <div className="grid gap-4">
      {fields.map((field, index) => (
        <div key={field.id} className="grid gap-3 rounded-lg bg-muted/40 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Nghĩa {index + 1}</p>
            {fields.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label="Xoá nghĩa" onClick={() => remove(index)}><Trash2 /></Button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <div className="grid gap-1.5">
              <Label>CEFR</Label>
              <Controller
                control={control}
                name={`types.${typeIndex}.meanings.${index}.cefrLevel`}
                render={({ field: cefr }) => <AppSelect options={toOptions(meta.cefrLevels)} value={cefr.value} onChange={cefr.onChange} clearLabel="Chưa chọn" />}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`def-${typeIndex}-${index}`}>Định nghĩa gốc (tuỳ chọn)</Label>
              <Textarea id={`def-${typeIndex}-${index}`} rows={1} {...register(`types.${typeIndex}.meanings.${index}.coreDefinition`)} />
            </div>
          </div>
          <ExamplesFields control={control} register={register} errors={errors} typeIndex={typeIndex} meaningIndex={index} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => append(emptyMeaning())}><Plus /> Thêm nghĩa</Button>
    </div>
  )
}

export function WordNewPage() {
  const meta = useMeta()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const { control, register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { lemma: '', homographKey: '', types: [emptyType()] },
  })
  const types = useFieldArray({ control, name: 'types' })

  const submit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const { wordId } = await api<{ wordId: string }>('/admin/words', { method: 'POST', body: toRequest(values) })
      await client.invalidateQueries({ queryKey: ['words'] })
      navigate(`/words/${wordId}`)
    } catch (error) {
      const { title, detail } = describeError(error)
      if (error instanceof Error && 'code' in error && error.code === 'WORD_ALREADY_EXISTS') setError('lemma', { message: title })
      else setFormError(detail ? `${title} ${detail}` : title)
    }
  })

  return (
    <>
      <PageHeader title="Thêm từ" description="Sau khi tạo, thêm bản dịch theo locale ở trang chi tiết rồi publish." back="/words" />
      <form onSubmit={submit} className="grid gap-6" noValidate>
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="lemma">Từ</Label>
              <Input id="lemma" aria-invalid={!!errors.lemma} {...register('lemma')} />
              <FieldError message={errors.lemma?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="homographKey">Khoá đồng hình (tuỳ chọn)</Label>
              <Input id="homographKey" {...register('homographKey')} />
              <p className="text-xs text-muted-foreground">Chỉ cần khi hai từ khác nhau viết giống nhau.</p>
            </div>
          </CardContent>
        </Card>

        {types.fields.map((field, index) => (
          <Card key={field.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Loại từ {index + 1}</CardTitle>
              {types.fields.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label="Xoá loại từ" onClick={() => types.remove(index)}><Trash2 /></Button>}
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label>Loại từ</Label>
                  <Controller
                    control={control}
                    name={`types.${index}.partOfSpeech`}
                    render={({ field: pos }) => <AppSelect options={toOptions(meta.partsOfSpeech)} value={pos.value || null} onChange={(v) => pos.onChange(v ?? '')} placeholder="Chọn" />}
                  />
                  <FieldError message={errors.types?.[index]?.partOfSpeech?.message} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`accent-${index}`}>Accent</Label>
                  <Input id={`accent-${index}`} {...register(`types.${index}.accentLocale`)} />
                  <FieldError message={errors.types?.[index]?.accentLocale?.message} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`ipa-${index}`}>IPA</Label>
                  <Input id={`ipa-${index}`} {...register(`types.${index}.ipa`)} />
                </div>
              </div>
              <MeaningsFields control={control} register={register} errors={errors} typeIndex={index} />
            </CardContent>
          </Card>
        ))}
        <FieldError message={errors.types?.root?.message ?? errors.types?.message} />
        <Button type="button" variant="outline" className="w-fit" onClick={() => types.append(emptyType())}><Plus /> Thêm loại từ</Button>
        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
        <div><Button type="submit" disabled={isSubmitting}>Tạo từ</Button></div>
      </form>
    </>
  )
}
