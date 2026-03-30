'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Article, Profile, ReviewTask } from '@/shared/types'
import { formatDate } from '@/shared/lib/utils'
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { createClient } from '@/backend/supabase/client'

interface Props {
  article: Article
  reviewTasks: ReviewTask[]
  profile: Profile
}

export default function ReviewPanel({ article, reviewTasks, profile }: Props) {
  const router = useRouter()
  const [briefExpanded, setBriefExpanded] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const myTask = reviewTasks.find(t => t.reviewer_id === profile.id && t.status === 'awaiting')

  async function handleDecision(taskId: string, decision: 'approved' | 'changes_requested') {
    setLoading(taskId)
    const supabase = createClient()
    
    const { error } = await supabase
      .from('review_tasks')
      .update({
        status: decision,
        decision,
        comment: comment || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId)

    if (error) {
      toast.error(error.message)
    } else {
      // If approved, transition article to approved status
      if (decision === 'approved') {
        await supabase.from('articles').update({ status: 'approved' }).eq('id', article.id)
        toast.success('Article approved!')
      } else {
        await supabase.from('articles').update({ status: 'draft' }).eq('id', article.id)
        toast.success('Changes requested — article returned to draft')
      }
      router.refresh()
    }
    setLoading(null)
  }

  return (
    <div className="bg-white rounded-xl border border-yellow-200 shadow-sm">
      <div className="flex items-center gap-2 p-4 border-b border-yellow-100 bg-yellow-50 rounded-t-xl">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        <h3 className="font-semibold text-yellow-900 text-sm">Under Review</h3>
        <span className="text-xs text-yellow-600 ml-auto">{reviewTasks.filter(t => t.status === 'awaiting').length} reviewer(s) pending</span>
      </div>

      <div className="divide-y divide-gray-100">
        {reviewTasks.map(task => (
          <div key={task.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600">
                  {(task.reviewer as any)?.full_name?.charAt(0) ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{(task.reviewer as any)?.full_name}</p>
                  <p className="text-xs text-gray-400">Assigned {formatDate(task.assigned_at)}</p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                task.status === 'awaiting' ? 'bg-yellow-100 text-yellow-700' :
                task.status === 'approved' ? 'bg-green-100 text-green-700' :
                'bg-red-100 text-red-700'
              }`}>
                {task.status === 'awaiting' ? 'Pending' :
                 task.status === 'approved' ? 'Approved' : 'Changes Requested'}
              </span>
            </div>

            {/* AI Brief */}
            {task.ai_brief && (
              <div className="mt-2">
                <button onClick={() => setBriefExpanded(briefExpanded === task.id ? null : task.id)}
                  className="flex items-center gap-1.5 text-xs text-purple-600 font-medium hover:text-purple-800 transition-colors">
                  <Sparkles className="w-3 h-3" />
                  AI Reviewer Brief
                  {briefExpanded === task.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {briefExpanded === task.id && (
                  <div className="mt-2 bg-purple-50 rounded-lg p-3 text-xs text-purple-900 whitespace-pre-wrap leading-relaxed">
                    {task.ai_brief}
                  </div>
                )}
              </div>
            )}

            {/* Review actions for the assigned reviewer */}
            {myTask?.id === task.id && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <textarea
                  value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Add a comment (optional)…"
                  rows={2}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg mb-2 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDecision(task.id, 'approved')}
                    disabled={loading === task.id}
                    className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => handleDecision(task.id, 'changes_requested')}
                    disabled={loading === task.id}
                    className="flex items-center gap-1.5 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
                    <XCircle className="w-3.5 h-3.5" /> Request Changes
                  </button>
                </div>
              </div>
            )}

            {task.comment && task.status !== 'awaiting' && (
              <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">{task.comment}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
