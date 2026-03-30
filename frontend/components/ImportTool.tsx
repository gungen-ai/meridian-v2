'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Upload, FileText, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react'

interface Category { id: string; name: string }
interface ParsedRow { title: string; content: string; valid: boolean; error?: string }

const CSV_TEMPLATE = `title,content
"How to reset your password","Go to the login page and click Forgot Password. Enter your email address and check your inbox for a reset link."
"Refund policy","We offer full refunds within 30 days of purchase. Contact support@example.com to initiate a refund."`

export default function ImportTool({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [defaultStatus, setDefaultStatus] = useState<'draft' | 'published'>('draft')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null)
  const [csvText, setCsvText] = useState('')

  function parseCSV(text: string): ParsedRow[] {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    // Simple CSV parser - handle quoted fields
    function parseLine(line: string): string[] {
      const fields: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          if (inQuotes && line[i+1] === '"') { current += '"'; i++ }
          else inQuotes = !inQuotes
        } else if (line[i] === ',' && !inQuotes) {
          fields.push(current.trim()); current = ''
        } else {
          current += line[i]
        }
      }
      fields.push(current.trim())
      return fields
    }

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim())
    const titleIdx = headers.indexOf('title')
    const contentIdx = headers.indexOf('content')

    if (titleIdx === -1) return []

    return lines.slice(1).filter(l => l.trim()).map(line => {
      const fields = parseLine(line)
      const title = fields[titleIdx] ?? ''
      const content = contentIdx !== -1 ? (fields[contentIdx] ?? '') : ''
      return {
        title: title.trim(),
        content: content.trim(),
        valid: title.trim().length > 0,
        error: title.trim().length === 0 ? 'Missing title' : undefined,
      }
    })
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setCsvText(text)
      setRows(parseCSV(text))
    }
    reader.readAsText(file)
  }

  function handleTextParse() {
    setRows(parseCSV(csvText))
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'kb_import_template.csv'; a.click()
  }

  async function handleImport() {
    const validRows = rows.filter(r => r.valid)
    if (validRows.length === 0) { toast.error('No valid rows to import'); return }

    setImporting(true)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validRows.map(r => ({ title: r.title, content: r.content })),
          category_id: categoryId || null,
          default_status: defaultStatus,
        }),
      })
      const { data } = await res.json()
      setResult(data)
      if (data.created > 0) toast.success(`${data.created} articles imported!`)
      if (data.failed > 0) toast.error(`${data.failed} rows failed`)
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
    }
  }

  const validCount = rows.filter(r => r.valid).length
  const invalidCount = rows.filter(r => !r.valid).length

  return (
    <div className="max-w-3xl space-y-6">
      {/* Format guide */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <h3 className="font-semibold text-blue-900 text-sm mb-1">CSV Format</h3>
        <p className="text-xs text-blue-700 mb-2">Required columns: <code className="bg-blue-100 px-1 rounded">title</code>, <code className="bg-blue-100 px-1 rounded">content</code></p>
        <button onClick={downloadTemplate}
          className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
          <FileText className="w-3 h-3" /> Download template CSV
        </button>
      </div>

      {/* Upload area */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Upload or Paste CSV</h2>

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50 transition-colors mb-4">
          <Upload className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">Click to upload CSV file</p>
          <p className="text-xs text-gray-400 mt-1">or paste CSV content below</p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
        </div>

        <div className="space-y-2">
          <textarea
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder={`Paste CSV here:\ntitle,content\n"My Article","Article content here..."`}
            rows={5}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          <button onClick={handleTextParse} disabled={!csvText.trim()}
            className="text-sm text-brand-600 font-medium hover:underline disabled:opacity-40">
            Parse CSV →
          </button>
        </div>
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Preview ({rows.length} rows)</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="w-3.5 h-3.5" /> {validCount} valid
              </span>
              {invalidCount > 0 && (
                <span className="flex items-center gap-1 text-red-500">
                  <XCircle className="w-3.5 h-3.5" /> {invalidCount} invalid
                </span>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {rows.map((row, i) => (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 ${!row.valid ? 'bg-red-50' : ''}`}>
                {row.valid
                  ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{row.title || '(no title)'}</p>
                  {row.content && <p className="text-xs text-gray-400 truncate mt-0.5">{row.content.slice(0, 100)}</p>}
                  {row.error && <p className="text-xs text-red-500 mt-0.5">{row.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import settings */}
      {validCount > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Import Settings</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">None</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Import as</label>
              <select value={defaultStatus} onChange={e => setDefaultStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="draft">Draft (review before publishing)</option>
                <option value="published">Published (immediately live)</option>
              </select>
            </div>
          </div>

          {defaultStatus === 'published' && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-800">Articles will be immediately visible to MCP agents. Make sure content is accurate before importing.</p>
            </div>
          )}

          <button onClick={handleImport} disabled={importing}
            className="flex items-center gap-2 bg-brand-800 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? 'Importing…' : `Import ${validCount} Article${validCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-xl border p-5 ${result.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Import complete
          </h3>
          <p className="text-sm">{result.created} articles created{result.failed > 0 ? `, ${result.failed} failed` : ''}</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.errors.map((e, i) => <li key={i} className="text-xs text-red-600">{e}</li>)}
            </ul>
          )}
          <button onClick={() => router.push('/dashboard/articles')}
            className="mt-3 text-sm text-brand-600 font-medium hover:underline">
            View all articles →
          </button>
        </div>
      )}
    </div>
  )
}
