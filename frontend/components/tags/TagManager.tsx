'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Category, Tag } from '@/shared/types'
import { canManageTaxonomy } from '@/shared/lib/utils'
import type { UserRole } from '@/shared/types'
import { Plus, Tag as TagIcon, FolderOpen, X, Loader2 } from 'lucide-react'

interface Props {
  categories: Category[]
  tags: Tag[]
  userRole: UserRole
}

export default function TagManager({ categories, tags, userRole }: Props) {
  const router = useRouter()
  const isAdmin = canManageTaxonomy(userRole)

  const [showCatForm, setShowCatForm] = useState(false)
  const [showTagForm, setShowTagForm] = useState(false)
  const [newCat, setNewCat] = useState({ name: '', description: '', color: '#3b82f6' })
  const [newTag, setNewTag] = useState({ name: '', description: '', category_id: '' })
  const [saving, setSaving] = useState(false)

  const grouped = categories.map(cat => ({
    ...cat,
    tags: tags.filter(t => t.category_id === cat.id)
  }))

  async function createCategory() {
    setSaving(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCat)
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Category created')
      setNewCat({ name: '', description: '', color: '#3b82f6' })
      setShowCatForm(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function createTag() {
    setSaving(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTag)
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Tag created')
      setNewTag({ name: '', description: '', category_id: '' })
      setShowTagForm(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Categories + Tags tree */}
      <div className="col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Taxonomy</h2>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={() => setShowCatForm(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Category
              </button>
              <button onClick={() => setShowTagForm(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-brand-800 text-white rounded-lg hover:bg-brand-700 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Tag
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {grouped.map(cat => (
            <div key={cat.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-gray-50"
                style={{ borderLeft: `3px solid ${cat.color}` }}>
                <FolderOpen className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">{cat.name}</p>
                  {cat.description && <p className="text-xs text-gray-400 mt-0.5">{cat.description}</p>}
                </div>
                <span className="ml-auto text-xs text-gray-400">{cat.tags.length} tags</span>
              </div>
              <div className="p-3 flex flex-wrap gap-2">
                {cat.tags.map(tag => (
                  <span key={tag.id}
                    className={`flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full border ${
                      tag.status === 'deprecated'
                        ? 'bg-gray-50 text-gray-400 border-gray-200 line-through'
                        : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                    <TagIcon className="w-3 h-3" />
                    {tag.name}
                    {tag.status === 'deprecated' && <span className="text-xs">(deprecated)</span>}
                  </span>
                ))}
                {cat.tags.length === 0 && (
                  <p className="text-xs text-gray-400 italic py-1">No tags yet</p>
                )}
              </div>
            </div>
          ))}

          {grouped.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No categories yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Forms */}
      <div className="space-y-4">
        {showCatForm && (
          <div className="bg-white rounded-xl border border-brand-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">New Category</h3>
              <button onClick={() => setShowCatForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Category name" value={newCat.name}
                onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <input type="text" placeholder="Description (optional)" value={newCat.description}
                onChange={e => setNewCat({ ...newCat, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Color:</label>
                <input type="color" value={newCat.color}
                  onChange={e => setNewCat({ ...newCat, color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-0" />
              </div>
              <button onClick={createCategory} disabled={!newCat.name || saving}
                className="w-full bg-brand-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Category
              </button>
            </div>
          </div>
        )}

        {showTagForm && (
          <div className="bg-white rounded-xl border border-brand-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">New Tag</h3>
              <button onClick={() => setShowTagForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <select value={newTag.category_id}
                onChange={e => setNewTag({ ...newTag, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select category…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="text" placeholder="Tag name" value={newTag.name}
                onChange={e => setNewTag({ ...newTag, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <input type="text" placeholder="Description (optional)" value={newTag.description}
                onChange={e => setNewTag({ ...newTag, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <button onClick={createTag} disabled={!newTag.name || !newTag.category_id || saving}
                className="w-full bg-brand-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Tag
              </button>
            </div>
          </div>
        )}

        {/* Stats card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Taxonomy Stats</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Categories</dt>
              <dd className="font-medium text-gray-900">{categories.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Active Tags</dt>
              <dd className="font-medium text-gray-900">{tags.filter(t => t.status === 'active').length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Deprecated Tags</dt>
              <dd className="font-medium text-gray-400">{tags.filter(t => t.status === 'deprecated').length}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
