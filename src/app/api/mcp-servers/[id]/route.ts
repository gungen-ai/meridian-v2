import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/backend/supabase/server'
import { generateMcpToken } from '@/backend/mcp-token'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: server, error } = await supabase
    .from('mcp_servers').select('*').eq('id', id).single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Hydrate tags
  let tags: any[] = []
  if (server.tag_ids?.length > 0) {
    const { data } = await supabase
      .from('tags').select('id, name, category:categories(name, color)')
      .in('id', server.tag_ids)
    tags = data ?? []
  }

  // Recent query log
  const { data: queryLog } = await supabase
    .from('mcp_query_log')
    .select('*')
    .eq('mcp_server_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ data: { ...server, tags }, query_log: queryLog ?? [] })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, description, tag_ids, status, rate_limit_per_min, rate_limit_per_day, search_only_mode } = body

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description
  if (status !== undefined) updates.status = status
  if (rate_limit_per_min !== undefined) updates.rate_limit_per_min = rate_limit_per_min
  if (rate_limit_per_day !== undefined) updates.rate_limit_per_day = rate_limit_per_day
  if (search_only_mode !== undefined) updates.search_only_mode = search_only_mode

  // If tag_ids are changing, re-issue the token
  let raw_token: string | null = null
  if (tag_ids !== undefined) {
    updates.tag_ids = tag_ids

    const { data: current } = await supabase
      .from('mcp_servers').select('search_only_mode, token_expires_at').eq('id', id).single()

    const { raw, hash, prefix } = await generateMcpToken({
      mcp_server_id: id,
      tag_ids,
      search_only: current?.search_only_mode ?? false,
      expires_at: current?.token_expires_at ?? null,
    })
    updates.token_hash = hash
    updates.token_prefix = prefix
    raw_token = raw

    await supabase.from('audit_events').insert({
      event_type: 'mcp_server_rescoped',
      entity_type: 'mcp_server', entity_id: id,
      actor_id: user.id, metadata: { new_tag_count: tag_ids.length },
    })
  }

  const { data, error } = await supabase
    .from('mcp_servers').update(updates).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ data, ...(raw_token ? { raw_token } : {}) })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('mcp_servers').update({ status: 'deleted' }).eq('id', id)
  await supabase.from('audit_events').insert({
    event_type: 'mcp_server_deleted', entity_type: 'mcp_server',
    entity_id: id, actor_id: user.id, metadata: {},
  })

  return NextResponse.json({ success: true })
}
