'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ClipboardList,
  GraduationCap,
  Users,
  Megaphone,
  User,
  LogOut,
  Menu,
  X,
  CalendarDays,
  Star,
  BookOpen,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export function Sidebar() {
  const { profile } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isTeacher = profile?.role === 'teacher'

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/giris')
    toast.success('Çıkış yapıldı')
  }

  const teacherLinks = [
    { href: '/panel', label: 'Kontrol Paneli', icon: LayoutDashboard },
    { href: '/panel/derslerim', label: 'Derslerim', icon: BookOpen },
    { href: '/panel/odev-yonetimi', label: 'Ödev Yönetimi', icon: ClipboardList },
    { href: '/panel/duyurular', label: 'Duyurular', icon: Megaphone },
    { href: '/panel/uyeler', label: 'Üye Yönetimi', icon: Users },
    { href: '/panel/profil', label: 'Profilim', icon: User },
  ]

  const studentLinks = [
    { href: '/panel', label: 'Kontrol Paneli', icon: LayoutDashboard },
    { href: '/panel/odevlerim', label: 'Ödevlerim', icon: ClipboardList },
    { href: '/panel/notlarim', label: 'Notlarım', icon: Star },
    { href: '/panel/duyurular', label: 'Duyurular', icon: Megaphone },
    { href: '/panel/takvim', label: 'Ödev Takvimi', icon: CalendarDays },
    { href: '/panel/profil', label: 'Profilim', icon: User },
  ]

  const links = isTeacher ? teacherLinks : studentLinks

  const navContent = (
    <>
      <div className="p-6">
        <Link href="/panel" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">EduCampus</h1>
            <p className="text-xs text-gray-500">E-Öğrenme Platformu</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href || 
            (link.href !== '/panel' && pathname.startsWith(link.href))
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {link.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="mb-3 px-3">
          <p className="text-sm font-medium text-gray-900 truncate">{profile?.full_name}</p>
          <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
          <span className={cn(
            'mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium',
            isTeacher ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
          )}>
            {isTeacher ? 'Öğretmen' : 'Öğrenci'}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Çıkış Yap
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile menu button */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-gray-900">EduCampus</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg hover:bg-gray-100">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        {navContent}
      </aside>
    </>
  )
}
