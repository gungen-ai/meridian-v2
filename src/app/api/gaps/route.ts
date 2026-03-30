import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/backend/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'open'
  const gapType = searchParams.get('gap_type')

  let query = supabase
    .from('knowledge_gaps')
    .select(`
      *,
      mcp_server:mcp_servers(id, name),
      candidate_article:articles!knowledge_gaps_candidate_article_id_fkey(id, title),
      resolution_article:articles!knowledge_gaps_resolution_article_id_fkey(id, title),
      resolved_by_profile:profiles!knowledge_gaps_resolved_by_fkey(full_name)
    `)
    .eq('status', status)
    .order('recurrence_count', { ascending: false })
    .order('last_seen_at', { ascending: false })
    .limit(100)

  if (gapType) query = query.eq('gap_type', gapType)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
