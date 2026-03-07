import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateFreshnessScore } from '@/lib/intelligence'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date().toISOString()
  const { score, label } = calculateFreshnessScore(now, now, 90)

  const { data, error } = await supabase
    .from('articles')
    .update({
      last_reviewed_at: now,
      freshness_score: score,
      freshness_label: label,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.from('audit_events').insert({
    event_type: 'article_confirmed_accurate',
    entity_type: 'article', entity_id: id,
    actor_id: user.id, metadata: { freshness_score: score },
  })

  return NextResponse.json({ data })
}
