import { createClient } from '@/backend/supabase/server'
import { formatDate, STATUS_CONFIG, FRESHNESS_CONFIG } from '@/shared/lib/utils'
import Link from 'next/link'
import { FileText, Tag, CheckCircle, AlertTriangle, ArrowRight, Activity } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { count: totalArticles },
    { count: publishedArticles },
    { count: inReviewArticles },
    { data: recentArticles },
    { data: myReviewTasks },
  ] = await Promise.all([
    supabase.from('articles').select('*', { count: 'exact', head: true }),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'in_review'),
    supabase.from('articles')
      .select('id, title, status, freshness_label, updated_at, author:profiles!articles_author_id_fkey(full_name)')
      .order('updated_at', { ascending: false })
      .limit(6),
    supabase.from('review_tasks')
      .select('id, article:articles(id, title), assigned_at')
      .eq('reviewer_id', user!.id)
      .eq('status', 'awaiting')
      .limit(5),
  ])

  const total = totalArticles ?? 0
  const published = publishedArticles ?? 0
  const systemHealth = total > 0 ? Math.round((published / total) * 100) : 98

  const stats = [
    { label: 'Total Articles',   value: total,            icon: FileText,      color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Live Articles',    value: published,         icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Pending Reviews',  value: inReviewArticles ?? 0, icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: 'System Health',    value: `${systemHealth}%`, icon: Activity,    color: 'text-green-600',  bg: 'bg-green-50' },
  ]

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome back — here&apos;s what&apos;s happening</h1>
        <Link href="/dashboard/articles/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm">
          Create New
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className={`w-11 h-11 ${stat.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Articles */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Articles</h2>
            <Link href="/dashboard/articles" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentArticles?.map(article => {
              const status = STATUS_CONFIG[article.status as keyof typeof STATUS_CONFIG]
              const freshness = FRESHNESS_CONFIG[article.freshness_label as keyof typeof FRESHNESS_CONFIG]
              const name = (article.author as any)?.full_name ?? 'Unknown'
              const initial = name.charAt(0).toUpperCase()
              return (
                <Link key={article.id} href={`/dashboard/articles/${article.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-gray-600">{initial}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{article.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{name} · {formatDate(article.updated_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.color}`}>
                      {status.label}
                    </span>
                    {article.status === 'published' && freshness && (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${freshness.bg} ${freshness.color}`}>
                        {freshness.label}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
            {(!recentArticles || recentArticles.length === 0) && (
              <div className="p-8 text-center text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No articles yet. <Link href="/dashboard/articles/new" className="text-blue-600 hover:underline">Create your first one</Link></p>
              </div>
            )}
          </div>
        </div>

        {/* Review Queue */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Review Queue</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {myReviewTasks?.map(task => (
              <Link key={task.id} href={`/dashboard/articles/${(task.article as any)?.id}`}
                className="block p-4 hover:bg-gray-50 transition-colors">
                <p className="text-sm font-medium text-gray-900 truncate">{(task.article as any)?.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">Assigned {formatDate(task.assigned_at)}</p>
              </Link>
            ))}
            {(!myReviewTasks || myReviewTasks.length === 0) && (
              <div className="p-8 text-center text-gray-400">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">All caught up!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
