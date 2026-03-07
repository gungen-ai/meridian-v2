'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import CodeBlock from '@tiptap/extension-code-block'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Article, Category, Tag, Profile } from '@/types'
import TagSelector from './TagSelector'
import {
  Bold, Italic, Heading1, Heading2, List, ListOrdered,
  Code, Quote, Link2, Save, Send, Sparkles, Loader2, X
} from 'lucide-react'

interface Props {
  article?: Article
  categories: Category[]
  tags: Tag[]
  profiles: Profile[]
  selectedTagIds?: string[]
}

export default function ArticleEditor({ article, categories, tags, profiles, selectedTagIds = [] }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(article?.title ?? '')
  const [categoryId, setCategoryId] = useState(article?.category_id ?? '')
  const [ownerId, setOwnerId] = useState(article?.owner_id ?? '')
  const [selectedTags, setSelectedTags] = useState<string[]>(selectedTagIds)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [tagging, setTagging] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewerId, setReviewerId] = useState('')
  const autosaveRef = useRef<NodeJS.Timeout>()

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing your article…' }),
      Link.configure({ openOnClick: false }),
      CodeBlock,
    ],
    content: article?.content ?? '',
    editorProps: {
      attributes: { class: 'focus:outline-none' }
    }
  })

  // Autosave every 30 seconds if editing existing article
  const doAutosave = useCallback(async () => {
    if (!article?.id || !editor) return
    const content = editor.getHTML()
    await fetch(`/api/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, change_summary: 'Autosaved' })
    })
  }, [article?.id, editor, title])

  useEffect(() => {
    if (!article?.id) return
    autosaveRef.current = setInterval(doAutosave, 30000)
    return () => clearInterval(autosaveRef.current)
  }, [doAutosave, article?.id])

  async function handleSave() {
    if (!editor) return
    setSaving(true)
    try {
      const content = editor.getHTML()
      const payload = { title, content, category_id: categoryId || null, owner_id: ownerId || null, tag_ids: selectedTags }

      if (article?.id) {
        const res = await fetch(`/api/articles/${article.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, change_summary: 'Manual save' })
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success('Article saved')
      } else {
        const res = await fetch('/api/articles', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error((await res.json()).error)
        const { data } = await res.json()
        toast.success('Article created')
        router.push(`/dashboard/articles/${data.id}`)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAutoTag() {
    if (!article?.id) { toast.error('Save the article first'); return }
    setTagging(true)
    try {
      const res = await fetch(`/api/articles/${article.id}/autotag`, { method: 'POST' })
      const { data } = await res.json()
      if (data?.length > 0) {
        toast.success(`${data.length} tag suggestions generated`)
        router.refresh()
      } else {
        toast('No high-confidence tags found', { icon: '🤔' })
      }
    } catch (e) {
      toast.error('Auto-tagging failed')
    } finally {
      setTagging(false)
    }
  }

  async function handleSubmitReview() {
    if (!article?.id || !reviewerId) return
    try {
      const res = await fetch(`/api/articles/${article.id}/submit-review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer_id: reviewerId })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Submitted for review')
      setShowReviewModal(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (!editor) return null

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Main editor */}
      <div className="col-span-2 space-y-4">
        <input
          type="text" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Article title…"
          className="w-full text-2xl font-bold border-0 border-b border-gray-200 pb-3 focus:outline-none focus:border-brand-500 bg-transparent text-gray-900 placeholder:text-gray-300"
        />

        {/* Editor toolbar */}
        <div className="bg-white border border-gray-200 rounded-t-lg px-3 py-2 flex items-center gap-1 flex-wrap">
          {[
            { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), title: 'Bold' },
            { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), title: 'Italic' },
            { icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }), title: 'H1' },
            { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), title: 'H2' },
            { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), title: 'Bullet list' },
            { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), title: 'Numbered list' },
            { icon: Code, action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code'), title: 'Code' },
            { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), title: 'Quote' },
          ].map(({ icon: Icon, action, active, title: t }) => (
            <button key={t} onClick={action} title={t}
              className={`p-1.5 rounded transition-colors ${active ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-100'}`}>
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Editor content */}
        <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg min-h-96">
          <EditorContent editor={editor} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-brand-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {article?.id ? 'Save Changes' : 'Create Article'}
          </button>

          {article?.id && article.status === 'draft' && (
            <button onClick={() => setShowReviewModal(true)}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors">
              <Send className="w-4 h-4" /> Submit for Review
            </button>
          )}

          {article?.id && (
            <button onClick={handleAutoTag} disabled={tagging}
              className="flex items-center gap-2 border border-purple-200 text-purple-700 px-4 py-2 rounded-lg font-medium hover:bg-purple-50 disabled:opacity-50 transition-colors ml-auto">
              {tagging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              AI Auto-Tag
            </button>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Category */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">Select category…</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Owner */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Article Owner</label>
          <select value={ownerId} onChange={e => setOwnerId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">Select owner…</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>

        {/* Tags */}
        <TagSelector tags={tags} selectedTagIds={selectedTags} onChange={setSelectedTags} />
      </div>

      {/* Review modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Submit for Review</h3>
              <button onClick={() => setShowReviewModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Select a reviewer. They&apos;ll receive an AI-generated brief to help them review efficiently.</p>
            <select value={reviewerId} onChange={e => setReviewerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Select reviewer…</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={handleSubmitReview} disabled={!reviewerId}
                className="flex-1 bg-brand-800 text-white py-2 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
                Submit
              </button>
              <button onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
