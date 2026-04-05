import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/backend/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { generateQueryEmbedding, semanticSearch } from '@/agents/claude/embeddings'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  console.log('session user:', JSON.stringify(user?.id))
  console.log('profile:', JSON.stringify(profile))

  if (!['mcp_owner', 'kb_admin', 'super_admin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const { server_id, query, limit = 5 } = body
  if (!server_id) return NextResponse.json({ error: 'server_id is required' }, { status: 400 })
  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 })

  const service = createServiceClient()
  const start = Date.now()

  const { data: server } = await service
    .from('mcp_servers')
    .select('id, name, tag_ids, status')
    .eq('id', server_id)
    .single()

  if (!server || server.status !== 'active') {
    return NextResponse.json({ error: 'Server not found or inactive' }, { status: 404 })
  }

  // 1. Try semantic search first
  let unique: { id: string; title: string; content_text: string; updated_at?: string }[] = []
  try {
    const queryEmbedding = await generateQueryEmbedding(query)
    const semanticResults = await semanticSearch(service, queryEmbedding, server.tag_ids, Math.min(limit, 10))
    unique = semanticResults
  } catch (err) {
    console.error('Semantic search failed, falling back to FTS:', err)
  }

  // 2. Fall back to FTS + ilike if semantic returned nothing
  if (unique.length === 0) {
    const { data: ftsResults } = await service
      .from('articles')
      .select('id, title, content_text, updated_at, article_tags!inner(tag_id)')
      .eq('status', 'published')
      .in('article_tags.tag_id', server.tag_ids)
      .textSearch('content_text', query.split(' ').filter(Boolean).join(' | '), { type: 'plain', config: 'english' })
      .limit(Math.min(limit, 10))

    unique = ftsResults ?? []

    if (unique.length === 0) {
      const { data: fallback } = await service
        .from('articles')
        .select('id, title, content_text, updated_at, article_tags!inner(tag_id)')
        .eq('status', 'published')
        .in('article_tags.tag_id', server.tag_ids)
        .or(`title.ilike.%${query}%,content_text.ilike.%${query}%`)
        .limit(Math.min(limit, 10))
      unique = fallback ?? []
    }

    // Deduplicate (only needed for FTS path since semantic already returns unique rows)
    const seen = new Set<string>()
    unique = unique.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true })
  }
  const latency = Date.now() - start
  const isGap = unique.length === 0

  let gapType: 'type_a' | 'type_b' | 'type_c' | null = null
  if (isGap) {
    // Shadow search (full KB, no scope filter) to classify gap
    const { data: shadow } = await service
      .from('articles')
      .select('id, title')
      .eq('status', 'published')
      .or(`title.ilike.%${query}%,content_text.ilike.%${query}%`)
      .limit(5)

    if ((shadow ?? []).length > 0) {
      gapType = 'type_a' // exists in KB but outside scope
    } else {
      gapType = 'type_b' // genuinely missing
    }
  }

  const resources = unique.map(a => {
    const idx = a.content_text.toLowerCase().indexOf(query.toLowerCase())
    let snippet = ''
    if (idx !== -1) {
      const start = Math.max(0, idx - 60)
      const end = Math.min(a.content_text.length, idx + query.length + 100)
      snippet = (start > 0 ? '…' : '') + a.content_text.slice(start, end) + (end < a.content_text.length ? '…' : '')
    } else {
      snippet = a.content_text.slice(0, 160) + '…'
    }
    return { id: a.id, title: a.title, snippet, updated_at: a.updated_at }
  })

  let answer: string | null = null
  if (unique.length > 0) {
    const context = unique
      .map((a, i) => `## ${a.title}\n${i < 2 ? a.content_text : resources[i].snippet}`)
      .join('\n\n')

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: `You are a helpful customer support assistant. Answer the user's question using only the knowledge base articles provided. Be concise and direct. If the articles don't fully answer the question, say so briefly. Do not make up information.`,
      messages: [{
        role: 'user',
        content: `Knowledge base articles:\n\n${context}\n\nCustomer question: ${query}`,
      }],
    })

    answer = response.content[0].type === 'text' ? response.content[0].text : null
  }

  return NextResponse.json({
    resources,
    total: unique.length,
    is_gap: isGap,
    gap_type: gapType,
    answer,
    latency_ms: Date.now() - start,
    query,
  })
}
