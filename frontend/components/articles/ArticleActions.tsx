'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Article, Profile } from '@/shared/types'
import { canPublish } from '@/shared/lib/utils'
import { CheckCircle, Archive, MoreVertical, Loader2 } from 'lucide-react'

export default function ArticleActions({ article, profile }: { article: Article; profile: Profile }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  async function handlePublish() {
    setLoading('publish')
    try {
      const res = await fetch(`/api/articles/${article.id}/publish`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Article published!')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(null)
    }
  }

  async function handleArchive() {
    setLoading('archive')
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Article archived')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(null)
      setMenuOpen(false)
    }
  }

  const isAdmin = canPublish(profile.role)

  return (
    <div className="flex items-center gap-2">
      {isAdmin && article.status === 'approved' && (
        <button onClick={handlePublish} disabled={loading === 'publish'}
          className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
          {loading === 'publish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Publish
        </button>
      )}

      {isAdmin && article.status === 'in_review' && (
        <button onClick={handlePublish} disabled={loading === 'publish'}
          className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
          {loading === 'publish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Publish Directly
        </button>
      )}

      <div className="relative">
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-36 py-1">
            {article.status !== 'archived' && (
              <button onClick={handleArchive} disabled={loading === 'archive'}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 w-full text-left transition-colors">
                <Archive className="w-4 h-4" />
                Archive
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
