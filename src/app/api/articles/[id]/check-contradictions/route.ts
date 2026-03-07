import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectContradiction } from '@/lib/intelligence'
import { createHash } from 'crypto'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: article } = await supabase
    .from('articles')
    .select('id, title, content_text, article_tags(tag_id)')
    .eq('id', id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  const tagIds = (article.article_tags as any[]).map((t: any) => t.tag_id)

  // Find candidate articles sharing tags (published only)
  let candidates: any[] = []
  if (tagIds.length > 0) {
    const { data } = await supabase
      .from('articles')
      .select('id, title, content_text')
      .eq('status', 'published')
      .neq('id', id)
      .limit(10)
    candidates = data ?? []
  } else {
    const { data } = await supabase
      .from('articles')
      .select('id, title, content_text')
      .eq('status', 'published')
      .neq('id', id)
      .limit(5)
    candidates = data ?? []
  }

  const newContradictions: any[] = []

  for (const candidate of candidates) {
    const pairHash = createHash('sha256')
      .update([id, candidate.id].sort().join('|'))
      .digest('hex')

    // Skip already-checked pairs
    const { data: existing } = await supabase
      .from('contradictions')
      .select('id')
      .eq('pair_hash', pairHash)
      .maybeSingle()

    if (existing) continue

    const result = await detectContradiction(
      { id, title: article.title, content_text: article.content_text },
      { id: candidate.id, title: candidate.title, content_text: candidate.content_text }
    )

    if (result.found) {
      const { data: contradiction } = await supabase
        .from('contradictions')
        .insert({
          article_a_id: id,
          article_b_id: candidate.id,
          severity: result.severity ?? 'moderate',
          sentence_a: result.sentence_a,
          sentence_b: result.sentence_b,
          explanation: result.explanation,
          suggested_resolution: result.suggested_resolution,
          pair_hash: pairHash,
        })
        .select()
        .single()

      if (contradiction) newContradictions.push(contradiction)
    } else {
      // Record clean pair to skip in future
      await supabase.from('contradictions').insert({
        article_a_id: id,
        article_b_id: candidate.id,
        severity: 'minor',
        status: 'resolved',
        explanation: 'No contradiction found',
        pair_hash: pairHash,
      }).then(() => {})
    }
  }

  return NextResponse.json({
    contradictions_found: newContradictions.length,
    data: newContradictions,
  })
}
