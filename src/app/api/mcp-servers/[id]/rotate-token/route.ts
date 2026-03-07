import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMcpToken } from '@/lib/mcp-token'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: server } = await supabase
    .from('mcp_servers')
    .select('tag_ids, search_only_mode, token_expires_at')
    .eq('id', id).single()

  if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 })

  const { raw, hash, prefix } = await generateMcpToken({
    mcp_server_id: id,
    tag_ids: server.tag_ids,
    search_only: server.search_only_mode,
    expires_at: server.token_expires_at,
  })

  await supabase.from('mcp_servers')
    .update({ token_hash: hash, token_prefix: prefix })
    .eq('id', id)

  await supabase.from('audit_events').insert({
    event_type: 'mcp_token_rotated', entity_type: 'mcp_server',
    entity_id: id, actor_id: user.id, metadata: {},
  })

  return NextResponse.json({ raw_token: raw, token_prefix: prefix })
}
