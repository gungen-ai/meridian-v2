import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/backend/supabase/server'
import { generateEmbedding } from '@/agents/claude/embeddings'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!['kb_admin', 'super_admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const service = createServiceClient()

  const { data: articles, error } = await service
    .from('articles')
    .select('id, title, content_text')
    .eq('status', 'published')
    .is('embedding', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let processed = 0
  let failed = 0

  for (const article of articles ?? []) {
    try {
      const embedding = await generateEmbedding(`${article.title} ${article.content_text}`)
      const { error: updateError } = await service
        .from('articles')
        .update({ embedding })
        .eq('id', article.id)

      if (updateError) throw updateError
      processed++
    } catch (err) {
      console.error(`Failed to embed article ${article.id}:`, err)
      failed++
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return NextResponse.json({ processed, failed, total: (articles ?? []).length })
}
