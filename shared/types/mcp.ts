export type McpServerStatus = 'provisioning' | 'active' | 'paused' | 'deleted'

export interface McpServer {
  id: string
  name: string
  description: string | null
  status: McpServerStatus
  tag_ids: string[]
  rate_limit_per_min: number
  rate_limit_per_day: number
  search_only_mode: boolean
  ip_allowlist: string[] | null
  token_expires_at: string | null
  token_hash: string | null
  token_prefix: string | null
  created_by: string
  owner_id: string | null
  total_queries: number
  last_queried_at: string | null
  created_at: string
  updated_at: string
  // Joined
  creator?: { full_name: string }
  tags?: McpServerTag[]
}

export interface McpServerTag {
  id: string
  name: string
  category: { name: string; color: string }
}

export interface McpQueryLog {
  id: string
  mcp_server_id: string
  tool_name: string
  query_text: string | null
  result_count: number | null
  top_confidence: number | null
  latency_ms: number | null
  created_at: string
}

// MCP Protocol types (what agents receive)
export interface McpResource {
  uri: string
  title: string
  description: string
  content: string
  tags: string[]
  last_updated_at: string
}

export interface McpSearchResult {
  resources: McpResource[]
  total: number
  query: string
}

// Wizard step state
export interface WizardState {
  step: 1 | 2 | 3 | 4 | 5
  name: string
  description: string
  tag_ids: string[]
  rate_limit_per_min: number
  rate_limit_per_day: number
  search_only_mode: boolean
  token_expires_at: string
  // Result (step 4+)
  created_server?: McpServer
  raw_token?: string
}
