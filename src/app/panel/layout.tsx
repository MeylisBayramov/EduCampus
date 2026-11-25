'use client'

import { AuthProvider, useAuth } from '@/components/auth-provider'
import { Sidebar } from '@/components/sidebar'
import { LoadingSpinner } from '@/components/ui/loading'

function PanelContent({ children }: { children: React.ReactNode }) {
  const { loading, profile } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Profil yükleniyor..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:pl-72 pt-16 lg:pt-0">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PanelContent>{children}</PanelContent>
    </AuthProvider>
  )
}
