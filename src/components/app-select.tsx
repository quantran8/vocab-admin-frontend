import type { Option } from '@/lib/form-utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface AppSelectProps {
  options: Option[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  /** Adds an entry that clears the value, for filters and optional fields. */
  clearLabel?: string
  disabled?: boolean
  className?: string
  id?: string
}

const CLEAR = '__clear__'

export function AppSelect({ options, value, onChange, placeholder, clearLabel, disabled, className, id }: AppSelectProps) {
  const all = clearLabel ? [{ value: CLEAR, label: clearLabel }, ...options] : options
  return (
    <Select
      items={all}
      value={value ?? (clearLabel ? CLEAR : null)}
      disabled={disabled}
      onValueChange={(next) => onChange(next === CLEAR ? null : (next as string | null))}
    >
      <SelectTrigger id={id} className={className ?? 'w-full'}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {all.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
