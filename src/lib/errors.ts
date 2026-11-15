import { ApiError } from './api'

const MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Phiên đăng nhập không hợp lệ hoặc sai thông tin đăng nhập.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND: 'Không tìm thấy dữ liệu, có thể đã bị xoá.',
  WORD_ALREADY_EXISTS: 'Từ này đã tồn tại.',
  DUPLICATE_CONTENT: 'Dữ liệu bị trùng.',
  CONTENT_LOCKED: 'Nội dung đang bị khoá, không thể sửa hoặc xoá.',
  CONTENT_UNAVAILABLE: 'Chỉ dùng được nghĩa dùng chung đã publish.',
  TASK_DATA_INVALID: 'Dữ liệu bài luyện không hợp lệ.',
  PUBLICATION_INVALID: 'Chưa đủ điều kiện publish.',
  PAYLOAD_TOO_LARGE: 'Dữ liệu gửi lên quá lớn.',
  AUTH_PROVIDER_UNAVAILABLE: 'Dịch vụ xác thực tạm thời không dùng được.',
  TTS_PROVIDER_UNAVAILABLE: 'Không tạo được âm thanh lúc này.',
  INTERNAL_ERROR: 'Lỗi máy chủ. Hãy thử lại sau.',
}

const DETAILS: Record<string, string> = {
  'CEFR level missing': 'Nghĩa chưa có cấp độ CEFR.',
  'Localized meaning or definition missing': 'Locale này chưa có nghĩa hoặc định nghĩa.',
  'Localization is not approved': 'Locale này chưa được chuyển sang trạng thái "Đã duyệt".',
  'IPA missing': 'Mọi phát âm của loại từ phải có IPA, và cần ít nhất một phát âm.',
  'No usable localized example': 'Cần ít nhất một ví dụ có bản dịch ở locale này và vị trí tô sáng hợp lệ.',
  'Only content that was never published can be deleted; recall it instead': 'Chỉ xoá được nội dung chưa từng publish. Hãy dùng recall.',
  'Lemma and homograph key are locked once a meaning was published': 'Không đổi được lemma khi từ đã có nghĩa từng publish.',
  'Still referenced by learner history, a topic or a practice item': 'Nội dung vẫn đang được dùng bởi lịch sử học, topic hoặc bài luyện.',
  'Only a draft can be changed; create a new revision with supersedesItemId': 'Chỉ sửa được bản nháp. Hãy tạo bản thay thế.',
  'A retired item cannot be published again; create a new revision': 'Không publish lại được bài đã retire. Hãy tạo bản thay thế.',
  'Item has no approved locale': 'Bài luyện cần ít nhất một locale đã duyệt.',
  'Item has no target': 'Bài luyện cần ít nhất một target.',
  'A private meaning can only be approved or recalled': 'Nghĩa riêng của người học chỉ có thể duyệt hoặc recall.',
  'Delete its topics first': 'Hãy xoá các topic trong collection trước.',
  'Only a draft can be deleted; archive it instead': 'Chỉ xoá được bản nháp. Hãy chuyển sang lưu trữ.',
  'The admin account cannot be changed': 'Không thể thay đổi tài khoản admin.',
  'SUPABASE_SERVICE_ROLE_KEY is not configured': 'Backend chưa cấu hình SUPABASE_SERVICE_ROLE_KEY.',
  'ElevenLabs is not configured': 'Backend chưa cấu hình ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID hoặc ELEVENLABS_MODEL_ID.',
  'Audio storage is not configured': 'Backend chưa cấu hình Cloudflare R2 (R2_*).',
  'Use pronunciationIds or wordIds, not both': 'Chỉ chọn theo phát âm hoặc theo từ, không chọn cả hai.',
}

export function describeError(error: unknown): { title: string; detail?: string } {
  if (!(error instanceof ApiError)) return { title: 'Không kết nối được tới máy chủ.' }
  const title = MESSAGES[error.code] ?? 'Yêu cầu không thành công.'
  const detail = DETAILS[error.message] ?? (error.message !== error.code ? error.message : undefined)
  const reference = error.status >= 500 && error.requestId ? `Mã yêu cầu: ${error.requestId}` : undefined
  return { title, detail: [detail, reference].filter(Boolean).join(' · ') || undefined }
}

/** Backend validation message format: `path.to.field: issue; other.field: issue`. */
export function parseFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_FAILED') return {}
  const fields: Record<string, string> = {}
  for (const part of error.message.split('; ')) {
    const separator = part.indexOf(': ')
    if (separator > 0) fields[part.slice(0, separator)] = part.slice(separator + 2)
  }
  return fields
}
