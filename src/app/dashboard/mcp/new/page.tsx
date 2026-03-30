import { createClient } from '@/backend/supabase/server'
import McpWizard from '@/frontend/components/mcp/McpWizard'

export default async function NewMcpServerPage() {
  const supabase = await createClient()

  const { data: tags } = await supabase
    .from('tags')
    .select('*, category:categories(*)')
    .eq('status', 'active')
    .order('name')

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create MCP Server</h1>
        <p className="text-gray-500 mt-1">Give an AI agent scoped access to your knowledge base in minutes.</p>
      </div>
      <McpWizard tags={(tags ?? []) as any} />
    </div>
  )
}
