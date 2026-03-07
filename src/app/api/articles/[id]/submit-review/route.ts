import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateReviewerBrief } from '@/lib/claude'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { reviewer_id } = body

  if (!reviewer_id) return NextResponse.json({ error: 'reviewer_id required' }, { status: 400 })

  // Fetch article
  const { data: article } = await supabase
    .from('articles')
    .select('title, content_text, article_tags(tag_id)')
    .eq('id', id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  // Transition article to in_review
  await supabase.from('articles').update({ status: 'in_review' }).eq('id', id)

  // Fetch related articles for the reviewer brief (articles with same tags)
  const tagIds = (article.article_tags as any[]).map((at: any) => at.tag_id)
  let relatedArticles: any[] = []
  if (tagIds.length > 0) {
    const { data } = await supabase
      .from('articles')
      .select('title, content_text')
      .eq('status', 'published')
      .neq('id', id)
      .in('id',
        supabase.from('article_tags').select('article_id').in('tag_id', tagIds) as any
      )
      .limit(5)
    relatedArticles = data ?? []
  }

  // Generate reviewer brief via Claude
  let aiBrief = ''
  try {
    aiBrief = await generateReviewerBrief(
      { title: article.title, content_text: article.content_text },
      relatedArticles
    )
  } catch (e) {
    console.error('Brief generation failed:', e)
  }

  // Create review task
  const { data: task, error } = await supabase
    .from('review_tasks')
    .insert({
      article_id: id,
      reviewer_id,
      status: 'awaiting',
      ai_brief: aiBrief,
    })
    .select('*, reviewer:profiles(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Audit
  await supabase.from('audit_events').insert({
    event_type: 'article_submitted_for_review', entity_type: 'article',
    entity_id: id, actor_id: user.id, metadata: { reviewer_id },
  })

  return NextResponse.json({ data: task }, { status: 201 })
}
