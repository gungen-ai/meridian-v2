'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatDateTime } from '@/lib/utils'
import {
  AlertTriangle, Search, Plus, ArrowRight, X,
  Loader2, RefreshCw, Tag, FileText
} from 'lucide-react'

interface Gap {
  id: string
  query_text: string
  gap_type: 'type_a' | 'type_b' | 'type_c' | null
  recurrence_count: number
  last_seen_at: string
  suggested_title: string | null
  mcp_server: { id: string; name: string } | null
  candidate_article: { id: string; title: string } | null
}

const GAP_TYPE_CONFIG = {
  type_a: { label: 'Out of Scope', color: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-200',  icon: Tag },
  type_b: { label: 'Missing Content', color: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200',   icon: Plus },
  type_c: { label: 'Ambiguous',    color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: AlertTriangle },
}

export default function GapsDashboard({ gaps: initialGaps }: { gaps: Gap[] }) {
  const router = useRouter()
  const [gaps, setGaps] = useState(initialGaps)
  const [loading, setLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'type_a' | 'type_b' | 'type_c'>('all')

  const filtered = gaps.filter(g => filter === 'all' || g.gap_type === filter)

  async function handleResolve(gap: Gap, action: 'add_to_scope' | 'create_article' | 'dismiss') {
    setLoading(`${gap.id}-${action}`)
    try {
      const res = await fetch(`/api/gaps/${gap.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const result = await res.json()

      setGaps(prev => prev.filter(g => g.id !== gap.id))

      if (action === 'create_article' && result.article_id) {
        toast.success('AI draft created! Redirecting to editor…')
        setTimeout(() => router.push(`/dashboard/articles/${result.article_id}/edit`), 1000)
      } else if (action === 'add_to_scope') {
        toast.success('Article added to MCP scope!')
      } else {
        toast.success('Gap dismissed')
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex bg-white border border-gray-200 rounded-lg p-1 gap-1 mb-5 w-fit">
        {([
          { key: 'all', label: 'All' },
          { key: 'type_a', label: 'Type A — Out of Scope' },
          { key: 'type_b', label: 'Type B — Missing' },
          { key: 'type_c', label: 'Type C — Ambiguous' },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-brand-800 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}>
            {f.label}
            {f.key !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({gaps.filter(g => g.gap_type === f.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No gaps here</p>
          <p className="text-sm mt-1">Gaps appear when agents search and find nothing</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(gap => {
            const typeConfig = gap.gap_type ? GAP_TYPE_CONFIG[gap.gap_type] : null
            const TypeIcon = typeConfig?.icon ?? AlertTriangle
            const isHigh = gap.recurrence_count >= 5

            return (
              <div key={gap.id}
                className={`bg-white rounded-xl border shadow-sm p-5 ${
                  isHigh ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'
                }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {/* Recurrence badge */}
                      <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                        isHigh ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <RefreshCw className="w-2.5 h-2.5" />
                        {gap.recurrence_count}× seen
                      </span>

                      {/* Type badge */}
                      {typeConfig && (
                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${typeConfig.bg} ${typeConfig.color} ${typeConfig.border}`}>
                          <TypeIcon className="w-3 h-3" />
                          {typeConfig.label}
                        </span>
                      )}

                      {/* MCP server */}
                      {gap.mcp_server && (
                        <span className="text-xs text-gray-400">
                          via <span className="font-medium text-gray-600">{gap.mcp_server.name}</span>
                        </span>
                      )}
                    </div>

                    {/* Query */}
                    <p className="font-semibold text-gray-900 mb-1">
                      &ldquo;{gap.query_text}&rdquo;
                    </p>

                    {/* Context info */}
                    {gap.gap_type === 'type_a' && gap.candidate_article && (
                      <p className="text-sm text-blue-600 flex items-center gap-1.5 mt-1">
                        <FileText className="w-3.5 h-3.5" />
                        Found: &ldquo;{gap.candidate_article.title}&rdquo; — but outside MCP scope
                      </p>
                    )}
                    {gap.gap_type === 'type_b' && gap.suggested_title && (
                      <p className="text-sm text-gray-500 mt-1">
                        Suggested article: <span className="font-medium text-gray-700">&ldquo;{gap.suggested_title}&rdquo;</span>
                      </p>
                    )}

                    <p className="text-xs text-gray-400 mt-2">Last seen {formatDateTime(gap.last_seen_at)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {gap.gap_type === 'type_a' && gap.candidate_article && (
                      <button
                        onClick={() => handleResolve(gap, 'add_to_scope')}
                        disabled={loading === `${gap.id}-add_to_scope`}
                        className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap">
                        {loading === `${gap.id}-add_to_scope`
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Tag className="w-3 h-3" />}
                        Add to Scope
                      </button>
                    )}

                    {gap.gap_type === 'type_b' && (
                      <button
                        onClick={() => handleResolve(gap, 'create_article')}
                        disabled={loading === `${gap.id}-create_article`}
                        className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap">
                        {loading === `${gap.id}-create_article`
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Plus className="w-3 h-3" />}
                        Create AI Draft
                      </button>
                    )}

                    {gap.gap_type === 'type_c' && (
                      <button
                        onClick={() => router.push('/dashboard/articles/new')}
                        className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap">
                        <ArrowRight className="w-3 h-3" /> Review Manually
                      </button>
                    )}

                    <button
                      onClick={() => handleResolve(gap, 'dismiss')}
                      disabled={!!loading}
                      className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg text-xs transition-colors">
                      <X className="w-3 h-3" /> Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
