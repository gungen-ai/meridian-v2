import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/backend/supabase/server'
import { htmlToPlainText } from '@/agents/claude/claude'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('articles')
    .select('*, author:profiles!articles_author_id_fkey(*), owner:profiles!articles_owner_id_fkey(*), category:categories(*), article_tags(*, tag:tags(*, category:categories(*)))')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, content, category_id, owner_id, tag_ids, change_summary } = body

  const updates: Record<string, unknown> = {}
  if (title !== undefined) updates.title = title
  if (content !== undefined) {
    updates.content = content
    updates.content_text = htmlToPlainText(content)
  }
  if (category_id !== undefined) updates.category_id = category_id
  if (owner_id !== undefined) updates.owner_id = owner_id

  const { data: article, error } = await supabase
    .from('articles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Save new version
  const { data: versionNum } = await supabase.rpc('next_version_number', { p_article_id: id })
  await supabase.from('article_versions').insert({
    article_id: id,
    version_number: versionNum,
    title: article.title,
    content: article.content,
    content_text: article.content_text,
    status: article.status,
    editor_id: user.id,
    change_summary: change_summary ?? 'Updated',
  })

  // Update tags if provided
  if (tag_ids !== undefined) {
    await supabase.from('article_tags').delete().eq('article_id', id)
    if (tag_ids.length > 0) {
      await supabase.from('article_tags').insert(
        tag_ids.map((tagId: string) => ({
          article_id: id,
          tag_id: tagId,
          assigned_by: 'manual',
          assigned_user_id: user.id,
        }))
      )
    }
  }

  // Audit log
  await supabase.from('audit_events').insert({
    event_type: 'article_updated',
    entity_type: 'article',
    entity_id: id,
    actor_id: user.id,
    metadata: { change_summary: change_summary ?? 'Updated' },
  })

  return NextResponse.json({ data: article })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('articles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.from('audit_events').insert({
    event_type: 'article_deleted', entity_type: 'article',
    entity_id: id, actor_id: user.id, metadata: {},
  })

  return NextResponse.json({ success: true })
}
