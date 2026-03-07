import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyMcpToken } from '@/lib/mcp-token'
import { classifyGap } from '@/lib/intelligence'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const start = Date.now()
  const { token } = await params
  const supabase = createServiceClient()

  const payload = await verifyMcpToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })

  const { data: server } = await supabase
    .from('mcp_servers')
    .select('id, status, search_only_mode, total_queries')
    .eq('id', payload.mcp_server_id)
    .single()

  if (!server || server.status !== 'active') {
    return NextResponse.json({ error: 'MCP server not found or inactive' }, { status: 404 })
  }

  const body = await request.json()
  const { query, limit = 5 } = body
  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 })

  // Scoped search
  const { data: scopedArticles } = await supabase
    .from('articles')
    .select('id, title, content_text, updated_at, article_tags!inner(tag_id)')
    .eq('status', 'published')
    .in('article_tags.tag_id', payload.tag_ids)
    .textSearch('content_text', query.split(' ').filter(Boolean).join(' | '), { type: 'plain', config: 'english' })
    .limit(Math.min(limit, 10))

  let results = scopedArticles ?? []

  if (results.length === 0) {
    const { data: fallback } = await supabase
      .from('articles')
      .select('id, title, content_text, updated_at, article_tags!inner(tag_id)')
      .eq('status', 'published')
      .in('article_tags.tag_id', payload.tag_ids)
      .or(`title.ilike.%${query}%,content_text.ilike.%${query}%`)
      .limit(Math.min(limit, 10))
    results = fallback ?? []
  }

  const seen = new Set<string>()
  const unique = results.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true })
  const latency = Date.now() - start
  const isGap = unique.length === 0

  if (isGap) {
    detectAndRecordGap(supabase, server.id, query, payload.tag_ids).catch(console.error)
  }

  supabase.from('mcp_query_log').insert({
    mcp_server_id: server.id, tool_name: 'search', query_text: query,
    result_count: unique.length, top_confidence: unique.length > 0 ? 0.8 : 0, latency_ms: latency,
  }).then(() => {
    supabase.from('mcp_servers').update({
      total_queries: (server.total_queries ?? 0) + 1,
      last_queried_at: new Date().toISOString(),
    }).eq('id', server.id)
  })

  return NextResponse.json({
    resources: unique.map(a => ({
      uri: `kb://articles/${a.id}`,
      title: a.title,
      description: a.content_text.slice(0, 200) + '…',
      content: a.content_text,
      last_updated_at: a.updated_at,
    })),
    total: unique.length, query, latency_ms: latency,
  })
}

async function detectAndRecordGap(
  supabase: ReturnType<typeof createServiceClient>,
  serverId: string, query: string, tagIds: string[]
) {
  const { data: existing } = await supabase
    .from('knowledge_gaps')
    .select('id, recurrence_count')
    .eq('mcp_server_id', serverId)
    .eq('status', 'open')
    .ilike('query_text', query)
    .maybeSingle()

  if (existing) {
    await supabase.from('knowledge_gaps').update({
      recurrence_count: existing.recurrence_count + 1,
      last_seen_at: new Date().toISOString(),
    }).eq('id', existing.id)
    return
  }

  const { data: shadowResults } = await supabase
    .from('articles')
    .select('id, title, content_text')
    .eq('status', 'published')
    .or(`title.ilike.%${query}%,content_text.ilike.%${query}%`)
    .limit(5)

  const classification = await classifyGap(query, [], shadowResults ?? [])

  await supabase.from('knowledge_gaps').insert({
    mcp_server_id: serverId,
    query_text: query,
    gap_type: classification.gap_type,
    candidate_article_id: classification.candidate_article_id,
    suggested_title: classification.suggested_title,
    recurrence_count: 1,
    last_seen_at: new Date().toISOString(),
  })
}
