'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { GraduationCap, LogIn, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? 'Lütfen giriş bilgilerinizi kontrol edin.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error('Giriş başarısız. E-posta veya şifre hatalı.')
      setLoading(false)
      return
    }

    toast.success('Giriş başarılı!')
    router.push('/panel')
    router.refresh()
  }

  const quickLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail)
    setPassword(demoPassword)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword,
    })

    if (error) {
      toast.error('Demo giriş başarısız.')
      setLoading(false)
      return
    }

    toast.success('Giriş başarılı!')
    router.push('/panel')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <GraduationCap className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">EduCampus</h1>
          <p className="text-gray-500 mt-1">E-Öğrenme Platformu</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Giriş Yap</CardTitle>
            <CardDescription>Hesabınıza giriş yaparak devam edin</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  E-posta
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Şifre
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                Giriş Yap
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-gray-500">
              Hesabınız yok mu?{' '}
              <Link href="/kayit" className="text-blue-600 hover:underline font-medium">
                Kayıt Ol
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Demo hesaplar */}
        <Card className="mt-4">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-gray-700 mb-3 text-center">Hızlı Demo Giriş</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => quickLogin('ogretmen@demo.com', 'Demo1234')}
                disabled={loading}
                className="flex flex-col items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm hover:bg-purple-100 transition-colors disabled:opacity-50"
              >
                <span className="font-medium text-purple-800">👩‍🏫 Öğretmen</span>
                <span className="text-xs text-purple-600">ogretmen@demo.com</span>
                <span className="text-xs text-purple-500">Şifre: Demo1234</span>
              </button>
              <button
                onClick={() => quickLogin('ogrenci@demo.com', 'Demo1234')}
                disabled={loading}
                className="flex flex-col items-center gap-1 rounded-lg border border-green-200 bg-green-50 p-3 text-sm hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                <span className="font-medium text-green-800">👨‍🎓 Öğrenci</span>
                <span className="text-xs text-green-600">ogrenci@demo.com</span>
                <span className="text-xs text-green-500">Şifre: Demo1234</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
