'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { AlertTriangle, CheckCircle, Loader2, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { createClient } from '@/backend/supabase/client'

interface Contradiction {
  id: string
  article_b_id: string
  severity: 'critical' | 'moderate' | 'minor'
  sentence_a: string | null
  sentence_b: string | null
  explanation: string | null
  suggested_resolution: string | null
  status: string
}

interface Props {
  articleId: string
  contradictions: Contradiction[]
  articleTitle: string
  publishedAt: string | null
  lastReviewedAt: string | null
  freshnessLabel: string
  freshnessScore: number
}

const SEVERITY = {
  critical: { color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200'    },
  moderate: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  minor:    { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
}

export default function ContradictionPanel({
  articleId, contradictions: initial, articleTitle,
  publishedAt, lastReviewedAt, freshnessLabel, freshnessScore
}: Props) {
  const router = useRouter()
  const [contradictions, setContradictions] = useState(initial)
  const [checking, setChecking] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function handleCheckContradictions() {
    setChecking(true)
    try {
      const res = await fetch(`/api/articles/${articleId}/check-contradictions`, { method: 'POST' })
      const { contradictions_found, data } = await res.json()
      if (contradictions_found > 0) {
        setContradictions(prev => [...prev, ...data])
        toast.error(`${contradictions_found} contradiction${contradictions_found > 1 ? 's' : ''} found!`)
      } else {
        toast.success('No contradictions detected')
      }
    } catch {
      toast.error('Check failed')
    } finally {
      setChecking(false)
    }
  }

  async function handleConfirmAccurate() {
    setConfirming(true)
    try {
      const res = await fetch(`/api/articles/${articleId}/confirm-accurate`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Marked as still accurate — freshness reset')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setConfirming(false)
    }
  }

  async function handleDismissContradiction(contradictionId: string) {
    const supabase = createClient()
    await supabase.from('contradictions').update({ status: 'dismissed' }).eq('id', contradictionId)
    setContradictions(prev => prev.filter(c => c.id !== contradictionId))
    toast.success('Contradiction dismissed')
  }

  const openContradictions = contradictions.filter(c => c.status === 'open')
  const daysSince = lastReviewedAt
    ? Math.floor((Date.now() - new Date(lastReviewedAt).getTime()) / 86400000)
    : publishedAt
    ? Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86400000)
    : null

  return (
    <div className="space-y-4">
      {/* Freshness panel */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="font-semibold text-gray-900 text-sm mb-3">Freshness</h3>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                freshnessScore >= 75 ? 'bg-green-500' :
                freshnessScore >= 50 ? 'bg-yellow-500' :
                freshnessScore >= 25 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${freshnessScore}%` }}
            />
          </div>
          <span className="text-sm font-bold text-gray-700">{freshnessScore}</span>
        </div>
        {daysSince !== null && (
          <p className="text-xs text-gray-500 mb-3">
            {daysSince === 0 ? 'Reviewed today' : `Last reviewed ${daysSince} day${daysSince !== 1 ? 's' : ''} ago`}
          </p>
        )}
        <button onClick={handleConfirmAccurate} disabled={confirming}
          className="w-full flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50 transition-colors">
          {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
          Confirm Still Accurate
        </button>
      </div>

      {/* Contradiction checker */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            Contradictions
            {openContradictions.length > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full ml-1">
                {openContradictions.length}
              </span>
            )}
          </h3>
          <button onClick={handleCheckContradictions} disabled={checking}
            className="flex items-center gap-1 text-xs text-purple-600 font-medium hover:text-purple-800 transition-colors disabled:opacity-50">
            {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {checking ? 'Checking…' : 'Check Now'}
          </button>
        </div>

        {openContradictions.length === 0 ? (
          <p className="text-xs text-gray-400">No open contradictions. Click &ldquo;Check Now&rdquo; to scan against other articles.</p>
        ) : (
          <div className="space-y-2">
            {openContradictions.map(c => {
              const sev = SEVERITY[c.severity]
              return (
                <div key={c.id} className={`rounded-lg border p-3 ${sev.bg} ${sev.border}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold uppercase ${sev.color}`}>{c.severity}</span>
                    <button onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                      className={`${sev.color} hover:opacity-70`}>
                      {expanded === c.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className={`text-xs ${sev.color} leading-relaxed`}>{c.explanation}</p>

                  {expanded === c.id && (
                    <div className="mt-2 space-y-1.5">
                      {c.sentence_a && (
                        <div className="bg-white bg-opacity-60 rounded p-2">
                          <p className="text-xs font-medium text-gray-600 mb-0.5">This article says:</p>
                          <p className="text-xs text-gray-700 italic">&ldquo;{c.sentence_a}&rdquo;</p>
                        </div>
                      )}
                      {c.sentence_b && (
                        <div className="bg-white bg-opacity-60 rounded p-2">
                          <p className="text-xs font-medium text-gray-600 mb-0.5">Other article says:</p>
                          <p className="text-xs text-gray-700 italic">&ldquo;{c.sentence_b}&rdquo;</p>
                        </div>
                      )}
                      {c.suggested_resolution && (
                        <div className="bg-white bg-opacity-60 rounded p-2">
                          <p className="text-xs font-medium text-gray-600 mb-0.5">Suggested fix:</p>
                          <p className="text-xs text-gray-700">{c.suggested_resolution}</p>
                        </div>
                      )}
                      <button onClick={() => handleDismissContradiction(c.id)}
                        className={`text-xs ${sev.color} opacity-70 hover:opacity-100 mt-1`}>
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
