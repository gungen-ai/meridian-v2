import { createClient } from '@/lib/supabase/server'
import ArticleEditor from '@/components/editor/ArticleEditor'

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
        profiles={profiles ?? []}
      />
    </div>
  )
}
