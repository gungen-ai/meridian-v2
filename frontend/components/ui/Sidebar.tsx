'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/backend/supabase/client'
import type { Profile } from '@/shared/types'
import { ROLE_CONFIG } from '@/shared/lib/utils'
import {
  BookOpen, LayoutDashboard, FileText, Tag,
  LogOut, ChevronDown, Server,
  BarChart3, Users, Upload, Sparkles, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { href: '/dashboard',           label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/dashboard/studio',    label: 'Content Studio',  icon: FileText },
  { href: '/dashboard/articles',  label: 'Articles',        icon: FileText },
  { href: '/dashboard/tags',      label: 'Tags',            icon: Tag },
  { href: '/dashboard/gaps',      label: 'Knowledge Gaps',  icon: AlertTriangle },
  { href: '/dashboard/studio',    label: 'AI Generation',   icon: Sparkles },
  { href: '/dashboard/import',    label: 'Import',          icon: Upload },
  { href: '/dashboard/mcp',       label: 'MCP Servers',     icon: Server },
  { href: '/dashboard/analytics', label: 'Analytics',       icon: BarChart3 },
  { href: '/dashboard/users',     label: 'User Management', icon: Users },
]

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/auth/login')
    router.refresh()
  }

  const roleConfig = ROLE_CONFIG[profile?.role ?? 'viewer']

  return (
    <aside className="w-64 min-w-64 bg-white border-r border-gray-200 flex flex-col h-screen flex-shrink-0 overflow-hidden">

      {/* User Profile — TOP */}
      <div className="px-3 py-4 border-b border-gray-100" ref={profileRef}>
        <button
          onClick={() => setProfileOpen(o => !o)}
          className="flex items-center gap-3 w-full text-left hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors">
          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-blue-700 font-semibold text-sm">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{profile?.full_name}</p>
            <p className={`text-xs font-medium ${roleConfig.color}`}>{roleConfig.label}</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
        </button>

        {profileOpen && (
          <div className="mt-1 ml-1">
            <button onClick={handleSignOut}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 w-full transition-colors">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href + label} href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-gray-700' : 'text-gray-400'}`} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logo — BOTTOM */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-t border-gray-100 bg-white shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm leading-tight">Meridian</p>
          <p className="text-xs text-gray-400">Knowledge Base</p>
        </div>
      </div>

    </aside>
  )
}
