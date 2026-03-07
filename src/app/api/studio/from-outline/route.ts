import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { htmlToPlainText } from '@/lib/claude'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { outline, category_id } = body

  if (!outline?.trim()) return NextResponse.json({ error: 'Outline required' }, { status: 400 })

  let categoryName = 'General'
  if (category_id) {
    const { data: cat } = await supabase.from('categories').select('name').eq('id', category_id).single()
    if (cat) categoryName = cat.name
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Expand the following outline into a full, well-written knowledge base article.

CATEGORY: ${categoryName}

OUTLINE:
${outline}

Instructions:
- Turn each bullet point into a full paragraph or section
- Add an introduction and conclusion
- Use the outline structure as your headings
- Make it practical and clear
- 400-700 words

Return ONLY a JSON object:
{"title": "Article Title", "content": "<h1>Title</h1><p>Intro...</p><h2>Section from outline</h2><p>Expanded content...</p>"}
Return ONLY the JSON, no other text.`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  let parsed: { title: string; content: string }
  try {
    parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  const content = `<!-- AI_GENERATED -->${parsed.content}`
  const contentText = htmlToPlainText(parsed.content)

  const { data: article, error } = await supabase
    .from('articles')
    .insert({
      title: parsed.title,
      content,
      content_text: contentText,
      author_id: user.id,
      owner_id: user.id,
      category_id: category_id || null,
      status: 'draft',
    })
    .select('id, title')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.from('article_versions').insert({
    article_id: article.id, version_number: 1,
    title: article.title, content, content_text: contentText,
    status: 'draft', editor_id: user.id,
    change_summary: 'Expanded from outline',
  })

  return NextResponse.json({ data: article })
}
