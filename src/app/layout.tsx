import { AudioLines, BookOpen, Dumbbell, FolderTree, LogOut, Sparkles, Users } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar'
import { isFullAdmin, useSession } from '@/features/auth/use-session'
import { logout } from '@/lib/api'
import { queryClient } from '@/lib/query'

const NAV = [
  { to: '/words', label: 'Từ vựng', icon: BookOpen },
  { to: '/ai-review', label: 'Duyệt nghĩa AI', icon: Sparkles },
  { to: '/audio', label: 'Âm thanh', icon: AudioLines },
  { to: '/practice-items', label: 'Bài luyện', icon: Dumbbell },
  { to: '/catalog', label: 'Catalog', icon: FolderTree },
]

export function AppLayout() {
  const session = useSession()
  const { pathname } = useLocation()
  const items = isFullAdmin(session?.role) ? [...NAV, { to: '/users', label: 'Người dùng', icon: Users }] : NAV
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-4 py-3 font-semibold">Vocab Flow Admin</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton isActive={pathname.startsWith(to)} render={<NavLink to={to} />}>
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <p className="truncate px-2 text-xs text-muted-foreground">{session?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => {
              logout()
              queryClient.clear()
            }}
          >
            <LogOut /> Đăng xuất
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center border-b px-4 md:hidden">
          <SidebarTrigger aria-label="Mở menu" />
        </header>
        <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
