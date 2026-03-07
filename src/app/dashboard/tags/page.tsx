import { createClient } from '@/lib/supabase/server'
import TagManager from '@/components/tags/TagManager'

export default async function TagsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: categories }, { data: tags }, { data: profile }] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    supabase.from('tags').select('*, category:categories(*)').order('name'),
    supabase.from('profiles').select('role').eq('id', user!.id).single(),
  ])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tags & Categories</h1>
        <p className="text-gray-500 mt-1">Manage your knowledge base taxonomy</p>
      </div>
      <TagManager
        categories={categories ?? []}
        tags={tags ?? []}
        userRole={(profile as any)?.role}
      />
    </div>
  )
}
