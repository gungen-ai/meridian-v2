import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ArticleStatus, FreshnessLabel, UserRole } from '@/shared/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(date)
}

export const STATUS_CONFIG: Record<ArticleStatus, { label: string; color: string; bg: string }> = {
  draft:      { label: 'Draft',       color: 'text-gray-600',  bg: 'bg-gray-100' },
  in_review:  { label: 'In Review',   color: 'text-yellow-700', bg: 'bg-yellow-100' },
  approved:   { label: 'Approved',    color: 'text-blue-700',  bg: 'bg-blue-100' },
  published:  { label: 'Published',   color: 'text-green-700', bg: 'bg-green-100' },
  archived:   { label: 'Archived',    color: 'text-gray-500',  bg: 'bg-gray-100' },
}

export const FRESHNESS_CONFIG: Record<FreshnessLabel, { label: string; color: string; bg: string; dot: string }> = {
  fresh:            { label: 'Fresh',            color: 'text-green-700',  bg: 'bg-green-100',  dot: 'bg-green-500' },
  review_suggested: { label: 'Review Suggested', color: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
  review_required:  { label: 'Review Required',  color: 'text-orange-700', bg: 'bg-orange-100', dot: 'bg-orange-500' },
  stale:            { label: 'Stale',            color: 'text-red-700',    bg: 'bg-red-100',    dot: 'bg-red-500' },
}

export const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  viewer:     { label: 'Viewer',     color: 'text-gray-600' },
  editor:     { label: 'Editor',     color: 'text-blue-600' },
  kb_admin:   { label: 'KB Admin',   color: 'text-purple-600' },
  mcp_owner:  { label: 'MCP Owner',  color: 'text-teal-600' },
  super_admin:{ label: 'Super Admin',color: 'text-red-600' },
}

export function canEdit(role: UserRole): boolean {
  return ['editor', 'kb_admin', 'super_admin'].includes(role)
}

export function canPublish(role: UserRole): boolean {
  return ['kb_admin', 'super_admin'].includes(role)
}

export function canManageTaxonomy(role: UserRole): boolean {
  return ['kb_admin', 'super_admin'].includes(role)
}

export function truncate(str: string, length = 120): string {
  if (str.length <= length) return str
  return str.slice(0, length).trim() + '…'
}
