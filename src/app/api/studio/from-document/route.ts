import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/backend/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { htmlToPlainText } from '@/agents/claude/claude'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { text, filename, category_id, split_into_multiple = false } = body

  if (!text?.trim()) return NextResponse.json({ error: 'Document text required' }, { status: 400 })

  let categoryName = 'General'
  if (category_id) {
    const { data: cat } = await supabase.from('categories').select('name').eq('id', category_id).single()
    if (cat) categoryName = cat.name
  }

  const prompt = split_into_multiple
    ? `The following is a document extracted from "${filename ?? 'uploaded file'}".
Split it into multiple logical knowledge base articles. Each article should cover one distinct topic or section.

DOCUMENT:
${text.slice(0, 8000)}

Return ONLY a JSON array of articles:
[
  {"title": "Article 1 Title", "content": "<h1>Title</h1><p>...</p>"},
  {"title": "Article 2 Title", "content": "<h1>Title</h1><p>...</p>"}
]
Return ONLY the JSON array, no other text. Maximum 8 articles.`
    : `Convert the following document into a single clean knowledge base article.

FILENAME: ${filename ?? 'uploaded file'}
CATEGORY: ${categoryName}

DOCUMENT:
${text.slice(0, 8000)}

Return ONLY a JSON object:
{"title": "Article Title", "content": "<h1>Title</h1><p>Intro...</p><h2>Section</h2><p>Content...</p>"}
Return ONLY the JSON, no other text.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  })

  const responseText = response.content[0].type === 'text' ? response.content[0].text : ''
  let articles: { title: string; content: string }[]

  try {
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    articles = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  const created: { id: string; title: string }[] = []

  for (const art of articles) {
    const content = `<!-- AI_GENERATED -->${art.content}`
    const contentText = htmlToPlainText(art.content)

    const { data: article, error } = await supabase
      .from('articles')
      .insert({
        title: art.title,
        content,
        content_text: contentText,
        author_id: user.id,
        owner_id: user.id,
        category_id: category_id || null,
        status: 'draft',
      })
      .select('id, title')
      .single()

    if (error) continue

    await supabase.from('article_versions').insert({
      article_id: article.id, version_number: 1,
      title: article.title, content, content_text: contentText,
      status: 'draft', editor_id: user.id,
      change_summary: `Extracted from ${filename ?? 'document'}`,
    })

    created.push({ id: article.id, title: article.title })
  }

  return NextResponse.json({ data: created })
}
