import { createClient } from '@/backend/supabase/server'
import Link from 'next/link'
import { formatDate, formatDateTime } from '@/shared/lib/utils'
import { Plus, Server, Activity, Tag, Clock, MoreVertical } from 'lucide-react'

export default async function McpServersPage() {
  const supabase = await createClient()

  const { data: servers } = await supabase
    .from('mcp_servers')
    .select('*')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })

  // Hydrate tags for all servers
  const allTagIds = [...new Set((servers ?? []).flatMap(s => s.tag_ids ?? []))]
  let tagMap: Record<string, any> = {}
  if (allTagIds.length > 0) {
    const { data: tags } = await supabase
      .from('tags').select('id, name, category:categories(name, color)').in('id', allTagIds)
    tagMap = Object.fromEntries((tags ?? []).map(t => [t.id, t]))
  }

  const STATUS_STYLES: Record<string, string> = {
    active:       'bg-green-100 text-green-700',
    paused:       'bg-yellow-100 text-yellow-700',
    provisioning: 'bg-blue-100 text-blue-700',
    deleted:      'bg-gray-100 text-gray-500',
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MCP Servers</h1>
          <p className="text-gray-500 mt-1">AI agent access points to your knowledge base</p>
        </div>
        <Link href="/dashboard/mcp/new"
          className="flex items-center gap-2 bg-brand-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors">
          <Plus className="w-4 h-4" /> New MCP Server
        </Link>
      </div>

      {servers && servers.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {servers.map(server => {
            const serverTags = (server.tag_ids ?? []).map((id: string) => tagMap[id]).filter(Boolean)
            return (
              <Link key={server.id} href={`/dashboard/mcp/${server.id}`}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-brand-200 hover:shadow-md transition-all block">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Server className="w-5 h-5 text-brand-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{server.name}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[server.status] ?? ''}`}>
                          {server.status}
                        </span>
                      </div>
                      {server.description && (
                        <p className="text-sm text-gray-500 mb-2">{server.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {serverTags.slice(0, 4).map((tag: any) => (
                          <span key={tag.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5" /> {tag.name}
                          </span>
                        ))}
                        {serverTags.length > 4 && (
                          <span className="text-xs text-gray-400">+{serverTags.length - 4} more</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-right flex-shrink-0 ml-4">
                    <div>
                      <div className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                        <Activity className="w-3.5 h-3.5 text-gray-400" />
                        {server.total_queries?.toLocaleString() ?? '0'}
                      </div>
                      <p className="text-xs text-gray-400">total queries</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Tag className="w-3.5 h-3.5 text-gray-400" />
                        {(server.tag_ids ?? []).length}
                      </div>
                      <p className="text-xs text-gray-400">tags</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{server.token_prefix ? `···${server.token_prefix}` : '—'}</p>
                      <p className="text-xs text-gray-400">token</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Created {formatDate(server.created_at)}
                  </span>
                  {server.last_queried_at && (
                    <span>Last queried {formatDateTime(server.last_queried_at)}</span>
                  )}
                  <span className="ml-auto">{server.rate_limit_per_day.toLocaleString()} req/day</span>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <Server className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="font-semibold text-gray-900 mb-1">No MCP servers yet</h3>
          <p className="text-gray-500 mb-4 text-sm">Create your first MCP server to give AI agents access to your knowledge base.</p>
          <Link href="/dashboard/mcp/new"
            className="inline-flex items-center gap-2 bg-brand-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors">
            <Plus className="w-4 h-4" /> Create MCP Server
          </Link>
        </div>
      )}
    </div>
  )
}
