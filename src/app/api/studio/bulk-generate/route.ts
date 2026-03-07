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
  const { topics, category_id, tone = 'professional' } = body
  // topics: string[]

  if (!topics || topics.length === 0) return NextResponse.json({ error: 'No topics provided' }, { status: 400 })
  if (topics.length > 20) return NextResponse.json({ error: 'Max 20 topics at once' }, { status: 400 })

  // Fetch category name for context
  let categoryName = 'General'
  if (category_id) {
    const { data: cat } = await supabase.from('categories').select('name').eq('id', category_id).single()
    if (cat) categoryName = cat.name
  }

  // Fetch existing published articles as grounding context (avoid contradictions)
  const { data: existingArticles } = await supabase
    .from('articles')
    .select('title, content_text')
    .eq('status', 'published')
    .limit(5)

  const contextSummary = (existingArticles ?? [])
    .map(a => `- ${a.title}: ${a.content_text.slice(0, 300)}`)
    .join('\n')

  const results: { topic: string; article_id: string; title: string; status: 'created' | 'failed'; error?: string }[] = []

  // Generate articles in parallel (batches of 5)
  const batches: string[][] = []
  for (let i = 0; i < topics.length; i += 5) batches.push(topics.slice(i, i + 5))

  for (const batch of batches) {
    await Promise.all(batch.map(async (topic: string) => {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `Write a knowledge base article for: "${topic}"

Category: ${categoryName}
Tone: ${tone}
${contextSummary ? `\nExisting KB context (maintain consistency):\n${contextSummary}` : ''}

Requirements:
- Clear, specific title
- Introduction paragraph
- 2-4 sections with ## headings
- Practical, actionable content
- 300-500 words

Return ONLY a JSON object:
{"title": "Article Title", "content": "<h1>Title</h1><p>Intro...</p><h2>Section</h2><p>Content...</p>"}
Return ONLY the JSON, no other text.`
          }]
        })

        const text = response.content[0].type === 'text' ? response.content[0].text : ''
        const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())

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

        if (error) throw new Error(error.message)

        await supabase.from('article_versions').insert({
          article_id: article.id, version_number: 1,
          title: article.title, content, content_text: contentText,
          status: 'draft', editor_id: user.id,
          change_summary: 'AI generated from topic',
        })

        results.push({ topic, article_id: article.id, title: article.title, status: 'created' })
      } catch (e: any) {
        results.push({ topic, article_id: '', title: '', status: 'failed', error: e.message })
      }
    }))
  }

  await supabase.from('audit_events').insert({
    event_type: 'bulk_articles_generated', entity_type: 'article',
    actor_id: user.id,
    metadata: { count: results.filter(r => r.status === 'created').length, topics: topics.length },
  })

  return NextResponse.json({ data: results })
}
