import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UserManager from '@/components/users/UserManager'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (!['kb_admin', 'super_admin'].includes(profile?.role ?? '')) redirect('/dashboard')

  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
        <p className="text-gray-500 mt-1">Manage roles and access for your team</p>
      </div>
      <UserManager users={users ?? []} currentUserId={user!.id} currentUserRole={profile?.role ?? 'editor'} />
    </div>
  )
}
