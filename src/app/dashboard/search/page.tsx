import { createClient } from '@/lib/supabase/server'
import SearchUI from '@/components/search/SearchUI'

export default async function SearchPage() {
  const supabase = await createClient()

  const [{ data: categories }, { data: tags }] = await Promise.all([
    supabase.from('categories').select('id, name, color').order('name'),
    supabase.from('tags').select('id, name, category_id').eq('status', 'active').order('name'),
  ])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Search</h1>
        <p className="text-gray-500 mt-1">Search across all published articles</p>
      </div>
      <SearchUI categories={categories ?? []} tags={tags ?? []} />
    </div>
  )
}
