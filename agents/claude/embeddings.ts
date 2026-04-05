import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const EMBEDDING_MODEL = 'text-embedding-3-small'

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // stay within token limit
  })
  return response.data[0].embedding
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
  })
  return response.data[0].embedding
}

export interface SemanticResult {
  id: string
  title: string
  content_text: string
  similarity: number
}

export async function semanticSearch(
  supabase: SupabaseClient,
  queryEmbedding: number[],
  tagIds: string[],
  limit: number = 5,
  threshold: number = 0.5
): Promise<SemanticResult[]> {
  const { data, error } = await supabase.rpc('match_articles', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
    filter_tag_ids: tagIds.length > 0 ? tagIds : null,
  })

  if (error) {
    console.error('semanticSearch error:', error.message)
    return []
  }

  return (data ?? []) as SemanticResult[]
}
