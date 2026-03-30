import { createClient } from '@/backend/supabase/server'
import ContentStudio from '@/frontend/components/studio/ContentStudio'

export default async function StudioPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('id, name').order('name')

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI Content Studio</h1>
        <p className="text-gray-500 mt-1">Generate, import, and expand KB articles with AI</p>
      </div>
      <ContentStudio categories={categories ?? []} />
    </div>
  )
}
