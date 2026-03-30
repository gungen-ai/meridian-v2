import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/backend/supabase/server'
import { verifyMcpToken } from '@/backend/mcp-token'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createServiceClient()

  const payload = await verifyMcpToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { data: server } = await supabase
    .from('mcp_servers').select('id, status, search_only_mode, total_queries').eq('id', payload.mcp_server_id).single()

  if (!server || server.status !== 'active') {
    return NextResponse.json({ error: 'MCP server inactive' }, { status: 404 })
  }

  // search_only_mode blocks list enumeration
  if (server.search_only_mode) {
    return NextResponse.json({
      error: 'This MCP server is in search-only mode. Use the search endpoint.',
      code: 'SEARCH_ONLY_MODE',
    }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const tagId = searchParams.get('tag_id')
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = Math.min(parseInt(searchParams.get('page_size') ?? '20'), 50)
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('articles')
    .select(`
      id, title, content_text, published_at, updated_at,
      article_tags!inner(tag_id)
    `, { count: 'exact' })
    .eq('status', 'published')
    .in('article_tags.tag_id', payload.tag_ids)
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  // Optional: filter by a specific tag within scope
  if (tagId && payload.tag_ids.includes(tagId)) {
    query = query.eq('article_tags.tag_id', tagId)
  }

  const { data: articles, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Deduplicate
  const seen = new Set<string>()
  const unique = (articles ?? []).filter(a => {
    if (seen.has(a.id)) return false
    seen.add(a.id); return true
  })

  // Log
  supabase.from('mcp_query_log').insert({
    mcp_server_id: server.id, tool_name: 'list',
    result_count: unique.length, latency_ms: 0,
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
      last_updated_at: a.updated_at,
    })),
    pagination: {
      page, page_size: pageSize,
      total: count ?? 0,
      has_more: offset + pageSize < (count ?? 0),
    }
  })
}
