import { createClient } from '@/backend/supabase/server'
import ArticleEditor from '@/frontend/components/editor/ArticleEditor'
import type { Profile } from '@/shared/types'

export default async function NewArticlePage() {
  const supabase = await createClient()

  const [{ data: categories }, { data: tags }, { data: profiles }] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    supabase.from('tags').select('*, category:categories(*)').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name, email, role').order('full_name'),
  ])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Article</h1>
      <ArticleEditor
        categories={categories ?? []}
        tags={tags ?? []}
        profiles={(profiles ?? []) as Profile[]}
      />
    </div>
  )
}
