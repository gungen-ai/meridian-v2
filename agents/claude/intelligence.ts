import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export type GapType = 'type_a' | 'type_b' | 'type_c'

export interface GapClassification {
  gap_type: GapType
  candidate_article_id: string | null
  suggested_title: string | null
  explanation: string
}

/**
 * Classify a knowledge gap given search results and shadow search results.
 *
 * type_a: found in shadow search (exists in KB, outside scope)
 * type_b: not found anywhere (genuinely missing)
 * type_c: partial/ambiguous match
 */
export async function classifyGap(
  query: string,
  scopedResults: { id: string; title: string }[],         // what the agent saw
  shadowResults: { id: string; title: string; content_text: string }[] // full KB search
): Promise<GapClassification> {

  // Quick heuristic classification before LLM
  if (shadowResults.length > 0 && scopedResults.length === 0) {
    // Clear type_a: content exists outside scope
    return {
      gap_type: 'type_a',
      candidate_article_id: shadowResults[0].id,
      suggested_title: null,
      explanation: `Content exists in KB ("${shadowResults[0].title}") but is outside this MCP server's tag scope.`,
    }
  }

  if (shadowResults.length === 0 && scopedResults.length === 0) {
    // Likely type_b, but ask Claude to suggest a title
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `A knowledge base agent searched for: "${query}"
No articles were found in the knowledge base.

Suggest a clear, specific article title that would answer this query if it were written.
Return ONLY a JSON object: {"title": "Suggested Article Title Here", "explanation": "one sentence why this content is missing"}
Return ONLY the JSON, no other text.`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    try {
      const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
      return {
        gap_type: 'type_b',
        candidate_article_id: null,
        suggested_title: parsed.title ?? query,
        explanation: parsed.explanation ?? 'Content is genuinely absent from the knowledge base.',
      }
    } catch {
      return {
        gap_type: 'type_b',
        candidate_article_id: null,
        suggested_title: query,
        explanation: 'Content is genuinely absent from the knowledge base.',
      }
    }
  }

  // Partial match - type_c
  return {
    gap_type: 'type_c',
    candidate_article_id: shadowResults[0]?.id ?? null,
    suggested_title: null,
    explanation: 'Partial match found — content may be incomplete or ambiguously covered.',
  }
}

// ── Freshness score calculation ───────────────────────────────────
export function calculateFreshnessScore(
  publishedAt: string | null,
  lastReviewedAt: string | null,
  autoStaleDays: number = 90
): { score: number; label: 'fresh' | 'review_suggested' | 'review_required' | 'stale' } {
  if (!publishedAt) return { score: 100, label: 'fresh' }

  const now = Date.now()
  const referenceDate = lastReviewedAt ? new Date(lastReviewedAt).getTime() : new Date(publishedAt).getTime()
  const daysSince = (now - referenceDate) / (1000 * 60 * 60 * 24)

  // Age decay: 50% weight
  const ageRatio = Math.min(daysSince / autoStaleDays, 1)
  const ageScore = Math.round((1 - ageRatio) * 50)

  // Simplified: no external signals in Phase 3 (Phase 4 adds URL monitoring)
  // Give remaining 50 points as baseline
  const score = Math.max(0, Math.min(100, ageScore + 50))

  let label: 'fresh' | 'review_suggested' | 'review_required' | 'stale'
  if (score >= 75) label = 'fresh'
  else if (score >= 50) label = 'review_suggested'
  else if (score >= 25) label = 'review_required'
  else label = 'stale'

  return { score, label }
}

// ── Contradiction detection ───────────────────────────────────────
export interface ContradictionResult {
  found: boolean
  severity?: 'critical' | 'moderate' | 'minor'
  sentence_a?: string
  sentence_b?: string
  explanation?: string
  suggested_resolution?: string
}

export async function detectContradiction(
  articleA: { id: string; title: string; content_text: string },
  articleB: { id: string; title: string; content_text: string }
): Promise<ContradictionResult> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `Compare these two knowledge base articles for factual contradictions.

ARTICLE A: "${articleA.title}"
${articleA.content_text.slice(0, 1000)}

ARTICLE B: "${articleB.title}"
${articleB.content_text.slice(0, 1000)}

Do these articles contain any factual contradictions — statements that cannot both be true?
Ignore differences in tone, emphasis, or scope. Only flag genuine factual conflicts.

Return ONLY a JSON object:
{
  "found": true/false,
  "severity": "critical"|"moderate"|"minor",
  "sentence_a": "the exact conflicting statement from Article A",
  "sentence_b": "the exact conflicting statement from Article B",
  "explanation": "why these contradict",
  "suggested_resolution": "how to resolve this"
}

If no contradiction, return: {"found": false}
Return ONLY the JSON, no other text.`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{"found":false}'
  try {
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim()) as ContradictionResult
  } catch {
    return { found: false }
  }
}

// ── Generate owner nudge message ─────────────────────────────────
export async function generateFreshnessNudge(
  articleTitle: string,
  daysSinceReview: number,
  freshnessLabel: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Write a brief, friendly nudge message to the owner of a KB article that needs reviewing.

Article: "${articleTitle}"
Days since last review: ${daysSinceReview}
Status: ${freshnessLabel}

Write 2 sentences max. Be specific to this article, not generic. Be helpful, not alarming.
Return ONLY the message text.`
    }]
  })

  return response.content[0].type === 'text'
    ? response.content[0].text
    : `"${articleTitle}" hasn't been reviewed in ${daysSinceReview} days. Please confirm it's still accurate.`
}
