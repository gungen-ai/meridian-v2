import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/backend/supabase/server'
import { generateArticleDraft, htmlToPlainText } from '@/agents/claude/claude'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action, mcp_server_id } = body
  // action: 'add_to_scope' | 'create_article' | 'dismiss'

  const { data: gap } = await supabase
    .from('knowledge_gaps')
    .select('*, mcp_server:mcp_servers(*)')
    .eq('id', id)
    .single()

  if (!gap) return NextResponse.json({ error: 'Gap not found' }, { status: 404 })

  if (action === 'dismiss') {
    await supabase.from('knowledge_gaps').update({
      status: 'dismissed',
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_action: 'dismissed',
    }).eq('id', id)
    return NextResponse.json({ success: true })
  }

  if (action === 'add_to_scope') {
    // Type A: add the candidate article's tags to the MCP server scope
    if (!gap.candidate_article_id) {
      return NextResponse.json({ error: 'No candidate article for type_a resolution' }, { status: 400 })
    }

    const { data: articleTags } = await supabase
      .from('article_tags')
      .select('tag_id')
      .eq('article_id', gap.candidate_article_id)

    const newTagIds = (articleTags ?? []).map(t => t.tag_id)
    const { data: server } = await supabase
      .from('mcp_servers').select('tag_ids').eq('id', gap.mcp_server_id).single()

    const mergedTagIds = [...new Set([...(server?.tag_ids ?? []), ...newTagIds])]

    await supabase.from('mcp_servers').update({ tag_ids: mergedTagIds }).eq('id', gap.mcp_server_id)
    await supabase.from('knowledge_gaps').update({
      status: 'resolved',
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_action: 'added_to_scope',
      resolution_article_id: gap.candidate_article_id,
    }).eq('id', id)

    return NextResponse.json({ success: true, merged_tag_count: mergedTagIds.length })
  }

  if (action === 'create_article') {
    // Type B: create an AI-drafted article from the gap
    const title = gap.suggested_title ?? gap.query_text

    // Find related articles for context
    const { data: related } = await supabase
      .from('articles')
      .select('title, content_text')
      .eq('status', 'published')
      .limit(5)

    const draft = await generateArticleDraft(title, 'General', related ?? [])
    const contentText = htmlToPlainText(draft.content)

    const { data: article, error } = await supabase
      .from('articles')
      .insert({
        title: draft.title,
        content: `<!-- AI_GENERATED -->${draft.content}`,
        content_text: contentText,
        author_id: user.id,
        owner_id: user.id,
        status: 'draft',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await supabase.from('article_versions').insert({
      article_id: article.id, version_number: 1,
      title: article.title, content: article.content,
      content_text: article.content_text, status: 'draft',
      editor_id: user.id, change_summary: 'AI-generated from knowledge gap',
    })

    await supabase.from('knowledge_gaps').update({
      status: 'resolved',
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_action: 'article_created',
      resolution_article_id: article.id,
    }).eq('id', id)

    return NextResponse.json({ success: true, article_id: article.id })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
