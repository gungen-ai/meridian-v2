import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/backend/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { description } = body
  if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const { data: tags } = await supabase
    .from('tags')
    .select('id, name, description, category:categories(name)')
    .eq('status', 'active')
    .order('name')

  if (!tags || tags.length === 0) return NextResponse.json({ data: [], article_count: 0 })

  const taxonomyList = tags.map(t =>
    `ID: ${t.id} | Tag: "${t.name}" | Category: "${(t.category as any)?.name}" | Desc: ${t.description ?? 'N/A'}`
  ).join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `You help configure Knowledge Base MCP servers.

USE CASE: "${description}"

AVAILABLE TAGS:
${taxonomyList}

Which tags are most relevant to this use case? Return ONLY a JSON array of tag IDs (max 10), ordered by relevance.
Example: ["uuid1", "uuid2"]
Return ONLY the array.`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  let suggestedIds: string[] = []
  try {
    suggestedIds = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
  } catch { suggestedIds = [] }

  const validIds = new Set(tags.map(t => t.id))
  const filtered = suggestedIds.filter(id => validIds.has(id))

  // Count matching published articles
  let articleCount = 0
  if (filtered.length > 0) {
    const { data: articleTagRows } = await supabase
      .from('article_tags')
      .select('article_id')
      .in('tag_id', filtered)

    const uniqueArticleIds = new Set((articleTagRows ?? []).map(r => r.article_id))
    // Only count published ones
    if (uniqueArticleIds.size > 0) {
      const { count } = await supabase
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .in('id', [...uniqueArticleIds])
      articleCount = count ?? 0
    }
  }

  return NextResponse.json({ data: filtered, article_count: articleCount })
}
