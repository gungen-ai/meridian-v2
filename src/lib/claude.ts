import Anthropic from '@anthropic-ai/sdk'
import type { Tag, Category } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// ── Auto-Tagging ─────────────────────────────────────────────────
export interface TagSuggestionResult {
  tag_id: string
  confidence: number
  justification: string
}

export async function generateTagSuggestions(
  articleTitle: string,
  articleContent: string,
  availableTags: (Tag & { category: Category })[]
): Promise<TagSuggestionResult[]> {
  if (availableTags.length === 0) return []

  const taxonomyList = availableTags.map(t =>
    `- ID: ${t.id} | Tag: "${t.name}" | Category: "${t.category.name}" | Description: ${t.description || 'N/A'}`
  ).join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are a knowledge base taxonomy expert. Analyze the article below and suggest the most relevant tags from the provided taxonomy.

ARTICLE TITLE: ${articleTitle}

ARTICLE CONTENT (excerpt):
${articleContent.slice(0, 2000)}

AVAILABLE TAXONOMY:
${taxonomyList}

Return ONLY a JSON array of up to 5 tag suggestions. Only include tags with confidence >= 0.70.
Format: [{"tag_id": "uuid", "confidence": 0.95, "justification": "one sentence reason"}]
Return [] if no tags are relevant with high confidence.
Return ONLY the JSON array, no other text.`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const suggestions = JSON.parse(cleaned) as TagSuggestionResult[]
    // Validate tag IDs exist in our taxonomy
    const validTagIds = new Set(availableTags.map(t => t.id))
    return suggestions.filter(s =>
      validTagIds.has(s.tag_id) && s.confidence >= 0.70
    )
  } catch {
    console.error('Failed to parse tag suggestions:', text)
    return []
  }
}

// ── AI Draft Generation ──────────────────────────────────────────
export async function generateArticleDraft(
  topic: string,
  categoryName: string,
  relatedArticles: { title: string; content_text: string }[]
): Promise<{ title: string; content: string }> {
  const context = relatedArticles
    .slice(0, 5)
    .map(a => `### ${a.title}\n${a.content_text.slice(0, 800)}`)
    .join('\n\n---\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are a knowledge base content writer. Write a clear, accurate KB article on the topic below.

TOPIC: ${topic}
CATEGORY: ${categoryName}

${context ? `RELATED EXISTING ARTICLES (use these for consistency — do not contradict them):\n${context}` : ''}

Write a well-structured article with:
- A clear, specific title
- An introduction paragraph
- 2-4 main sections with headers
- Practical, actionable content
- Professional but approachable tone

Return ONLY a JSON object with this exact format:
{"title": "Article Title Here", "content": "<h1>Title</h1><p>Introduction...</p><h2>Section 1</h2><p>Content...</p>"}

The content field must be valid HTML using only: h1, h2, h3, p, ul, ol, li, strong, em, code, pre tags.
Return ONLY the JSON object, no other text.`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(cleaned) as { title: string; content: string }
  } catch {
    return {
      title: topic,
      content: `<h1>${topic}</h1><p>This is an AI-generated draft. Please edit and review before publishing.</p>`
    }
  }
}

// ── Reviewer Brief Generation ────────────────────────────────────
export async function generateReviewerBrief(
  article: { title: string; content_text: string },
  relatedArticles: { title: string; content_text: string }[]
): Promise<string> {
  const context = relatedArticles
    .slice(0, 3)
    .map(a => `- ${a.title}: ${a.content_text.slice(0, 400)}`)
    .join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `You are helping a reviewer quickly understand what to look for when reviewing a KB article.

ARTICLE TO REVIEW:
Title: ${article.title}
Content: ${article.content_text.slice(0, 1500)}

RELATED PUBLISHED ARTICLES:
${context || 'No related articles found.'}

Generate a concise reviewer brief with:
1. A 3-bullet summary of the article's key claims
2. 2-3 specific things the reviewer should verify or check
3. Any potential issues to watch for (contradictions with related articles, missing info, unclear statements)

Keep it under 300 words. Be specific and practical.`
    }]
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ── Plain text extraction from HTML ─────────────────────────────
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}
