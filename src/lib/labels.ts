const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  approved: 'Đã duyệt',
  published: 'Đã publish',
  retired: 'Đã retire',
  archived: 'Lưu trữ',
  curated: 'Biên tập',
  ai_generated: 'AI tạo',
  live: 'Đang live',
  recalled: 'Đã recall',
  admin: 'Admin',
  editor: 'Biên tập viên',
}

export const statusLabel = (status: string) => STATUS_LABELS[status] ?? status

export const SCOPE_LABELS: Record<string, string> = { all: 'Tất cả', shared: 'Dùng chung', private: 'Riêng tư' }

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}
