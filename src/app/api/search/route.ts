import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()
  const tagId = searchParams.get('tag_id')
  const categoryId = searchParams.get('category_id')

  if (!query || query.length < 2) return NextResponse.json({ data: [] })

  let dbQuery = supabase
    .from('articles')
    .select(`
      id, title, content_text, status, freshness_label, updated_at,
      author:profiles!articles_author_id_fkey(full_name),
      category:categories(name, color),
      article_tags(tag:tags(id, name))
    `)
    .eq('status', 'published')
    .or(`title.ilike.%${query}%,content_text.ilike.%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(20)

  if (categoryId) dbQuery = dbQuery.eq('category_id', categoryId)

  const { data, error } = await dbQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Snippet extraction — find the matching sentence in content
  const results = (data ?? []).map(article => {
    const text = article.content_text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    let snippet = ''
    if (idx !== -1) {
      const start = Math.max(0, idx - 80)
      const end = Math.min(text.length, idx + query.length + 120)
      snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
    } else {
      snippet = text.slice(0, 200) + '…'
    }
    return { ...article, snippet }
  })

  return NextResponse.json({ data: results, query })
}
