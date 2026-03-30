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
  const { url, category_id } = body

  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

  // Fetch the URL
  let pageText = ''
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KBManager/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()

    // Strip HTML tags to get readable text
    pageText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000)
  } catch (e: any) {
    return NextResponse.json({ error: `Could not fetch URL: ${e.message}` }, { status: 400 })
  }

  if (pageText.length < 100) {
    return NextResponse.json({ error: 'Page content too short or could not be extracted' }, { status: 400 })
  }

  // Convert to KB article
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `Convert the following web page content into a clean, well-structured knowledge base article.

SOURCE URL: ${url}

PAGE CONTENT:
${pageText}

Instructions:
- Extract the key information and rewrite it as a KB article
- Remove navigation, ads, footers, and other non-content
- Use clear headings and practical structure
- Keep it factual and remove any promotional language
- 200-500 words

Return ONLY a JSON object:
{"title": "Article Title", "content": "<h1>Title</h1><p>Intro...</p><h2>Section</h2><p>Content...</p>"}
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
    change_summary: `Imported from ${url}`,
  })

  return NextResponse.json({ data: article })
}
