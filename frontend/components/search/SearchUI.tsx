'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Search, FileText, Tag, Clock, Loader2, X } from 'lucide-react'
import { FRESHNESS_CONFIG, formatDate } from '@/shared/lib/utils'

interface Category { id: string; name: string; color: string }
interface TagItem { id: string; name: string; category_id: string }

interface SearchResult {
  id: string
  title: string
  snippet: string
  freshness_label: string
  updated_at: string
  author: { full_name: string } | null
  category: { name: string; color: string } | null
  article_tags: { tag: { id: string; name: string } }[]
}

export default function SearchUI({ categories, tags }: { categories: Category[]; tags: TagItem[] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const debounceRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (query.length < 2) { setResults([]); setSearched(false); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(doSearch, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query, categoryId])

  async function doSearch() {
    if (query.length < 2) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ q: query })
      if (categoryId) params.set('category_id', categoryId)
      const res = await fetch(`/api/search?${params}`)
      const { data } = await res.json()
      setResults(data ?? [])
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  function highlight(text: string, q: string) {
    if (!q) return text
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase()
        ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{part}</mark>
        : part
    )
  }

  return (
    <div className="max-w-3xl">
      {/* Search input */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search articles…"
            autoFocus
            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 bg-white shadow-sm"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); setSearched(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
          className="px-3 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white shadow-sm">
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-gray-400 py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Searching…
        </div>
      )}

      {/* Results */}
      {!loading && searched && (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            {results.length === 0
              ? `No results for "${query}"`
              : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`}
          </p>

          <div className="space-y-3">
            {results.map(article => {
              const freshness = FRESHNESS_CONFIG[article.freshness_label as keyof typeof FRESHNESS_CONFIG]
              return (
                <Link key={article.id} href={`/dashboard/articles/${article.id}`}
                  className="block bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-brand-200 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900 group-hover:text-brand-700">
                      {highlight(article.title, query)}
                    </h3>
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${freshness.bg} ${freshness.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${freshness.dot}`} />
                      {freshness.label}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    {highlight(article.snippet, query)}
                  </p>

                  <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    {article.author && (
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" /> {article.author.full_name}
                      </span>
                    )}
                    {article.category && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: article.category.color }} />
                        {article.category.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDate(article.updated_at)}
                    </span>
                    {article.article_tags?.slice(0, 3).map(at => (
                      <span key={at.tag.id} className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        <Tag className="w-2.5 h-2.5" /> {at.tag.name}
                      </span>
                    ))}
                  </div>
                </Link>
              )
            })}
          </div>

          {results.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No articles found</p>
              <p className="text-sm mt-1">Try different keywords or{' '}
                <Link href="/dashboard/articles/new" className="text-brand-600 hover:underline">create a new article</Link>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!searched && !loading && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Start typing to search</p>
          <p className="text-sm mt-1">Searches titles and full article content</p>
        </div>
      )}
    </div>
  )
}
