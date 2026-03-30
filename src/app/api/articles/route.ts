import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/backend/supabase/server'
import { htmlToPlainText } from '@/agents/claude/claude'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') ?? '20')

  let query = supabase
    .from('articles')
    .select('*, author:profiles!articles_author_id_fkey(*), category:categories(*), article_tags(*, tag:tags(*))')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, content, category_id, owner_id, tag_ids = [] } = body

  const contentText = htmlToPlainText(content ?? '')

  // Create the article
  const { data: article, error } = await supabase
    .from('articles')
    .insert({
      title: title || 'Untitled Article',
      content: content ?? '',
      content_text: contentText,
      author_id: user.id,
      owner_id: owner_id || user.id,
      category_id: category_id || null,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Save initial version
  await supabase.from('article_versions').insert({
    article_id: article.id,
    version_number: 1,
    title: article.title,
    content: article.content,
    content_text: article.content_text,
    status: 'draft',
    editor_id: user.id,
    change_summary: 'Initial draft',
  })

  // Attach tags
  if (tag_ids.length > 0) {
    await supabase.from('article_tags').insert(
      tag_ids.map((tagId: string) => ({
        article_id: article.id,
        tag_id: tagId,
        assigned_by: 'manual',
        assigned_user_id: user.id,
      }))
    )
  }

  // Audit log
  await supabase.from('audit_events').insert({
    event_type: 'article_created',
    entity_type: 'article',
    entity_id: article.id,
    actor_id: user.id,
    metadata: { title: article.title },
  })

  return NextResponse.json({ data: article }, { status: 201 })
}
