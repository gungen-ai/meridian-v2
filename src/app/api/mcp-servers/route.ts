import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/backend/supabase/server'
import { generateMcpToken } from '@/backend/mcp-token'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('mcp_servers')
    .select('*')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Hydrate tag metadata for each server
  const allTagIds = [...new Set((data ?? []).flatMap(s => s.tag_ids))]
  let tagMap: Record<string, any> = {}
  if (allTagIds.length > 0) {
    const { data: tags } = await supabase
      .from('tags')
      .select('id, name, category:categories(name, color)')
      .in('id', allTagIds)
    tagMap = Object.fromEntries((tags ?? []).map(t => [t.id, t]))
  }

  const enriched = (data ?? []).map(server => ({
    ...server,
    tags: server.tag_ids.map((id: string) => tagMap[id]).filter(Boolean),
  }))

  return NextResponse.json({ data: enriched })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!['mcp_owner', 'kb_admin', 'super_admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const {
    name, description, tag_ids = [],
    rate_limit_per_min = 60,
    rate_limit_per_day = 5000,
    search_only_mode = false,
    token_expires_at = null,
  } = body

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (tag_ids.length === 0) return NextResponse.json({ error: 'At least one tag is required' }, { status: 400 })

  // Create server record first to get the ID
  const { data: server, error: serverError } = await supabase
    .from('mcp_servers')
    .insert({
      name, description,
      tag_ids,
      rate_limit_per_min,
      rate_limit_per_day,
      search_only_mode,
      token_expires_at: token_expires_at || null,
      created_by: user.id,
      owner_id: user.id,
      status: 'provisioning',
    })
    .select()
    .single()

  if (serverError) return NextResponse.json({ error: serverError.message }, { status: 400 })

  // Generate scoped JWT token
  const { raw, hash, prefix } = await generateMcpToken({
    mcp_server_id: server.id,
    tag_ids,
    search_only: search_only_mode,
    expires_at: token_expires_at,
  })

  // Store token hash (never the raw token)
  await supabase
    .from('mcp_servers')
    .update({ token_hash: hash, token_prefix: prefix, status: 'active' })
    .eq('id', server.id)

  // Audit log
  await supabase.from('audit_events').insert({
    event_type: 'mcp_server_created',
    entity_type: 'mcp_server',
    entity_id: server.id,
    actor_id: user.id,
    metadata: { name, tag_count: tag_ids.length },
  })

  return NextResponse.json({
    data: { ...server, status: 'active', token_prefix: prefix },
    raw_token: raw, // only returned at creation
  }, { status: 201 })
}
