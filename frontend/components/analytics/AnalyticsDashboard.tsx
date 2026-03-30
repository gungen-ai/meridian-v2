'use client'
import { Activity, Server, FileText, AlertTriangle, Zap, TrendingDown } from 'lucide-react'

interface Props {
  stats: {
    totalQueries: number
    totalPublished: number
    totalGaps: number
    gapRate: number
    zeroResultRate: number
    avgLatency: number
    activeServers: number
  }
  dailyData: { date: string; queries: number; gaps: number }[]
  servers: { id: string; name: string; total_queries: number; last_queried_at: string | null; status: string }[]
  gapBreakdown: { typeA: number; typeB: number; typeC: number }
  staleness: { fresh: number; review_suggested: number; review_required: number; stale: number }
}

export default function AnalyticsDashboard({ stats, dailyData, servers, gapBreakdown, staleness }: Props) {
  const maxQueries = Math.max(...dailyData.map(d => d.queries), 1)

  const statCards = [
    { label: 'Total Queries (30d)',  value: stats.totalQueries.toLocaleString(), icon: Activity,       color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Active MCP Servers',   value: stats.activeServers,                 icon: Server,         color: 'text-teal-600',   bg: 'bg-teal-50' },
    { label: 'Published Articles',   value: stats.totalPublished,                icon: FileText,       color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Open Gaps',            value: stats.totalGaps,                     icon: AlertTriangle,  color: 'text-red-600',    bg: 'bg-red-50' },
    { label: 'Gap Rate (7d)',         value: `${stats.gapRate}%`,                icon: TrendingDown,   color: 'text-orange-600', bg: 'bg-orange-50',
      note: stats.gapRate > 20 ? '⚠ High — KB falling behind' : '✓ Healthy' },
    { label: 'Avg Latency',          value: `${stats.avgLatency}ms`,             icon: Zap,            color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  const totalGapTypes = gapBreakdown.typeA + gapBreakdown.typeB + gapBreakdown.typeC || 1
  const totalStale = staleness.fresh + staleness.review_suggested + staleness.review_required + staleness.stale || 1

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">{s.label}</p>
              <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            {s.note && <p className={`text-xs mt-1 ${stats.gapRate > 20 ? 'text-orange-500' : 'text-green-500'}`}>{s.note}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Query volume chart */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Query Volume (14 days)</h2>
          <div className="flex items-end gap-1 h-32">
            {dailyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {d.date.slice(5)}: {d.queries} queries
                </div>
                <div className="w-full flex flex-col justify-end h-28 gap-0.5">
                  {d.queries > 0 && (
                    <div
                      className="w-full bg-brand-500 rounded-t transition-all"
                      style={{ height: `${(d.queries / maxQueries) * 100}%`, minHeight: '2px' }}
                    />
                  )}
                  {d.gaps > 0 && (
                    <div
                      className="w-full bg-red-300 rounded-t"
                      style={{ height: `${Math.min((d.gaps / maxQueries) * 100, 20)}%`, minHeight: '2px' }}
                    />
                  )}
                </div>
                <span className="text-xs text-gray-400 rotate-45 origin-left mt-1">
                  {d.date.slice(8)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-6 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-3 h-3 bg-brand-500 rounded" /> Queries
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-3 h-3 bg-red-300 rounded" /> Gaps
            </div>
          </div>
        </div>

        {/* Gap type breakdown */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Gap Breakdown</h2>
            <div className="space-y-3">
              {[
                { label: 'Type A — Out of Scope', value: gapBreakdown.typeA, color: 'bg-blue-500' },
                { label: 'Type B — Missing',      value: gapBreakdown.typeB, color: 'bg-red-500'  },
                { label: 'Type C — Ambiguous',    value: gapBreakdown.typeC, color: 'bg-yellow-500' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold text-gray-900">{item.value}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${item.color}`}
                      style={{ width: `${(item.value / totalGapTypes) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">KB Freshness</h2>
            <div className="space-y-3">
              {[
                { label: 'Fresh',            value: staleness.fresh,            color: 'bg-green-500'  },
                { label: 'Review Suggested', value: staleness.review_suggested, color: 'bg-yellow-500' },
                { label: 'Review Required',  value: staleness.review_required,  color: 'bg-orange-500' },
                { label: 'Stale',            value: staleness.stale,            color: 'bg-red-500'    },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold text-gray-900">{item.value}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${item.color}`}
                      style={{ width: `${(item.value / totalStale) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MCP server table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">MCP Server Usage</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50">
              <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Server</th>
              <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-right py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Queries</th>
              <th className="text-right py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {servers.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-5 font-medium text-gray-900">{s.name}</td>
                <td className="py-3 px-5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                    s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>{s.status}</span>
                </td>
                <td className="py-3 px-5 text-right text-gray-700">{s.total_queries.toLocaleString()}</td>
                <td className="py-3 px-5 text-right text-gray-500 text-sm">
                  {s.last_queried_at ? new Date(s.last_queried_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {servers.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-gray-400 text-sm">No MCP servers yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
