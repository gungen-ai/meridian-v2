'use client'
import { useState } from 'react'
import type { Tag } from '@/shared/types'
import { Tag as TagIcon, ChevronDown, X } from 'lucide-react'

interface Props {
  tags: Tag[]
  selectedTagIds: string[]
  onChange: (ids: string[]) => void
}

export default function TagSelector({ tags, selectedTagIds, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const grouped = tags.reduce<Record<string, Tag[]>>((acc, tag) => {
    const cat = (tag as any).category?.name ?? 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tag)
    return acc
  }, {})

  const filtered = Object.entries(grouped).reduce<Record<string, Tag[]>>((acc, [cat, ts]) => {
    const matching = ts.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    if (matching.length) acc[cat] = matching
    return acc
  }, {})

  const selectedTags = tags.filter(t => selectedTagIds.includes(t.id))

  function toggle(tagId: string) {
    onChange(selectedTagIds.includes(tagId)
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId]
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
        <TagIcon className="w-3.5 h-3.5" /> Tags
      </label>

      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selectedTags.map(tag => (
            <span key={tag.id}
              className="flex items-center gap-1 bg-brand-50 text-brand-700 text-xs font-medium px-2 py-1 rounded-full">
              {tag.name}
              <button onClick={() => toggle(tag.id)} className="hover:text-brand-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      <div className="relative">
        <button onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
          <span>{selectedTags.length === 0 ? 'Add tags…' : `${selectedTags.length} selected`}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-64 overflow-y-auto">
            <div className="p-2 border-b border-gray-100">
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search tags…" autoFocus
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            {Object.entries(filtered).map(([category, categoryTags]) => (
              <div key={category}>
                <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                  {category}
                </p>
                {categoryTags.map(tag => (
                  <button key={tag.id} onClick={() => toggle(tag.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-brand-50 transition-colors text-left">
                    <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      selectedTagIds.includes(tag.id)
                        ? 'bg-brand-600 border-brand-600'
                        : 'border-gray-300'
                    }`}>
                      {selectedTagIds.includes(tag.id) && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    {tag.name}
                  </button>
                ))}
              </div>
            ))}
            {Object.keys(filtered).length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-400 text-center">No tags found</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
