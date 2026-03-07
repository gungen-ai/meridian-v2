import { createClient } from '@/lib/supabase/server'
import { formatDate, STATUS_CONFIG, FRESHNESS_CONFIG } from '@/lib/utils'
import Link from 'next/link'
import { Plus, Search, FileText } from 'lucide-react'

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('articles')
    .select(`
      id, title, status, freshness_label, freshness_score,
      published_at, updated_at,
      author:profiles!articles_author_id_fkey(full_name),
      category:categories(name, color),
      article_tags(tag:tags(name))
    `)
    .order('updated_at', { ascending: false })

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }

  const { data: articles } = await query.limit(50)

  const statuses = ['all', 'draft', 'in_review', 'approved', 'published', 'archived']

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Articles</h1>
          <p className="text-gray-500 mt-1">{articles?.length ?? 0} articles</p>
        </div>
        <Link href="/dashboard/articles/new"
          className="flex items-center gap-2 bg-brand-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors">
          <Plus className="w-4 h-4" /> New Article
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex bg-white border border-gray-200 rounded-lg p-1 gap-1">
          {statuses.map(s => (
            <Link
              key={s}
              href={`/dashboard/articles${s !== 'all' ? `?status=${s}` : ''}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                (params.status === s || (!params.status && s === 'all'))
                  ? 'bg-brand-800 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s === 'in_review' ? 'In Review' : s}
            </Link>
          ))}
        </div>
      </div>

      {/* Articles table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {articles && articles.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Freshness</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Author</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {articles.map(article => {
                const status = STATUS_CONFIG[article.status as keyof typeof STATUS_CONFIG]
                const freshness = FRESHNESS_CONFIG[article.freshness_label as keyof typeof FRESHNESS_CONFIG]
                return (
                  <tr key={article.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/dashboard/articles/${article.id}`} className="group">
                        <p className="font-medium text-gray-900 group-hover:text-brand-600 transition-colors">{article.title}</p>
                        {(article.category as any) && (
                          <span className="text-xs text-gray-400">{(article.category as any).name}</span>
                        )}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {article.status === 'published' ? (
                        <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full w-fit ${freshness.bg} ${freshness.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${freshness.dot}`} />
                          {freshness.label}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">{(article.author as any)?.full_name ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{formatDate(article.updated_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No articles found</p>
            <p className="text-sm mt-1">
              <Link href="/dashboard/articles/new" className="text-brand-600 hover:underline">Create your first article</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
