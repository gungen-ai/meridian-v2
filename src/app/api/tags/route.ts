import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/backend/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tags')
    .select('*, category:categories(*)')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['kb_admin', 'super_admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Only KB Admins can create tags' }, { status: 403 })
  }

  const body = await request.json()
  const { name, description, category_id } = body

  const { data, error } = await supabase
    .from('tags')
    .insert({ name, description, category_id, created_by: user.id })
    .select('*, category:categories(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
