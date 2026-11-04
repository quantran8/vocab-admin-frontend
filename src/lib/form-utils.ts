export interface Option {
  value: string
  label: string
}

export const toOptions = (values: readonly string[], label: (value: string) => string = (v) => v): Option[] =>
  values.map((value) => ({ value, label: label(value) }))

export function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text)
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export const formatJson = (value: unknown) => JSON.stringify(value, null, 2)
