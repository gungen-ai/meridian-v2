'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { ArticleTag, TagSuggestion } from '@/shared/types'
import { Tag, Sparkles, Check, X } from 'lucide-react'
import { createClient } from '@/backend/supabase/client'

interface Props {
  article: { id: string }
  tagSuggestions: TagSuggestion[]
}

export default function TagPanel({ article, tagSuggestions }: Props) {
  const router = useRouter()
  const [processing, setProcessing] = useState<string | null>(null)

  async function handleAcceptSuggestion(suggestion: TagSuggestion) {
    setProcessing(suggestion.id)
    const supabase = createClient()

    // Add the tag to the article
    const { error: tagError } = await supabase.from('article_tags').upsert({
      article_id: article.id,
      tag_id: suggestion.tag_id,
      assigned_by: 'ai',
      confidence_score: suggestion.confidence_score,
    }, { onConflict: 'article_id,tag_id' })

    // Mark suggestion as accepted
    await supabase.from('tag_suggestions').update({
      status: 'accepted', resolved_at: new Date().toISOString()
    }).eq('id', suggestion.id)

    if (tagError) {
      toast.error(tagError.message)
    } else {
      toast.success(`Tag "${(suggestion.tag as any)?.name}" added`)
      router.refresh()
    }
    setProcessing(null)
  }

  async function handleRejectSuggestion(suggestion: TagSuggestion) {
    setProcessing(suggestion.id)
    const supabase = createClient()
    await supabase.from('tag_suggestions').update({
      status: 'rejected', resolved_at: new Date().toISOString()
    }).eq('id', suggestion.id)
    toast('Suggestion dismissed', { icon: '👍' })
    router.refresh()
    setProcessing(null)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-1.5">
        <Tag className="w-3.5 h-3.5" /> Tags
      </h3>

      {/* AI Suggestions */}
      {tagSuggestions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-purple-600 flex items-center gap-1 mb-2">
            <Sparkles className="w-3 h-3" /> AI Suggestions
          </p>
          <div className="space-y-2">
            {tagSuggestions.map(suggestion => (
              <div key={suggestion.id}
                className="bg-purple-50 border border-purple-100 rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-purple-900">{(suggestion.tag as any)?.name}</span>
                  <span className="text-xs text-purple-500">{Math.round(suggestion.confidence_score * 100)}%</span>
                </div>
                {suggestion.justification && (
                  <p className="text-xs text-purple-600 mb-2 leading-relaxed">{suggestion.justification}</p>
                )}
                <div className="flex gap-1.5">
                  <button onClick={() => handleAcceptSuggestion(suggestion)}
                    disabled={processing === suggestion.id}
                    className="flex items-center gap-1 bg-purple-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
                    <Check className="w-3 h-3" /> Accept
                  </button>
                  <button onClick={() => handleRejectSuggestion(suggestion)}
                    disabled={processing === suggestion.id}
                    className="flex items-center gap-1 border border-purple-200 text-purple-600 px-2 py-1 rounded text-xs font-medium hover:bg-purple-100 disabled:opacity-50 transition-colors">
                    <X className="w-3 h-3" /> Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tagSuggestions.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          No pending tag suggestions. Use &quot;AI Auto-Tag&quot; in the editor to generate suggestions.
        </p>
      )}
    </div>
  )
}
