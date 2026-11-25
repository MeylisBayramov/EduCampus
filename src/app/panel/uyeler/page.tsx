'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingSpinner } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { isDemoAccount, formatDate } from '@/lib/utils'
import type { Profile, UserRole } from '@/lib/types'
import { Users, Shield, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'

export default function MembersPage() {
  const { profile, loading: authLoading } = useAuth()
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('Üyeler yüklenirken bir hata oluştu')
      } else {
        setMembers(data ?? [])
      }
      setLoading(false)
    }

    if (profile?.role === 'teacher') {
      fetchMembers()
    }
  }, [profile, authLoading])

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return members.filter((member) => {
      const matchesRole = roleFilter === 'all' || member.role === roleFilter
      const matchesQuery =
        !query ||
        member.full_name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query)
      return matchesRole && matchesQuery
    })
  }, [members, searchQuery, roleFilter])

  const stats = useMemo(() => {
    const teachers = members.filter((m) => m.role === 'teacher').length
    const students = members.filter((m) => m.role === 'student').length
    return {
      total: members.length,
      teachers,
      students,
    }
  }, [members])

  const handleRoleChange = async (member: Profile) => {
    if (isDemoAccount(member.email)) {
      toast.error('Demo hesapların rolü değiştirilemez')
      return
    }

    const newRole: UserRole = member.role === 'teacher' ? 'student' : 'teacher'
    setUpdatingId(member.id)
    const supabase = createClient()

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', member.id)

    if (error) {
      toast.error('Rol güncellenirken bir hata oluştu')
    } else {
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
      )
      toast.success(
        `${member.full_name} kullanıcısının rolü ${newRole === 'teacher' ? 'Öğretmen' : 'Öğrenci'} olarak güncellendi`
      )
    }
    setUpdatingId(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    if (isDemoAccount(deleteTarget.email)) {
      toast.error('Demo hesaplar silinemez')
      setDeleteTarget(null)
      return
    }

    setDeleting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', deleteTarget.id)

    if (error) {
      toast.error('Üye silinirken bir hata oluştu')
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== deleteTarget.id))
      toast.success(`${deleteTarget.full_name} başarıyla silindi`)
      setDeleteTarget(null)
    }
    setDeleting(false)
  }

  if (authLoading || !profile) {
    return <LoadingSpinner />
  }

  if (profile.role !== 'teacher') {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={<Shield className="h-8 w-8 text-red-500" />}
            title="Erişim Yetkisi Yok"
            description="Bu sayfaya yalnızca öğretmenler erişebilir."
          />
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Üye Yönetimi</h1>
        <p className="text-gray-500 mt-1">
          Platformdaki tüm kullanıcıları görüntüleyin, rollerini yönetin veya hesapları kaldırın.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Toplam Üye</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="bg-blue-500 rounded-xl p-3">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Öğretmenler</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.teachers}</p>
              </div>
              <div className="bg-purple-500 rounded-xl p-3">
                <Shield className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Öğrenciler</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.students}</p>
              </div>
              <div className="bg-green-500 rounded-xl p-3">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-blue-600" />
            Kullanıcı Listesi ({filteredMembers.length})
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Ad veya e-posta ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant={roleFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRoleFilter('all')}
              >
                Tümü
              </Button>
              <Button
                type="button"
                variant={roleFilter === 'teacher' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRoleFilter('teacher')}
              >
                Öğretmen
              </Button>
              <Button
                type="button"
                variant={roleFilter === 'student' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRoleFilter('student')}
              >
                Öğrenci
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredMembers.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8 text-gray-400" />}
              title="Üye bulunamadı"
              description="Arama kriterlerinize uygun kullanıcı bulunamadı."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="py-3 px-4">Ad Soyad</th>
                    <th className="py-3 px-4">E-posta</th>
                    <th className="py-3 px-4">Rol</th>
                    <th className="py-3 px-4">Kayıt Tarihi</th>
                    <th className="py-3 px-4 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {filteredMembers.map((member) => {
                    const isDemo = isDemoAccount(member.email)
                    const isUpdating = updatingId === member.id
                    return (
                      <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-gray-900">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{member.full_name}</span>
                            {isDemo && (
                              <Badge variant="warning">Demo</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-600">{member.email}</td>
                        <td className="py-3.5 px-4">
                          {member.role === 'teacher' ? (
                            <Badge className="bg-purple-100 text-purple-800">Öğretmen</Badge>
                          ) : (
                            <Badge variant="success">Öğrenci</Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                          {formatDate(member.created_at)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isDemo || isUpdating}
                              onClick={() => handleRoleChange(member)}
                              title={
                                isDemo
                                  ? 'Demo hesapların rolü değiştirilemez'
                                  : member.role === 'teacher'
                                    ? 'Öğrenci Yap'
                                    : 'Öğretmen Yap'
                              }
                            >
                              <Shield className="h-4 w-4" />
                              {isUpdating
                                ? 'Güncelleniyor...'
                                : member.role === 'teacher'
                                  ? 'Öğrenci Yap'
                                  : 'Öğretmen Yap'}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={isDemo || isUpdating}
                              onClick={() => setDeleteTarget(member)}
                              title={
                                isDemo ? 'Demo hesaplar silinemez' : 'Üyeyi Sil'
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                              Sil
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) setDeleteTarget(null)
        }}
        onConfirm={handleDeleteConfirm}
        title="Üyeyi Sil"
        description={`${deleteTarget?.full_name ?? ''} (${deleteTarget?.email ?? ''}) kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Sil"
        cancelText="İptal"
        variant="destructive"
        loading={deleting}
      />
    </div>
  )
}
