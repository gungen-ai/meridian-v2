'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Sparkles, Link, FileText, AlignLeft,
  Loader2, CheckCircle, XCircle, ArrowRight,
  Upload, Clock
} from 'lucide-react'

interface Category { id: string; name: string }
type Tab = 'bulk' | 'url' | 'document' | 'outline'
type JobStatus = 'queued' | 'drafting' | 'created' | 'error'
interface Job { topic: string; status: JobStatus; article_id?: string; error?: string }

const TABS = [
  { key: 'bulk' as Tab,     label: 'Bulk Generate',  icon: Sparkles,  desc: 'Give Claude a list of topics' },
  { key: 'url' as Tab,      label: 'From URL',        icon: Link,      desc: 'Paste any web page URL' },
  { key: 'document' as Tab, label: 'From Document',   icon: FileText,  desc: 'Upload PDF, TXT, or paste text' },
  { key: 'outline' as Tab,  label: 'Expand Outline',  icon: AlignLeft, desc: 'Bullet points → full article' },
]

export default function ContentStudio({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('bulk')
  const [categoryId, setCategoryId] = useState('')
  const [tone, setTone] = useState('professional')
  const fileRef = useRef<HTMLInputElement>(null)

  // Bulk
  const [topics, setTopics] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])

  // URL
  const [url, setUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlResult, setUrlResult] = useState<any>(null)

  // Document
  const [docText, setDocText] = useState('')
  const [docFilename, setDocFilename] = useState('')
  const [splitMultiple, setSplitMultiple] = useState(false)
  const [docLoading, setDocLoading] = useState(false)
  const [docResults, setDocResults] = useState<any[]>([])

  // Outline
  const [outline, setOutline] = useState('')
  const [outlineLoading, setOutlineLoading] = useState(false)
  const [outlineResult, setOutlineResult] = useState<any>(null)

  const topicList = topics.split('\n').map(t => t.trim()).filter(Boolean)

  async function handleBulkGenerate() {
    if (topicList.length === 0) { toast.error('Enter at least one topic'); return }
    if (topicList.length > 20) { toast.error('Maximum 20 topics at once'); return }
    const initialJobs: Job[] = topicList.map(t => ({ topic: t, status: 'queued' }))
    setJobs(initialJobs)
    setBulkLoading(true)
    try {
      const res = await fetch('/api/studio/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: topicList, category_id: categoryId || null, tone }),
      })
      const { data } = await res.json()
      setJobs((data ?? []).map((r: any) => ({
        topic: r.topic,
        status: r.status === 'created' ? 'created' : 'error',
        article_id: r.article_id,
        error: r.error,
      })))
      const created = (data ?? []).filter((r: any) => r.status === 'created').length
      toast.success(`${created} article${created !== 1 ? 's' : ''} drafted!`)
    } catch { toast.error('Generation failed'); setJobs([]) }
    finally { setBulkLoading(false) }
  }

  async function handleUrlImport() {
    if (!url.trim()) { toast.error('Enter a URL'); return }
    setUrlLoading(true); setUrlResult(null)
    try {
      const res = await fetch('/api/studio/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), category_id: categoryId || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setUrlResult(json.data)
      toast.success('Article drafted from URL!')
    } catch (e: any) { toast.error(e.message) }
    finally { setUrlLoading(false) }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setDocFilename(file.name)
    const reader = new FileReader()
    reader.onload = ev => setDocText(ev.target?.result as string ?? '')
    reader.readAsText(file)
  }

  async function handleDocImport() {
    if (!docText.trim()) { toast.error('Upload a file or paste text'); return }
    setDocLoading(true); setDocResults([])
    try {
      const res = await fetch('/api/studio/from-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: docText, filename: docFilename, category_id: categoryId || null, split_into_multiple: splitMultiple }),
      })
      const { data } = await res.json()
      setDocResults(data ?? [])
      toast.success(`${(data ?? []).length} article${(data ?? []).length !== 1 ? 's' : ''} created!`)
    } catch { toast.error('Import failed') }
    finally { setDocLoading(false) }
  }

  async function handleOutlineExpand() {
    if (!outline.trim()) { toast.error('Enter an outline'); return }
    setOutlineLoading(true); setOutlineResult(null)
    try {
      const res = await fetch('/api/studio/from-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outline: outline.trim(), category_id: categoryId || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setOutlineResult(json.data)
      toast.success('Article expanded!')
    } catch (e: any) { toast.error(e.message) }
    finally { setOutlineLoading(false) }
  }

  const showProgress = jobs.length > 0 || urlResult || docResults.length > 0 || outlineResult

  return (
    <div className="flex gap-6">
      {/* Left: main content */}
      <div className="flex-1 min-w-0">

        {/* Tab bar */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`p-4 rounded-xl border text-left transition-all ${
                tab === t.key
                  ? 'bg-brand-800 border-brand-800 text-white shadow-md'
                  : 'bg-white border-gray-100 text-gray-600 hover:border-brand-200 shadow-sm'
              }`}>
              <t.icon className={`w-5 h-5 mb-2 ${tab === t.key ? 'text-white' : 'text-gray-400'}`} />
              <p className={`text-sm font-semibold ${tab === t.key ? 'text-white' : 'text-gray-800'}`}>{t.label}</p>
              <p className={`text-xs mt-0.5 ${tab === t.key ? 'text-brand-200' : 'text-gray-400'}`}>{t.desc}</p>
            </button>
          ))}
        </div>

        {/* Category + Tone row */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 flex-shrink-0">Category</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">None</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {tab === 'bulk' && (
            <>
              <label className="text-sm font-medium text-gray-700 flex-shrink-0">Tone</label>
              <select value={tone} onChange={e => setTone(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="technical">Technical</option>
                <option value="concise">Concise</option>
              </select>
            </>
          )}
          <p className="text-xs text-gray-400 ml-auto">All articles created here go to Drafts for review</p>
        </div>

        {/* Bulk Generate */}
        {tab === 'bulk' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Bulk Generate from Topics</h2>
            <p className="text-sm text-gray-500 mb-4">One topic per line. Claude will draft a full article for each.</p>
            <textarea value={topics} onChange={e => setTopics(e.target.value)}
              placeholder={"How to reset your password\nRefund policy\nGetting started guide\nTroubleshooting login issues"}
              rows={8}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none font-mono"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-400">{topicList.length} / 20 topics</span>
            </div>
            <button onClick={handleBulkGenerate} disabled={bulkLoading || !topics.trim()}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-brand-800 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {bulkLoading ? 'Generating…' : 'Generate All Drafts'}
            </button>
          </div>
        )}

        {/* URL Import */}
        {tab === 'url' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Import from URL</h2>
            <p className="text-sm text-gray-500 mb-4">Claude fetches the page and rewrites it as a clean KB article.</p>
            <div className="flex gap-2">
              <input type="url" value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://docs.example.com/getting-started"
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button onClick={handleUrlImport} disabled={urlLoading || !url.trim()}
                className="flex items-center gap-2 bg-brand-800 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors whitespace-nowrap">
                {urlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                {urlLoading ? 'Fetching…' : 'Import'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">Works best with documentation pages, help articles, and blog posts.</p>
          </div>
        )}

        {/* Document Upload */}
        {tab === 'document' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Import from Document</h2>
            <p className="text-sm text-gray-500 mb-4">Upload a TXT file or paste document content.</p>
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50 transition-colors mb-4">
              <Upload className="w-6 h-6 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">
                {docFilename ? <span className="font-medium text-gray-800">{docFilename}</span> : 'Click to upload TXT file'}
              </p>
              <input ref={fileRef} type="file" accept=".txt,.md,.csv" className="hidden" onChange={handleFileUpload} />
            </div>
            <textarea value={docText} onChange={e => setDocText(e.target.value)}
              placeholder="Or paste document content here…" rows={6}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
            <label className="flex items-center gap-3 mt-3 cursor-pointer">
              <input type="checkbox" checked={splitMultiple} onChange={e => setSplitMultiple(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm text-gray-700">Split into multiple articles</span>
            </label>
            <button onClick={handleDocImport} disabled={docLoading || !docText.trim()}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-brand-800 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {docLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {docLoading ? 'Processing…' : 'Convert to Article'}
            </button>
          </div>
        )}

        {/* Outline */}
        {tab === 'outline' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Expand Outline to Article</h2>
            <p className="text-sm text-gray-500 mb-4">Paste bullet points or a rough outline. Claude writes the full article.</p>
            <textarea value={outline} onChange={e => setOutline(e.target.value)}
              placeholder={"Password Reset Guide\n- Why users need to reset\n- Step 1: Go to login page\n- Step 2: Click forgot password\n- Step 3: Check email"}
              rows={10}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
            <button onClick={handleOutlineExpand} disabled={outlineLoading || !outline.trim()}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-brand-800 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {outlineLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlignLeft className="w-4 h-4" />}
              {outlineLoading ? 'Expanding…' : 'Expand to Full Article'}
            </button>
          </div>
        )}
      </div>

      {/* Right: Generation Progress panel */}
      <div className="w-72 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm sticky top-8">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Generation Progress</h3>
            <span className="text-xs text-gray-400">
              {jobs.filter(j => j.status === 'created').length} / {jobs.length > 0 ? jobs.length : topicList.length} topics
            </span>
          </div>

          {/* Progress bar */}
          {jobs.length > 0 && (
            <div className="px-5 pt-3">
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-brand-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${jobs.length > 0 ? (jobs.filter(j => j.status === 'created' || j.status === 'error').length / jobs.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="px-5 py-4 space-y-3 max-h-96 overflow-y-auto">
            {jobs.length === 0 && !urlResult && docResults.length === 0 && !outlineResult && (
              <div className="text-center py-6">
                <Clock className="w-6 h-6 mx-auto mb-2 text-gray-200" />
                <p className="text-sm text-gray-400">Nothing generated yet</p>
              </div>
            )}

            {/* Bulk jobs */}
            {jobs.map((job, i) => (
              <div key={i} className="flex items-center gap-2">
                {job.status === 'created' && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                {job.status === 'error' && <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                {job.status === 'drafting' && <Loader2 className="w-4 h-4 text-brand-500 animate-spin flex-shrink-0" />}
                {job.status === 'queued' && <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{job.topic}</p>
                  <p className="text-xs text-gray-400 capitalize">{job.status === 'queued' ? 'Queued' : job.status === 'drafting' ? 'Drafting...' : job.status === 'created' ? 'Done' : job.error ?? 'Error'}</p>
                </div>
                {job.status === 'created' && job.article_id && (
                  <button onClick={() => router.push(`/dashboard/articles/${job.article_id}/edit`)}
                    className="text-xs text-brand-600 hover:underline flex-shrink-0">
                    Edit
                  </button>
                )}
              </div>
            ))}

            {/* URL result */}
            {urlResult && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <p className="text-sm text-gray-700 truncate flex-1">{urlResult.title}</p>
                <button onClick={() => router.push(`/dashboard/articles/${urlResult.id}/edit`)}
                  className="text-xs text-brand-600 hover:underline flex-shrink-0">Edit</button>
              </div>
            )}

            {/* Doc results */}
            {docResults.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <p className="text-sm text-gray-700 truncate flex-1">{r.title}</p>
                <button onClick={() => router.push(`/dashboard/articles/${r.id}/edit`)}
                  className="text-xs text-brand-600 hover:underline flex-shrink-0">Edit</button>
              </div>
            ))}

            {/* Outline result */}
            {outlineResult && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <p className="text-sm text-gray-700 truncate flex-1">{outlineResult.title}</p>
                <button onClick={() => router.push(`/dashboard/articles/${outlineResult.id}/edit`)}
                  className="text-xs text-brand-600 hover:underline flex-shrink-0">Edit</button>
              </div>
            )}
          </div>

          {jobs.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100">
              <button onClick={() => router.push('/dashboard/articles?status=draft')}
                className="text-sm text-brand-600 font-medium hover:underline flex items-center gap-1">
                View all drafts <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}