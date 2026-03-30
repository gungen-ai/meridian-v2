import { createClient } from '@/backend/supabase/server'
import { notFound } from 'next/navigation'
import ArticleEditor from '@/frontend/components/editor/ArticleEditor'
import type { Profile } from '@/shared/types'

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: article },
    { data: categories },
    { data: tags },
    { data: profiles },
    { data: articleTags },
  ] = await Promise.all([
    supabase.from('articles').select('*').eq('id', id).single(),
    supabase.from('categories').select('*').order('name'),
    supabase.from('tags').select('*, category:categories(*)').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name, email, role').order('full_name'),
    supabase.from('article_tags').select('tag_id').eq('article_id', id),
  ])

  if (!article) notFound()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Article</h1>
      <ArticleEditor
        article={article as any}
        categories={categories ?? []}
        tags={tags ?? []}
        profiles={(profiles ?? []) as Profile[]}
        selectedTagIds={(articleTags ?? []).map(t => t.tag_id)}
      />
    </div>
  )
}
