import { createClient } from '@/lib/supabase/server'
import { formatDate, STATUS_CONFIG, FRESHNESS_CONFIG } from '@/lib/utils'
import Link from 'next/link'
import { FileText, Tag, CheckCircle, AlertTriangle, Plus, ArrowRight } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch stats
  const [
    { count: totalArticles },
    { count: publishedArticles },
    { count: draftArticles },
    { count: inReviewArticles },
    { data: recentArticles },
    { data: myReviewTasks },
    { count: totalTags },
  ] = await Promise.all([
    supabase.from('articles').select('*', { count: 'exact', head: true }),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
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
    supabase.from('tags').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  const stats = [
    { label: 'Total Articles', value: totalArticles ?? 0, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Published', value: publishedArticles ?? 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'In Review', value: inReviewArticles ?? 0, icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Active Tags', value: totalTags ?? 0, icon: Tag, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back — here&apos;s what&apos;s happening</p>
        </div>
        <Link href="/dashboard/articles/new"
          className="flex items-center gap-2 bg-brand-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors">
          <Plus className="w-4 h-4" /> New Article
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
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
            <Link href="/dashboard/articles" className="text-sm text-brand-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentArticles?.map(article => {
              const status = STATUS_CONFIG[article.status as keyof typeof STATUS_CONFIG]
              const freshness = FRESHNESS_CONFIG[article.freshness_label as keyof typeof FRESHNESS_CONFIG]
              return (
                <Link key={article.id} href={`/dashboard/articles/${article.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{article.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(article.author as any)?.full_name} · {formatDate(article.updated_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                      {status.label}
                    </span>
                    {article.status === 'published' && (
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${freshness.bg} ${freshness.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${freshness.dot}`} />
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
                <p>No articles yet. <Link href="/dashboard/articles/new" className="text-brand-600 hover:underline">Create your first one</Link></p>
              </div>
            )}
          </div>
        </div>

        {/* My Review Queue */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">My Review Queue</h2>
            {(inReviewArticles ?? 0) > 0 && (
              <p className="text-xs text-yellow-600 mt-1">{myReviewTasks?.length ?? 0} awaiting your review</p>
            )}
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
              <div className="p-6 text-center text-gray-400">
                <CheckCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">All caught up!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
