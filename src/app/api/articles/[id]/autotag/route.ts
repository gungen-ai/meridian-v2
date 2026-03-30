import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/backend/supabase/server'
import { generateTagSuggestions } from '@/agents/claude/claude'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch the article
  const { data: article } = await supabase
    .from('articles')
    .select('title, content_text')
    .eq('id', id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  // Fetch all active tags with their categories
  const { data: tags } = await supabase
    .from('tags')
    .select('*, category:categories(*)')
    .eq('status', 'active')

  if (!tags || tags.length === 0) return NextResponse.json({ data: [] })

  // Delete previous pending suggestions
  await supabase.from('tag_suggestions')
    .delete()
    .eq('article_id', id)
    .eq('status', 'pending')

  // Call Claude
  const suggestions = await generateTagSuggestions(
    article.title,
    article.content_text,
    tags as any
  )

  if (suggestions.length === 0) return NextResponse.json({ data: [] })

  // Store suggestions
  const { data: saved, error } = await supabase
    .from('tag_suggestions')
    .insert(
      suggestions.map(s => ({
        article_id: id,
        tag_id: s.tag_id,
        confidence_score: s.confidence,
        justification: s.justification,
        status: 'pending',
      }))
    )
    .select('*, tag:tags(*, category:categories(*))')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: saved })
}
