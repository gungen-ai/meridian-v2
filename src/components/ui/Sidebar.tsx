'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { ROLE_CONFIG } from '@/lib/utils'
import {
  BookOpen, LayoutDashboard, FileText, Tag,
  LogOut, ChevronRight, Server, AlertTriangle,
  BarChart3, Users, Upload, Sparkles, FolderOpen, Search
} from 'lucide-react'
import toast from 'react-hot-toast'

const CONTENT_STUDIO_CHILDREN = [
  { href: '/dashboard/search',    label: 'Search',            icon: Search },
  { href: '/dashboard/articles',  label: 'Articles',          icon: FileText },
  { href: '/dashboard/tags',      label: 'Tags',              icon: Tag },
  { href: '/dashboard/gaps',      label: 'Knowledge Gaps',    icon: AlertTriangle },
  { href: '/dashboard/studio',    label: 'AI Generation',     icon: Sparkles },
  { href: '/dashboard/import',    label: 'Import',            icon: Upload },
]

const TOP_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

const BOTTOM_NAV = [
  { href: '/dashboard/mcp',       label: 'MCP Servers',       icon: Server },
  { href: '/dashboard/analytics', label: 'Analytics',         icon: BarChart3 },
  { href: '/dashboard/users',     label: 'User Management',   icon: Users },
]

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const isContentStudioActive = CONTENT_STUDIO_CHILDREN.some(
    c => pathname === c.href || pathname.startsWith(c.href)
  )
  const [studioOpen, setStudioOpen] = useState(isContentStudioActive)

  async function handleSignOut() {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/auth/login')
    router.refresh()
  }

  const roleConfig = ROLE_CONFIG[profile?.role ?? 'viewer']

  function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: any }) {
    const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
    return (
      <Link href={href}
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors group ${
          active ? 'bg-brand-50 text-brand-800' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}>
        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-brand-700' : 'text-gray-400 group-hover:text-gray-600'}`} />
        {label}
        {active && <ChevronRight className="w-3 h-3 ml-auto text-brand-400" />}
      </Link>
    )
  }

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col h-screen flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
        <div className="w-7 h-7 bg-brand-800 rounded-lg flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-sm leading-tight">Meridian</p>
          <p className="text-xs text-gray-400">Knowledge Base</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {/* Top items */}
        {TOP_NAV.map(item => <NavItem key={item.href} {...item} />)}

        {/* Content Studio parent */}
        <div className="pt-1">
          <button
            onClick={() => setStudioOpen(o => !o)}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors group ${
              isContentStudioActive ? 'bg-brand-50 text-brand-800' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}>
            <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isContentStudioActive ? 'text-brand-700' : 'text-gray-400 group-hover:text-gray-600'}`} />
            <span className="flex-1 text-left">Content Studio</span>
            <ChevronRight className={`w-3 h-3 transition-transform ${studioOpen ? 'rotate-90' : ''} ${isContentStudioActive ? 'text-brand-400' : 'text-gray-300'}`} />
          </button>

          {/* Children */}
          {studioOpen && (
            <div className="ml-3 mt-0.5 pl-3 border-l border-gray-200 space-y-0.5">
              {CONTENT_STUDIO_CHILDREN.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href)
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors group ${
                      active ? 'text-brand-800 font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}>
                    <item.icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Bottom items */}
        <div className="pt-1 space-y-0.5">
          {BOTTOM_NAV.map(item => <NavItem key={item.href} {...item} />)}
        </div>
      </nav>

      {/* User */}
      <div className="px-2 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50 mb-1">
          <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-brand-800 font-semibold text-xs">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">{profile?.full_name}</p>
            <p className={`text-xs font-medium ${roleConfig.color}`}>{roleConfig.label}</p>
          </div>
        </div>
        <button onClick={handleSignOut}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 w-full transition-colors">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </aside>
  )
}
