import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/backend/supabase/server'
import { htmlToPlainText } from '@/agents/claude/claude'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { rows, category_id, default_status = 'draft' } = body
  // rows: { title, content, tags? }[]

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const results = { created: 0, failed: 0, errors: [] as string[] }

  for (const row of rows) {
    if (!row.title?.trim()) { results.failed++; results.errors.push('Row missing title'); continue }

    const content = row.content ?? ''
    const contentText = content.startsWith('<') ? htmlToPlainText(content) : content

    const { data: article, error } = await supabase
      .from('articles')
      .insert({
        title: row.title.trim(),
        content: content.startsWith('<') ? content : `<p>${content.replace(/\n/g, '</p><p>')}</p>`,
        content_text: contentText,
        author_id: user.id,
        owner_id: user.id,
        category_id: category_id || null,
        status: default_status,
        ...(default_status === 'published' ? {
          published_at: new Date().toISOString(),
          freshness_score: 100,
          freshness_label: 'fresh',
        } : {}),
      })
      .select()
      .single()

    if (error) {
      results.failed++
      results.errors.push(`"${row.title}": ${error.message}`)
      continue
    }

    // Save initial version
    await supabase.from('article_versions').insert({
      article_id: article.id, version_number: 1,
      title: article.title, content: article.content,
      content_text: article.content_text, status: article.status,
      editor_id: user.id, change_summary: 'Imported',
    })

    results.created++
  }

  await supabase.from('audit_events').insert({
    event_type: 'articles_imported', entity_type: 'article',
    actor_id: user.id, metadata: { count: results.created, failed: results.failed },
  })

  return NextResponse.json({ data: results })
}
