# Vocab Flow Admin

Trang quản trị nội dung của Vocab Flow: từ vựng, duyệt nghĩa AI, bài luyện, catalog và người dùng.

React, Vite, TypeScript, Tailwind, shadcn/ui (Base UI), TanStack Query và Table, React Hook Form với zod. API nằm ở repo `vocab-backend`.

## Chạy ở local

Cần Node 22 trở lên, pnpm, và `vocab-backend` đang chạy.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Vite chuyển tiếp `/api` sang `VITE_DEV_BACKEND` (mặc định `http://localhost:3000`), nên backend không cần CORS.

## Lệnh

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Chạy dev server |
| `pnpm build` | Kiểm tra type và build ra `dist/` |
| `pnpm test` | Chạy test |
| `pnpm lint` | Chạy oxlint |

## Đăng nhập và quyền

- Đăng nhập bằng email và mật khẩu qua `/v1/auth/login` của backend. Tài khoản admin được tạo bằng `pnpm db:seed` ở backend và đăng nhập bằng tên `admin`.
- Quyền lấy từ `app_metadata.role` trong JWT: `editor` hoặc `admin`. Tài khoản khác thấy màn "không có quyền".
- Màn Người dùng chỉ dành cho `admin`, chỉ cấp hoặc gỡ được quyền `editor`, và cần `SUPABASE_SERVICE_ROLE_KEY` ở backend.
- Giao diện đọc role chỉ để ẩn hiện chức năng. Backend mới là nơi kiểm tra quyền.

## Âm thanh

Màn Âm thanh tạo audio phát âm hàng loạt qua `POST /admin/audio/generate` của backend (ElevenLabs, lưu trên Cloudflare R2), chạy từng lượt tới khi hết phát âm thiếu audio. Trang chi tiết từ có nút nghe, tạo audio còn thiếu cho từ, và tạo lại audio cho từng phát âm. Tab Thiếu audio liệt kê phát âm chưa có audio. Tab Cần publish lại liệt kê nghĩa đang live còn phát audio cũ; publish lại ở đây chỉ thay audio trong bản live, không đẩy các chỉnh sửa khác chưa publish.

Quy tắc khoá và xoá nội dung nằm ở mục "Admin CRUD" trong `docs/DECISIONS.md` của backend.

## Deploy

Chưa được thiết lập. Build là file tĩnh, cấu hình bằng:

| Biến | Ví dụ production | Ý nghĩa |
|---|---|---|
| `VITE_API_BASE_URL` | `/service/vocab` | URL backend theo góc nhìn của trình duyệt |
| `VITE_BASE_PATH` | `/service/vocab-admin/` | Đường dẫn phục vụ app |

Máy chủ tĩnh phải trả `index.html` cho các đường dẫn không phải file. Nếu app ở khác origin với backend, backend cần bật CORS (hiện chưa có).
