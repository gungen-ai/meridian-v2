'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, AlertTriangle, Tag, Plus, FileText, Zap, BarChart2 } from 'lucide-react'

interface McpServer {
  id: string
  name: string
  tag_ids: string[]
  tags: { id: string; name: string; category: { name: string; color: string } }[]
}

interface SearchResult {
  id: string
  title: string
  snippet: string
  updated_at: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  query?: string
  results?: SearchResult[]
  is_gap?: boolean
  gap_type?: 'type_a' | 'type_b' | 'type_c' | null
  answer?: string | null
  latency_ms?: number
  error?: string
}

const GAP_CONFIG = {
  type_a: {
    label: 'Out of Scope',
    desc: 'Content exists in KB but outside this server\'s tag scope.',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: Tag,
  },
  type_b: {
    label: 'Missing Content',
    desc: 'No matching content found anywhere in the KB.',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: Plus,
  },
  type_c: {
    label: 'Ambiguous Match',
    desc: 'Partial or unclear match — may need manual review.',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: AlertTriangle,
  },
}

export default function QuerySimulator({ servers }: { servers: McpServer[] }) {
  const [selectedServerId, setSelectedServerId] = useState<string>(servers[0]?.id ?? '')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [activeResult, setActiveResult] = useState<Message | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Session stats
  const totalQueries = messages.filter(m => m.role === 'assistant').length
  const totalResults = messages.filter(m => m.role === 'assistant').reduce((s, m) => s + (m.results?.length ?? 0), 0)
  const totalGaps = messages.filter(m => m.role === 'assistant' && m.is_gap).length

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectedServer = servers.find(s => s.id === selectedServerId)

  async function handleSend() {
    const query = input.trim()
    if (!query || !selectedServerId || loading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', query }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/simulator/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: selectedServerId, query, limit: 5 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Search failed')

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        results: data.resources,
        is_gap: data.is_gap,
        gap_type: data.gap_type,
        answer: data.answer ?? null,
        latency_ms: data.latency_ms,
      }
      setMessages(prev => [...prev, assistantMsg])
      setActiveResult(assistantMsg)
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        error: err.message,
        results: [],
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-180px)]">

      {/* Left: chat panel */}
      <div className="flex flex-col flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden">

        {/* Server selector */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600 shrink-0">MCP Server</label>
          <select
            value={selectedServerId}
            onChange={e => { setSelectedServerId(e.target.value); setMessages([]); setActiveResult(null) }}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {servers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {selectedServer && (
            <div className="flex gap-1.5 flex-wrap">
              {selectedServer.tags.slice(0, 3).map(t => (
                <span key={t.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {t.name}
                </span>
              ))}
              {selectedServer.tags.length > 3 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  +{selectedServer.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-2">
              <Zap className="w-8 h-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">Simulate an agent query</p>
              <p className="text-xs">Type a customer question below to see what the MCP agent would return</p>
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="bg-blue-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[75%]">
                    {msg.query}
                  </div>
                </div>
              )
            }

            // assistant
            if (msg.error) {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[75%]">
                    Error: {msg.error}
                  </div>
                </div>
              )
            }

            if (msg.is_gap && msg.gap_type) {
              const cfg = GAP_CONFIG[msg.gap_type]
              const Icon = cfg.icon
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className={`${cfg.bg} border ${cfg.border} text-sm px-4 py-3 rounded-2xl rounded-tl-sm max-w-[75%]`}>
                    <div className={`flex items-center gap-2 font-semibold ${cfg.color} mb-1`}>
                      <Icon className="w-4 h-4" />
                      Gap detected — {cfg.label}
                    </div>
                    <p className="text-gray-600 text-xs">{cfg.desc}</p>
                    {msg.latency_ms !== undefined && (
                      <p className="text-gray-400 text-xs mt-1">{msg.latency_ms}ms</p>
                    )}
                  </div>
                </div>
              )
            }

            return (
              <div key={msg.id} className="flex justify-start flex-col gap-2 max-w-[80%]">
                {msg.answer && (
                  <div className="bg-white border border-gray-200 text-sm px-4 py-3 rounded-2xl rounded-tl-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {msg.answer}
                  </div>
                )}
                <button
                  onClick={() => setActiveResult(msg)}
                  className={`text-left bg-gray-50 border text-sm px-4 py-3 rounded-2xl rounded-tl-sm transition-colors hover:bg-gray-100 ${
                    activeResult?.id === msg.id ? 'border-blue-300 bg-blue-50 hover:bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <p className="font-medium text-gray-800 mb-0.5">
                    {msg.results?.length} article{msg.results?.length !== 1 ? 's' : ''} found
                  </p>
                  <p className="text-gray-500 text-xs truncate">
                    {msg.results?.map(r => r.title).join(', ')}
                  </p>
                  {msg.latency_ms !== undefined && (
                    <p className="text-gray-400 text-xs mt-1">{msg.latency_ms}ms</p>
                  )}
                </button>
              </div>
            )
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm">
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-100 bg-white">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a customer question…"
              rows={1}
              className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !selectedServerId || loading}
              className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white rounded-xl transition-colors shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>

      {/* Right: results panel + stats */}
      <div className="w-80 flex flex-col gap-4 shrink-0">

        {/* Session stats */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Session Stats</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Queries', value: totalQueries, color: 'text-gray-900' },
              { label: 'Results', value: totalResults, color: 'text-green-700' },
              { label: 'Gaps', value: totalGaps, color: totalGaps > 0 ? 'text-red-600' : 'text-gray-400' },
            ].map(s => (
              <div key={s.label} className="text-center bg-gray-50 rounded-lg py-2 px-1">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Article results */}
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden flex-1">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">
              {activeResult ? `${activeResult.results?.length ?? 0} Matched Articles` : 'Matched Articles'}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!activeResult && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm text-center p-6">
                <FileText className="w-6 h-6 text-gray-300 mb-2" />
                Click a result to see matched articles
              </div>
            )}
            {activeResult && (activeResult.results?.length ?? 0) === 0 && !activeResult.is_gap && (
              <div className="p-4 text-sm text-gray-400 text-center">No articles matched.</div>
            )}
            {activeResult?.is_gap && activeResult.gap_type && (
              <div className="p-4">
                <div className={`${GAP_CONFIG[activeResult.gap_type].bg} border ${GAP_CONFIG[activeResult.gap_type].border} rounded-lg p-3`}>
                  <p className={`text-sm font-semibold ${GAP_CONFIG[activeResult.gap_type].color}`}>
                    {GAP_CONFIG[activeResult.gap_type].label}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{GAP_CONFIG[activeResult.gap_type].desc}</p>
                </div>
              </div>
            )}
            {activeResult?.results?.map(r => (
              <div key={r.id} className="px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <p className="text-sm font-medium text-gray-900 mb-1">{r.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{r.snippet}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
