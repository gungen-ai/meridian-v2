'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import { formatDate, formatDateTime } from '@/shared/lib/utils'
import toast from 'react-hot-toast'
import {
  Server, Tag, Activity, Copy, RefreshCw, Pause, Play,
  Trash2, ArrowLeft, Clock, BarChart3, Loader2, Shield
} from 'lucide-react'
import Link from 'next/link'

export default function McpServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [server, setServer] = useState<any>(null)
  const [queryLog, setQueryLog] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [newToken, setNewToken] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/mcp-servers/${id}`)
      .then(r => r.json())
      .then(({ data, query_log }) => {
        setServer(data)
        setQueryLog(query_log ?? [])
        setLoading(false)
      })
  }, [id])

  async function handleRotateToken() {
    setActionLoading('rotate')
    const res = await fetch(`/api/mcp-servers/${id}/rotate-token`, { method: 'POST' })
    const { raw_token, token_prefix } = await res.json()
    setNewToken(raw_token)
    setServer((s: any) => ({ ...s, token_prefix }))
    toast.success('Token rotated! Copy the new token.')
    setActionLoading(null)
  }

  async function handleTogglePause() {
    const newStatus = server.status === 'active' ? 'paused' : 'active'
    setActionLoading('pause')
    await fetch(`/api/mcp-servers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    setServer((s: any) => ({ ...s, status: newStatus }))
    toast.success(`Server ${newStatus}`)
    setActionLoading(null)
  }

  async function handleDelete() {
    if (!confirm('Delete this MCP server? This cannot be undone.')) return
    setActionLoading('delete')
    await fetch(`/api/mcp-servers/${id}`, { method: 'DELETE' })
    toast.success('Server deleted')
    router.push('/dashboard/mcp')
  }

  function copyToken(token: string) {
    navigator.clipboard.writeText(token)
    toast.success('Copied!')
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  )
  if (!server) return <div className="p-8 text-gray-500">Server not found</div>

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const displayToken = newToken ?? `[token-hidden — rotate to reveal]`

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/mcp" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> All MCP Servers
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center">
            <Server className="w-6 h-6 text-brand-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{server.name}</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                server.status === 'active' ? 'bg-green-100 text-green-700' :
                server.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-500'
              }`}>{server.status}</span>
            </div>
            {server.description && <p className="text-gray-500 text-sm mt-0.5">{server.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleRotateToken} disabled={actionLoading === 'rotate'}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            {actionLoading === 'rotate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Rotate Token
          </button>
          <button onClick={handleTogglePause} disabled={actionLoading === 'pause'}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            {server.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {server.status === 'active' ? 'Pause' : 'Resume'}
          </button>
          <button onClick={handleDelete} disabled={actionLoading === 'delete'}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-5">
          {/* New token display */}
          {newToken && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-800 mb-2">New token generated — copy it now!</p>
              <div className="flex items-center gap-2 bg-gray-900 text-green-400 rounded-lg px-3 py-2.5 font-mono text-xs break-all">
                <span className="flex-1">{newToken}</span>
                <button onClick={() => copyToken(newToken)} className="flex-shrink-0 text-gray-400 hover:text-white">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Endpoints */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-400" /> API Endpoints
            </h2>
            {[
              { method: 'POST', label: 'Search articles', path: `/api/mcp/[token]/search`, body: '{"query": "your question", "limit": 5}' },
              { method: 'GET',  label: 'Get article',     path: `/api/mcp/[token]/get?id=ARTICLE_ID` },
              { method: 'GET',  label: 'List articles',   path: `/api/mcp/[token]/list?page=1` },
            ].map(ep => (
              <div key={ep.label} className="mb-3 last:mb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${ep.method === 'POST' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {ep.method}
                  </span>
                  <span className="text-sm font-medium text-gray-700">{ep.label}</span>
                </div>
                <code className="block bg-gray-50 rounded px-3 py-1.5 text-xs text-gray-600 font-mono">
                  {appUrl}{ep.path.replace('[token]', server.token_prefix ? `···${server.token_prefix}` : 'TOKEN')}
                </code>
              </div>
            ))}
          </div>

          {/* Query Log */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Recent Queries</h2>
              <span className="text-xs text-gray-400 ml-auto">{queryLog.length} shown</span>
            </div>
            {queryLog.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {queryLog.map(log => (
                  <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                      log.tool_name === 'search' ? 'bg-purple-100 text-purple-700' :
                      log.tool_name === 'get' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{log.tool_name}</span>
                    <span className="text-sm text-gray-700 flex-1 truncate">
                      {log.query_text ?? '—'}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{log.result_count ?? 0} results</span>
                    {log.latency_ms && <span className="text-xs text-gray-400 flex-shrink-0">{log.latency_ms}ms</span>}
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatDateTime(log.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">
                No queries yet. Test with the cURL examples below.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Stats */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-400" /> Stats
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Total queries</dt>
                <dd className="font-semibold text-gray-900">{(server.total_queries ?? 0).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Rate limit</dt>
                <dd className="text-gray-700">{server.rate_limit_per_day?.toLocaleString()}/day</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Search only</dt>
                <dd className="text-gray-700">{server.search_only_mode ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Token</dt>
                <dd className="font-mono text-gray-600 text-xs">···{server.token_prefix}</dd>
              </div>
              {server.last_queried_at && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Last queried</dt>
                  <dd className="text-gray-600 text-xs">{formatDate(server.last_queried_at)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Tags in scope */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-400" /> Tags in Scope
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(server.tags ?? []).map((tag: any) => (
                <span key={tag.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                  {tag.name}
                </span>
              ))}
              {(server.tags ?? []).length === 0 && (
                <p className="text-xs text-gray-400">No tags configured</p>
              )}
            </div>
          </div>

          {/* Created */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" /> Details
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-700">{formatDate(server.created_at)}</dd>
              </div>
              {server.token_expires_at && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Token expires</dt>
                  <dd className="text-gray-700">{formatDate(server.token_expires_at)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
