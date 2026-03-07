import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyMcpToken } from '@/lib/mcp-token'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createServiceClient()

  const payload = await verifyMcpToken(token)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const articleId = searchParams.get('id')
  if (!articleId) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Verify server is active
  const { data: server } = await supabase
    .from('mcp_servers').select('id, status, total_queries').eq('id', payload.mcp_server_id).single()
  if (!server || server.status !== 'active') {
    return NextResponse.json({ error: 'MCP server inactive' }, { status: 404 })
  }

  // Fetch article — must be published AND in the scoped tag set
  const { data: article } = await supabase
    .from('articles')
    .select('id, title, content, content_text, published_at, updated_at, article_tags!inner(tag_id)')
    .eq('id', articleId)
    .eq('status', 'published')
    .in('article_tags.tag_id', payload.tag_ids)
    .single()

  if (!article) {
    // Distinguish: article exists but out of scope vs. doesn't exist at all
    const { data: exists } = await supabase
      .from('articles').select('id').eq('id', articleId).single()

    return NextResponse.json({
      error: exists ? 'Article exists but is outside this MCP server\'s scope' : 'Article not found',
      code: exists ? 'ARTICLE_OUT_OF_SCOPE' : 'ARTICLE_NOT_FOUND',
    }, { status: 403 })
  }

  // Log + update counter
  supabase.from('mcp_query_log').insert({
    mcp_server_id: server.id, tool_name: 'get',
    result_count: 1, latency_ms: 0,
  }).then(() => {
    supabase.from('mcp_servers').update({
      total_queries: (server.total_queries ?? 0) + 1,
      last_queried_at: new Date().toISOString(),
    }).eq('id', server.id)
  })

  return NextResponse.json({
    resource: {
      uri: `kb://articles/${article.id}`,
      title: article.title,
      description: article.content_text.slice(0, 200) + '…',
      content: article.content,      // full HTML
      content_text: article.content_text, // plain text
      last_updated_at: article.updated_at,
    }
  })
}
