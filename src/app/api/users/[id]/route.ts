import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['kb_admin', 'super_admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  }

  // Prevent super_admin from being demoted by non-super_admin
  const { data: target } = await supabase.from('profiles').select('role').eq('id', id).single()
  if (target?.role === 'super_admin' && profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Cannot modify a super admin' }, { status: 403 })
  }

  const body = await request.json()
  const { role } = body
  const validRoles = ['viewer', 'editor', 'kb_admin', 'mcp_owner', 'super_admin']
  if (!validRoles.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const { data, error } = await supabase
    .from('profiles').update({ role }).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.from('audit_events').insert({
    event_type: 'user_role_changed', entity_type: 'profile', entity_id: id,
    actor_id: user.id, metadata: { new_role: role },
  })

  return NextResponse.json({ data })
}
