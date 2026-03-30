import { createClient } from '@/backend/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatDateTime, STATUS_CONFIG, FRESHNESS_CONFIG } from '@/shared/lib/utils'
import ArticleActions from '@/frontend/components/articles/ArticleActions'
import ReviewPanel from '@/frontend/components/articles/ReviewPanel'
import TagPanel from '@/frontend/components/articles/TagPanel'
import { Edit, Clock, User, Tag } from 'lucide-react'
import ContradictionPanel from '@/frontend/components/articles/ContradictionPanel'

export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: article } = await supabase
    .from('articles')
    .select(`
      *,
      author:profiles!articles_author_id_fkey(*),
      owner:profiles!articles_owner_id_fkey(*),
      category:categories(*),
      article_tags(*, tag:tags(*, category:categories(*)))
    `)
    .eq('id', id)
    .single()

  if (!article) notFound()

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
  const { data: reviewTasks } = await supabase
    .from('review_tasks')
    .select('*, reviewer:profiles(*)')
    .eq('article_id', id)
    .order('assigned_at', { ascending: false })

  const { data: versions } = await supabase
    .from('article_versions')
    .select('id, version_number, status, created_at, editor:profiles(*), change_summary')
    .eq('article_id', id)
    .order('version_number', { ascending: false })
    .limit(10)

  const { data: contradictions } = await supabase
    .from('contradictions')
    .select('*')
    .or(`article_a_id.eq.${id},article_b_id.eq.${id}`)
    .eq('status', 'open')
    .order('severity')

  const { data: tagSuggestions } = await supabase
    .from('tag_suggestions')
    .select('*, tag:tags(*, category:categories(*))')
    .eq('article_id', id)
    .eq('status', 'pending')

  const status = STATUS_CONFIG[article.status as keyof typeof STATUS_CONFIG]
  const freshness = FRESHNESS_CONFIG[article.freshness_label as keyof typeof FRESHNESS_CONFIG]

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.color}`}>
              {status.label}
            </span>
            {article.status === 'published' && (
              <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${freshness.bg} ${freshness.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${freshness.dot}`} />
                {freshness.label}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{article.title}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> {(article.author as any)?.full_name}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Updated {formatDate(article.updated_at)}
            </span>
            {(article.category as any) && (
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> {(article.category as any)?.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Link href={`/dashboard/articles/${id}/edit`}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Edit className="w-4 h-4" /> Edit
          </Link>
          <ArticleActions article={article as any} profile={profile as any} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Article content */}
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </div>

          {/* Review panel */}
          {(article.status === 'in_review' || (reviewTasks && reviewTasks.length > 0)) && (
            <ReviewPanel
              article={article as any}
              reviewTasks={reviewTasks ?? []}
              profile={profile as any}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Tags */}
          <TagPanel
            article={article as any}
            tagSuggestions={tagSuggestions ?? []}
          />

          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Author</dt>
                <dd className="font-medium text-gray-900">{(article.author as any)?.full_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Owner</dt>
                <dd className="font-medium text-gray-900">{(article.owner as any)?.full_name ?? 'Unassigned'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-700">{formatDate(article.created_at)}</dd>
              </div>
              {article.published_at && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Published</dt>
                  <dd className="text-gray-700">{formatDate(article.published_at)}</dd>
                </div>
              )}
              {article.last_reviewed_at && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Last reviewed</dt>
                  <dd className="text-gray-700">{formatDate(article.last_reviewed_at)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Contradiction + Freshness */}
          {article.status === 'published' && (
            <ContradictionPanel
              articleId={id}
              contradictions={contradictions ?? []}
              articleTitle={article.title}
              publishedAt={article.published_at}
              lastReviewedAt={article.last_reviewed_at}
              freshnessLabel={article.freshness_label}
              freshnessScore={article.freshness_score}
            />
          )}

          {/* Version history */}
          {versions && versions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Version History</h3>
              <div className="space-y-2">
                {versions.map(v => (
                  <div key={v.id} className="flex items-start gap-2 text-xs">
                    <span className="bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 font-mono flex-shrink-0">
                      v{v.version_number}
                    </span>
                    <div>
                      <p className="text-gray-700">{(v.editor as any)?.full_name}</p>
                      <p className="text-gray-400">{formatDateTime(v.created_at)}</p>
                      {v.change_summary && <p className="text-gray-500 mt-0.5">{v.change_summary}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
