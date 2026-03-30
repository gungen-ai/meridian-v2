import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/backend/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Note: id here is unused — scope-suggest can be called before server creation
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { description } = body

  if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 })

  // Fetch all active tags with categories
  const { data: tags } = await supabase
    .from('tags')
    .select('id, name, description, category:categories(name)')
    .eq('status', 'active')
    .order('name')

  if (!tags || tags.length === 0) return NextResponse.json({ data: [] })

  const taxonomyList = tags.map(t =>
    `ID: ${t.id} | Tag: "${t.name}" | Category: "${(t.category as any)?.name}" | Desc: ${t.description ?? 'N/A'}`
  ).join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `You are helping configure a Knowledge Base MCP server for an AI agent use case.

USE CASE DESCRIPTION: "${description}"

AVAILABLE TAGS:
${taxonomyList}

Based on the use case description, which tags should be included in this MCP server's scope?
Select only the tags that are genuinely relevant to the described use case.

Return ONLY a JSON array of tag IDs (uuids), ordered from most to least relevant.
Return a maximum of 10 tags. Return [] if none are relevant.
Example: ["uuid1", "uuid2", "uuid3"]
Return ONLY the JSON array, no other text.`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'

  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const suggestedIds = JSON.parse(cleaned) as string[]
    const validIds = new Set(tags.map(t => t.id))
    const filtered = suggestedIds.filter(id => validIds.has(id))

    // Get article counts for suggested tags
    const { count } = await supabase
      .from('article_tags')
      .select('article_id', { count: 'exact', head: true })
      .in('tag_id', filtered)

    return NextResponse.json({
      data: filtered,
      article_count: count ?? 0,
    })
  } catch {
    return NextResponse.json({ data: [], article_count: 0 })
  }
}
