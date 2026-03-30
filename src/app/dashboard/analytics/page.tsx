import { createClient } from '@/backend/supabase/server'
import AnalyticsDashboard from '@/frontend/components/analytics/AnalyticsDashboard'

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const sevenDaysAgo  = new Date(Date.now() -  7 * 86400000).toISOString()

  const [
    { data: queryLog },
    { data: gaps },
    { data: servers },
    { data: articles },
    { count: totalPublished },
    { count: totalGaps },
    { count: totalQueries },
  ] = await Promise.all([
    // Query log for last 30 days
    supabase.from('mcp_query_log')
      .select('created_at, tool_name, result_count, latency_ms, mcp_server_id')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true }),

    // Open gaps
    supabase.from('knowledge_gaps')
      .select('gap_type, recurrence_count, created_at, mcp_server_id')
      .eq('status', 'open')
      .order('recurrence_count', { ascending: false })
      .limit(50),

    // MCP servers with query counts
    supabase.from('mcp_servers')
      .select('id, name, total_queries, last_queried_at, status')
      .neq('status', 'deleted')
      .order('total_queries', { ascending: false }),

    // Top articles by tag usage (proxy for agent interest)
    supabase.from('articles')
      .select('id, title, freshness_label, freshness_score, updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false })
      .limit(10),

    // Counts
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('knowledge_gaps').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('mcp_query_log').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
  ])

  // Build daily query volume for chart (last 14 days)
  const days: { date: string; queries: number; gaps: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const dateStr = d.toISOString().slice(0, 10)
    const dayQueries = (queryLog ?? []).filter(q => q.created_at.slice(0, 10) === dateStr).length
    const dayGaps = (gaps ?? []).filter(g => g.created_at.slice(0, 10) === dateStr).length
    days.push({ date: dateStr, queries: dayQueries, gaps: dayGaps })
  }

  // Gap rate = gaps / queries (last 7 days)
  const recentQueries = (queryLog ?? []).filter(q => q.created_at >= sevenDaysAgo).length
  const recentGaps = (gaps ?? []).filter(g => g.created_at >= sevenDaysAgo).length
  const gapRate = recentQueries > 0 ? Math.round((recentGaps / recentQueries) * 100) : 0

  // Zero-result rate
  const zeroResults = (queryLog ?? []).filter(q => q.result_count === 0).length
  const zeroResultRate = (queryLog ?? []).length > 0
    ? Math.round((zeroResults / (queryLog ?? []).length) * 100) : 0

  // Avg latency
  const latencies = (queryLog ?? []).filter(q => q.latency_ms).map(q => q.latency_ms!)
  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0

  // Type breakdown
  const typeA = (gaps ?? []).filter(g => g.gap_type === 'type_a').length
  const typeB = (gaps ?? []).filter(g => g.gap_type === 'type_b').length
  const typeC = (gaps ?? []).filter(g => g.gap_type === 'type_c').length

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Last 30 days of agent activity and KB health</p>
      </div>
      <AnalyticsDashboard
        stats={{
          totalQueries: totalQueries ?? 0,
          totalPublished: totalPublished ?? 0,
          totalGaps: totalGaps ?? 0,
          gapRate,
          zeroResultRate,
          avgLatency,
          activeServers: (servers ?? []).filter(s => s.status === 'active').length,
        }}
        dailyData={days}
        servers={servers ?? []}
        gapBreakdown={{ typeA, typeB, typeC }}
        staleness={{
          fresh: (articles ?? []).filter(a => a.freshness_label === 'fresh').length,
          review_suggested: (articles ?? []).filter(a => a.freshness_label === 'review_suggested').length,
          review_required: (articles ?? []).filter(a => a.freshness_label === 'review_required').length,
          stale: (articles ?? []).filter(a => a.freshness_label === 'stale').length,
        }}
      />
    </div>
  )
}
