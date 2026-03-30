import { createClient } from '@/backend/supabase/server'
import ImportTool from '@/frontend/components/ImportTool'

export default async function ImportPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('id, name').order('name')

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import Articles</h1>
        <p className="text-gray-500 mt-1">Bulk import from CSV or paste content from Notion, Confluence, or Guru</p>
      </div>
      <ImportTool categories={categories ?? []} />
    </div>
  )
}
