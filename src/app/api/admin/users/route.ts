import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { isDemoAccount } from '@/lib/utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['student', 'teacher']),
})

const deleteUserSchema = z.object({
  userId: z.string().uuid(),
})

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'teacher') {
      return NextResponse.json({ error: 'Bu işlem için öğretmen yetkisi gerekiyor' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateRoleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz istek verisi' }, { status: 400 })
    }

    const { userId, role } = parsed.data
    const adminClient = await createServiceRoleClient()

    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    if (isDemoAccount(targetProfile.email)) {
      return NextResponse.json(
        { error: 'Demo hesapların rolü değiştirilemez' },
        { status: 403 }
      )
    }

    const { error } = await adminClient
      .from('profiles')
      .update({ role })
      .eq('id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sunucu hatası'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = deleteUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz kullanıcı ID' }, { status: 400 })
    }

    const { userId } = parsed.data
    const adminClient = await createServiceRoleClient()

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isSelf = user.id === userId
    const isTeacher = callerProfile?.role === 'teacher'

    if (!isSelf && !isTeacher) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    if (isDemoAccount(targetProfile.email)) {
      return NextResponse.json(
        { error: 'Demo hesaplar silinemez' },
        { status: 403 }
      )
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sunucu hatası'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
