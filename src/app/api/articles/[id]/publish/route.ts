import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/backend/supabase/server'
import { generateEmbedding } from '@/agents/claude/embeddings'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check user role
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['kb_admin', 'super_admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Only KB Admins can publish articles' }, { status: 403 })
  }

  const { data: article, error } = await supabase
    .from('articles')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      last_reviewed_at: new Date().toISOString(),
      freshness_score: 100,
      freshness_label: 'fresh',
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Save published version
  const { data: versionNum } = await supabase.rpc('next_version_number', { p_article_id: id })
  await supabase.from('article_versions').insert({
    article_id: id,
    version_number: versionNum,
    title: article.title,
    content: article.content,
    content_text: article.content_text,
    status: 'published',
    editor_id: user.id,
    change_summary: 'Published',
  })

  await supabase.from('audit_events').insert({
    event_type: 'article_published', entity_type: 'article',
    entity_id: id, actor_id: user.id, metadata: {},
  })

  // Generate and store embedding asynchronously — don't block the publish response
  const embeddingText = `${article.title} ${article.content_text}`
  generateEmbedding(embeddingText)
    .then(embedding => {
      const service = createServiceClient()
      return service.from('articles').update({ embedding }).eq('id', id)
    })
    .catch(err => console.error('Failed to generate embedding for article', id, err))

  return NextResponse.json({ data: article })
}
