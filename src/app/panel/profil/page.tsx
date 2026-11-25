'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { TipTapEditor } from '@/components/tiptap-editor'
import { RichTextContent } from '@/components/rich-text-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { profileSchema } from '@/lib/validations'
import { formatDate, isDemoAccount } from '@/lib/utils'
import { toast } from 'sonner'
import {
  User,
  Mail,
  Shield,
  Calendar,
  Pencil,
  Save,
  X,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const router = useRouter()

  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState('')
  const [about, setAbout] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!profile) return null

  const isTeacher = profile.role === 'teacher'
  const demoAccount = isDemoAccount(profile.email)

  const handleStartEdit = () => {
    setFullName(profile.full_name)
    setAbout(profile.about ?? '')
    setEditing(true)
  }

  const handleCancelEdit = () => {
    setFullName(profile.full_name)
    setAbout(profile.about ?? '')
    setEditing(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanedAbout = about === '<p></p>' ? '' : about
    const result = profileSchema.safeParse({
      full_name: fullName.trim(),
      about: cleanedAbout ? cleanedAbout : null,
    })

    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? 'Lütfen alanları kontrol edin.')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: result.data.full_name,
        about: result.data.about ?? null,
      })
      .eq('id', profile.id)

    if (error) {
      toast.error('Profil güncellenirken bir hata oluştu.')
      setSaving(false)
      return
    }

    await refreshProfile()
    toast.success('Profil başarıyla güncellendi.')
    setSaving(false)
    setEditing(false)
  }

  const handleDeleteAccount = async () => {
    if (demoAccount) {
      toast.error('Demo hesapları silinemez.')
      setDeleteDialogOpen(false)
      return
    }

    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profile.id)

    if (error) {
      toast.error('Hesap silinirken bir hata oluştu.')
      setDeleting(false)
      return
    }

    await supabase.auth.signOut()
    toast.success('Hesabınız başarıyla silindi.')
    router.push('/giris')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profilim</h1>
        <p className="text-gray-500 mt-1">Hesap bilgilerinizi görüntüleyin ve düzenleyin</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <User className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg">Profil Bilgileri</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={isTeacher ? 'default' : 'success'}>
                  {isTeacher ? 'Öğretmen' : 'Öğrenci'}
                </Badge>
                {demoAccount && (
                  <Badge variant="warning">Demo Hesap</Badge>
                )}
              </div>
            </div>
          </div>

          {!editing && (
            <Button variant="outline" size="sm" onClick={handleStartEdit}>
              <Pencil className="h-4 w-4" />
              Düzenle
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Ad Soyad
                </label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Adınız Soyadınız"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  E-posta
                </label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">E-posta adresi değiştirilemez.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hakkımda
                </label>
                <TipTapEditor
                  content={about}
                  onChange={setAbout}
                  placeholder="Kendiniz hakkında kısa bir bilgi yazın..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  <X className="h-4 w-4" />
                  İptal
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Değişiklikleri Kaydet
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <User className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500">Ad Soyad</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5 break-words">
                      {profile.full_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <Mail className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500">E-posta</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5 break-all">
                      {profile.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <Shield className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-gray-500">Rol</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">
                      {isTeacher ? 'Öğretmen' : 'Öğrenci'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-gray-500">Kayıt Tarihi</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">
                      {formatDate(profile.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Hakkımda</h4>
                {profile.about && profile.about !== '<p></p>' ? (
                  <div className="rounded-lg bg-gray-50 p-4">
                    <RichTextContent content={profile.about} />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    Henüz hakkınızda bir bilgi eklenmemiş.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-lg text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Hesabı Sil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                Hesabınızı sildiğinizde tüm profil bilgileriniz kalıcı olarak kaldırılır. Bu işlem geri alınamaz.
              </p>
              {demoAccount && (
                <p className="text-xs font-medium text-amber-600">
                  Demo hesapları güvenlik nedeniyle silinemez.
                </p>
              )}
            </div>
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={demoAccount || deleting}
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4" />
              Hesabımı Sil
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Hesabı Sil"
        description="Hesabınızı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        confirmText="Evet, Hesabımı Sil"
        cancelText="İptal"
        variant="destructive"
        loading={deleting}
      />
    </div>
  )
}
