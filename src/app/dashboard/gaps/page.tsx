import { createClient } from '@/lib/supabase/server'
import GapsDashboard from '@/components/gaps/GapsDashboard'

export default async function GapsPage() {
  const supabase = await createClient()

  const [{ data: gaps }, { data: servers }] = await Promise.all([
    supabase
      .from('knowledge_gaps')
      .select(`
        *,
        mcp_server:mcp_servers(id, name),
        candidate_article:articles!knowledge_gaps_candidate_article_id_fkey(id, title)
      `)
      .eq('status', 'open')
      .order('recurrence_count', { ascending: false })
      .limit(100),
    supabase.from('mcp_servers').select('id, name').eq('status', 'active'),
  ])

  const typeACounts = (gaps ?? []).filter(g => g.gap_type === 'type_a').length
  const typeBCounts = (gaps ?? []).filter(g => g.gap_type === 'type_b').length
  const typeCCounts = (gaps ?? []).filter(g => g.gap_type === 'type_c').length

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Gaps</h1>
        <p className="text-gray-500 mt-1">Queries your AI agents couldn&apos;t answer — ranked by recurrence</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Open Gaps', value: (gaps ?? []).length, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'Type A — Out of Scope', value: typeACounts, color: 'text-blue-700', bg: 'bg-blue-50',
            desc: 'Content exists, add to MCP scope' },
          { label: 'Type B — Missing Content', value: typeBCounts, color: 'text-red-700', bg: 'bg-red-50',
            desc: 'Create new article' },
          { label: 'Type C — Ambiguous', value: typeCCounts, color: 'text-yellow-700', bg: 'bg-yellow-50',
            desc: 'Needs manual review' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl p-4 ${stat.bg} border border-opacity-20`}>
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            {stat.desc && <p className="text-xs text-gray-400 mt-1">{stat.desc}</p>}
          </div>
        ))}
      </div>

      <GapsDashboard gaps={gaps ?? []} />
    </div>
  )
}
