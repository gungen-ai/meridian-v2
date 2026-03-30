'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatDate, ROLE_CONFIG } from '@/shared/lib/utils'
import type { UserRole } from '@/shared/types'
import { User, Shield, Loader2 } from 'lucide-react'

interface UserRow {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
}

const ROLES: UserRole[] = ['viewer', 'editor', 'mcp_owner', 'kb_admin', 'super_admin']

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  viewer:      'Read published articles only',
  editor:      'Create and edit articles, submit for review',
  mcp_owner:   'Create and manage MCP servers',
  kb_admin:    'Full access — publish, manage taxonomy, view audit log',
  super_admin: 'Everything including managing other admins',
}

export default function UserManager({
  users: initial, currentUserId, currentUserRole
}: {
  users: UserRow[]
  currentUserId: string
  currentUserRole: string
}) {
  const [users, setUsers] = useState(initial)
  const [updating, setUpdating] = useState<string | null>(null)

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setUpdating(userId)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      toast.success('Role updated')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUpdating(null)
    }
  }

  const roleCounts = ROLES.reduce<Record<string, number>>((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length
    return acc
  }, {})

  return (
    <div className="grid grid-cols-4 gap-6">
      <div className="col-span-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="py-3 px-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => {
                const roleConfig = ROLE_CONFIG[u.role]
                const isCurrentUser = u.id === currentUserId
                const canChange = currentUserRole === 'super_admin' || u.role !== 'super_admin'

                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-brand-800 font-semibold text-xs">
                            {(u.full_name ?? u.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {u.full_name ?? '—'}
                            {isCurrentUser && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                          </p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      {canChange && !isCurrentUser ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={u.role}
                            onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                            disabled={updating === u.id}
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                          >
                            {ROLES.map(r => (
                              <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                            ))}
                          </select>
                          {updating === u.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                        </div>
                      ) : (
                        <span className={`text-sm font-medium ${roleConfig.color}`}>{roleConfig.label}</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-sm text-gray-500">{formatDate(u.created_at)}</td>
                    <td className="py-3 px-5">
                      {u.role === 'super_admin' && (
                        <Shield className="w-4 h-4 text-red-400" title="Super admin" />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role guide */}
      <div className="space-y-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" /> Role Summary
          </h3>
          <dl className="space-y-1 text-sm">
            {ROLES.map(r => (
              <div key={r} className="flex justify-between">
                <dt className={`font-medium ${ROLE_CONFIG[r].color}`}>{ROLE_CONFIG[r].label}</dt>
                <dd className="text-gray-400">{roleCounts[r] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Role Permissions</h3>
          <div className="space-y-3">
            {ROLES.map(r => (
              <div key={r}>
                <p className={`text-xs font-semibold ${ROLE_CONFIG[r].color}`}>{ROLE_CONFIG[r].label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{ROLE_DESCRIPTIONS[r]}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <p className="text-xs text-blue-700 font-medium mb-1">Inviting new users</p>
          <p className="text-xs text-blue-600">Share your app URL and have them sign up. Then assign their role here.</p>
        </div>
      </div>
    </div>
  )
}
