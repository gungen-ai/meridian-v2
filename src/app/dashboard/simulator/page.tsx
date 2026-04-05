export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/backend/supabase/server'
import QuerySimulator from '@/frontend/components/simulator/QuerySimulator'

export default async function SimulatorPage() {
  const supabase = createServiceClient()

  console.log('fetching servers...')
  const { data: servers } = await supabase
    .from('mcp_servers')
    .select('id, name, tag_ids')
    .eq('status', 'active')
    .order('name')
  console.log('servers:', JSON.stringify(servers))

  // Hydrate tag metadata
  const allTagIds = [...new Set((servers ?? []).flatMap(s => s.tag_ids ?? []))]
  let tagMap: Record<string, any> = {}
  if (allTagIds.length > 0) {
    const { data: tags } = await supabase
      .from('tags')
      .select('id, name, category:categories(name, color)')
      .in('id', allTagIds)
    tagMap = Object.fromEntries((tags ?? []).map(t => [t.id, t]))
  }

  const enrichedServers = (servers ?? []).map(s => ({
    ...s,
    tags: (s.tag_ids ?? []).map((id: string) => tagMap[id]).filter(Boolean),
  }))

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Query Simulator</h1>
        <p className="text-gray-500 mt-1">Test MCP server responses as if you were an AI agent</p>
      </div>

      {enrichedServers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">No active MCP servers found.</p>
          <p className="text-gray-400 text-xs mt-1">Create and activate an MCP server to start simulating queries.</p>
        </div>
      ) : (
        <QuerySimulator servers={enrichedServers} />
      )}
    </div>
  )
}
