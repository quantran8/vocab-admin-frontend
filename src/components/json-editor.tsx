import { useId, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { parseJsonObject } from '@/lib/form-utils'

interface JsonEditorProps {
  label: string
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  rows?: number
}

export function JsonEditor({ label, value, onChange, readOnly, rows = 10 }: JsonEditorProps) {
  const id = useId()
  const [touched, setTouched] = useState(false)
  const invalid = touched && parseJsonObject(value) === null
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        aria-invalid={invalid}
        className="font-mono text-xs"
        onBlur={() => setTouched(true)}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {invalid && <p className="text-xs text-destructive">JSON không hợp lệ, cần là một object.</p>}
    </div>
  )
}
