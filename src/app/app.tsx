import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AiReviewPage } from '@/features/ai-review/ai-review-page'
import { AudioPage } from '@/features/audio/audio-page'
import { LoginPage } from '@/features/auth/login-page'
import { isContentRole, isFullAdmin, useSession, useSessionRestore } from '@/features/auth/use-session'
import { CatalogPage, CollectionPage, TopicPage } from '@/features/catalog/catalog-pages'
import { ItemDetailPage, ItemNewPage, ItemsPage } from '@/features/practice-items/practice-item-pages'
import { UsersPage } from '@/features/users/users-page'
import { WordDetailPage } from '@/features/words/word-detail-page'
import { WordNewPage } from '@/features/words/word-new-page'
import { WordsPage } from '@/features/words/words-page'
import { logout } from '@/lib/api'
import { AppLayout } from './layout'

function FullAdminRoute() {
  const session = useSession()
  return isFullAdmin(session?.role) ? <UsersPage /> : <Navigate to="/words" replace />
}

const router = createBrowserRouter(
  [
    {
      element: <AppLayout />,
      children: [
        { index: true, element: <Navigate to="/words" replace /> },
        { path: 'words', element: <WordsPage /> },
        { path: 'words/new', element: <WordNewPage /> },
        { path: 'words/:id', element: <WordDetailPage /> },
        { path: 'ai-review', element: <AiReviewPage /> },
        { path: 'audio', element: <AudioPage /> },
        { path: 'practice-items', element: <ItemsPage /> },
        { path: 'practice-items/new', element: <ItemNewPage /> },
        { path: 'practice-items/:id', element: <ItemDetailPage /> },
        { path: 'catalog', element: <CatalogPage /> },
        { path: 'catalog/collections/:id', element: <CollectionPage /> },
        { path: 'catalog/topics/:id', element: <TopicPage /> },
        { path: 'users', element: <FullAdminRoute /> },
        { path: '*', element: <Navigate to="/words" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
)

export function App() {
  const session = useSession()
  const restoring = useSessionRestore()

  if (restoring) return <div className="p-8"><Skeleton className="h-8 w-64" /></div>
  if (!session) return <LoginPage />
  if (!isContentRole(session.role)) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-xl font-semibold">Không có quyền truy cập</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Tài khoản {session.email} chưa có quyền quản trị. Nếu vừa được cấp quyền, hãy đăng nhập lại.
        </p>
        <Button variant="outline" onClick={logout}>Đăng xuất</Button>
      </main>
    )
  }
  return <RouterProvider router={router} />
}
