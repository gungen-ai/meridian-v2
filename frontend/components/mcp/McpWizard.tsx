'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Tag, Category } from '@/shared/types'
import type { WizardState } from '@/shared/types/mcp'
import {
  Sparkles, ArrowRight, ArrowLeft, CheckCircle,
  Loader2, Copy, Terminal, Zap, Tag as TagIcon,
  Shield, Settings
} from 'lucide-react'

interface Props {
  tags: (Tag & { category: Category })[]
}

const STEPS = [
  { n: 1, label: 'Name', icon: Settings },
  { n: 2, label: 'Scope',  icon: TagIcon },
  { n: 3, label: 'Access', icon: Shield },
  { n: 4, label: 'Generate', icon: Zap },
  { n: 5, label: 'Integrate', icon: Terminal },
]

export default function McpWizard({ tags }: Props) {
  const router = useRouter()
  const [state, setState] = useState<WizardState>({
    step: 1,
    name: '', description: '',
    tag_ids: [],
    rate_limit_per_min: 60,
    rate_limit_per_day: 5000,
    search_only_mode: false,
    token_expires_at: '',
  })
  const [loading, setLoading] = useState(false)
  const [scopeLoading, setScopeLoading] = useState(false)
  const [articleCount, setArticleCount] = useState<number | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const grouped = tags.reduce<Record<string, (Tag & { category: Category })[]>>((acc, tag) => {
    const cat = tag.category?.name ?? 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tag)
    return acc
  }, {})

  // AI scope suggestion
  async function handleScopeSuggest() {
    if (!state.description) { toast.error('Add a description first'); return }
    setScopeLoading(true)
    try {
      const res = await fetch('/api/mcp-servers/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: state.description })
      })
      const { data, article_count } = await res.json()
      setState(s => ({ ...s, tag_ids: data ?? [] }))
      setArticleCount(article_count ?? 0)
      toast.success(`AI suggested ${(data ?? []).length} tags`)
    } catch {
      toast.error('Suggestion failed')
    } finally {
      setScopeLoading(false)
    }
  }

  // Live article count when tags change
  async function updateArticleCount(tagIds: string[]) {
    if (tagIds.length === 0) { setArticleCount(0); return }
    const res = await fetch(`/api/mcp-servers/suggest/scope-suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: '_count_only_', tag_ids: tagIds })
    })
    // We only need the count — reuse endpoint with dummy description
  }

  function toggleTag(tagId: string) {
    setState(s => ({
      ...s,
      tag_ids: s.tag_ids.includes(tagId)
        ? s.tag_ids.filter(id => id !== tagId)
        : [...s.tag_ids, tagId]
    }))
  }

  // Generate the MCP server
  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch('/api/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.name,
          description: state.description,
          tag_ids: state.tag_ids,
          rate_limit_per_min: state.rate_limit_per_min,
          rate_limit_per_day: state.rate_limit_per_day,
          search_only_mode: state.search_only_mode,
          token_expires_at: state.token_expires_at || null,
        })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const { data, raw_token } = await res.json()
      setState(s => ({ ...s, step: 5, created_server: data, raw_token }))
      toast.success('MCP server created!')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    toast.success('Copied!')
    setTimeout(() => setCopied(null), 2000)
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  const token = state.raw_token ?? ''
  const serverId = state.created_server?.id ?? ''

  const claudeConfig = JSON.stringify({
    mcpServers: {
      [state.name.toLowerCase().replace(/\s+/g, '-')]: {
        command: 'curl',
        args: ['-s', '-X', 'POST', `${appUrl}/api/mcp/${token}/search`,
          '-H', 'Content-Type: application/json', '-d', '{"query": "{{query}}"}'],
      }
    }
  }, null, 2)

  const curlExample = `# Search articles
curl -X POST '${appUrl}/api/mcp/${token}/search' \\
  -H 'Content-Type: application/json' \\
  -d '{"query": "your question here", "limit": 5}'

# List all articles
curl '${appUrl}/api/mcp/${token}/list'

# Get specific article
curl '${appUrl}/api/mcp/${token}/get?id=ARTICLE_ID'`

  const pythonExample = `import requests

BASE = "${appUrl}/api/mcp/${token}"

# Search
r = requests.post(f"{BASE}/search", json={"query": "billing policy"})
articles = r.json()["resources"]

# Get full article
r = requests.get(f"{BASE}/get", params={"id": articles[0]["uri"].split("/")[-1]})
article = r.json()["resource"]
print(article["content_text"])`

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center mb-10">
        {STEPS.map((step, i) => (
          <div key={step.n} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                state.step > step.n ? 'bg-green-500 border-green-500' :
                state.step === step.n ? 'bg-brand-800 border-brand-800' :
                'bg-white border-gray-200'
              }`}>
                {state.step > step.n
                  ? <CheckCircle className="w-5 h-5 text-white" />
                  : <step.icon className={`w-4 h-4 ${state.step === step.n ? 'text-white' : 'text-gray-400'}`} />
                }
              </div>
              <span className={`text-xs mt-1.5 font-medium ${
                state.step === step.n ? 'text-brand-800' : 'text-gray-400'
              }`}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-5 transition-colors ${
                state.step > step.n ? 'bg-green-400' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Name ── */}
      {state.step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Name your MCP server</h2>
          <p className="text-gray-500 mb-6">Give it a name that describes the AI agent use case.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Server name <span className="text-red-400">*</span></label>
              <input type="text" value={state.name}
                onChange={e => setState(s => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Customer Support Bot — Tier 1"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Use case description</label>
              <textarea value={state.description}
                onChange={e => setState(s => ({ ...s, description: e.target.value }))}
                placeholder="Describe what this AI agent needs to do. Claude will use this to suggest the right KB articles to include."
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">This description is used by AI to suggest the right tags in the next step.</p>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button onClick={() => setState(s => ({ ...s, step: 2 }))}
              disabled={!state.name}
              className="flex items-center gap-2 bg-brand-800 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Scope ── */}
      {state.step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Select KB scope</h2>
          <p className="text-gray-500 mb-4">Choose which tags this MCP server can access. Agents will only see articles with these tags.</p>

          {state.description && (
            <button onClick={handleScopeSuggest} disabled={scopeLoading}
              className="flex items-center gap-2 border border-purple-200 text-purple-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-50 disabled:opacity-50 transition-colors mb-5">
              {scopeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              AI Suggest Tags from Description
            </button>
          )}

          <div className="border border-gray-200 rounded-xl overflow-hidden mb-4 max-h-72 overflow-y-auto">
            {Object.entries(grouped).map(([category, categoryTags]) => (
              <div key={category}>
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</p>
                </div>
                {categoryTags.map(tag => (
                  <label key={tag.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0">
                    <input type="checkbox"
                      checked={state.tag_ids.includes(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                      className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-800">{tag.name}</span>
                    {tag.description && <span className="text-xs text-gray-400 ml-auto truncate max-w-32">{tag.description}</span>}
                  </label>
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between bg-brand-50 rounded-lg px-4 py-3 mb-6">
            <span className="text-sm text-brand-700 font-medium">
              {state.tag_ids.length} tag{state.tag_ids.length !== 1 ? 's' : ''} selected
            </span>
            {articleCount !== null && (
              <span className="text-sm text-brand-600">
                ~{articleCount} published article{articleCount !== 1 ? 's' : ''} in scope
              </span>
            )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setState(s => ({ ...s, step: 1 }))}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={() => setState(s => ({ ...s, step: 3 }))}
              disabled={state.tag_ids.length === 0}
              className="flex items-center gap-2 bg-brand-800 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Access Rules ── */}
      {state.step === 3 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Configure access rules</h2>
          <p className="text-gray-500 mb-6">Set rate limits and access restrictions for this MCP server.</p>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate limit (per minute)</label>
                <input type="number" value={state.rate_limit_per_min}
                  onChange={e => setState(s => ({ ...s, rate_limit_per_min: parseInt(e.target.value) }))}
                  min={1} max={1000}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate limit (per day)</label>
                <input type="number" value={state.rate_limit_per_day}
                  onChange={e => setState(s => ({ ...s, rate_limit_per_day: parseInt(e.target.value) }))}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Token expiry (optional)</label>
              <input type="date" value={state.token_expires_at}
                onChange={e => setState(s => ({ ...s, token_expires_at: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank for a non-expiring token.</p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
              <input type="checkbox" checked={state.search_only_mode}
                onChange={e => setState(s => ({ ...s, search_only_mode: e.target.checked }))}
                className="mt-0.5 w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">Search-only mode</p>
                <p className="text-xs text-gray-500">Agents can search but cannot enumerate all articles via the list endpoint. Recommended for public-facing agents.</p>
              </div>
            </label>
          </div>

          <div className="flex justify-between mt-6">
            <button onClick={() => setState(s => ({ ...s, step: 2 }))}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={() => setState(s => ({ ...s, step: 4 }))}
              className="flex items-center gap-2 bg-brand-800 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition-colors">
              Review & Generate <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Review & Generate ── */}
      {state.step === 4 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Review & generate</h2>
          <p className="text-gray-500 mb-6">Confirm your configuration and generate the MCP server.</p>

          <div className="space-y-3 mb-6">
            {[
              { label: 'Server name', value: state.name },
              { label: 'Tags in scope', value: `${state.tag_ids.length} tag${state.tag_ids.length !== 1 ? 's' : ''}` },
              { label: 'Rate limit', value: `${state.rate_limit_per_min}/min · ${state.rate_limit_per_day}/day` },
              { label: 'Search-only mode', value: state.search_only_mode ? 'Yes' : 'No' },
              { label: 'Token expiry', value: state.token_expires_at || 'Never' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2.5 border-b border-gray-100 text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
            <p className="text-xs text-amber-800">
              <strong>Important:</strong> The access token will be shown once after generation. Copy and store it securely — it cannot be retrieved again (only rotated).
            </p>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setState(s => ({ ...s, step: 3 }))}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={handleGenerate} disabled={loading}
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loading ? 'Generating…' : 'Generate MCP Server'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Integration Guide ── */}
      {state.step === 5 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">MCP server ready!</h2>
              <p className="text-gray-500 text-sm">Your server is live. Copy the token — it won&apos;t be shown again.</p>
            </div>
          </div>

          {/* Token */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Access Token (copy now)</label>
            <div className="flex items-center gap-2 bg-gray-900 text-green-400 rounded-lg px-4 py-3 font-mono text-xs break-all">
              <span className="flex-1">{token}</span>
              <button onClick={() => copyToClipboard(token, 'token')}
                className="flex-shrink-0 text-gray-400 hover:text-white transition-colors">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Code examples */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">cURL (test it now)</label>
                <button onClick={() => copyToClipboard(curlExample, 'curl')}
                  className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                  <Copy className="w-3 h-3" /> {copied === 'curl' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">
                {curlExample}
              </pre>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Python</label>
                <button onClick={() => copyToClipboard(pythonExample, 'python')}
                  className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                  <Copy className="w-3 h-3" /> {copied === 'python' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">
                {pythonExample}
              </pre>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => router.push(`/dashboard/mcp/${state.created_server?.id}`)}
              className="flex-1 bg-brand-800 text-white py-2.5 rounded-lg font-medium hover:bg-brand-700 transition-colors text-center">
              View Server Dashboard
            </button>
            <button onClick={() => router.push('/dashboard/mcp')}
              className="px-4 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
              All Servers
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
