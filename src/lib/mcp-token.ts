import { SignJWT, jwtVerify } from 'jose'
import { createHash, randomBytes } from 'crypto'

const SECRET = new TextEncoder().encode(
  process.env.MCP_TOKEN_SECRET ?? process.env.ANTHROPIC_API_KEY ?? 'fallback-secret-change-in-prod'
)

export interface McpTokenPayload {
  mcp_server_id: string
  tag_ids: string[]
  search_only: boolean
  expires_at: string | null
}

// ── Generate a new scoped MCP token ──────────────────────────────
export async function generateMcpToken(payload: McpTokenPayload): Promise<{
  raw: string        // returned to user once, never stored
  hash: string       // stored in DB
  prefix: string     // first 8 chars, shown in UI for identification
}> {
  const raw = await new SignJWT({
    mcp_server_id: payload.mcp_server_id,
    tag_ids: payload.tag_ids,
    search_only: payload.search_only,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(payload.expires_at ? new Date(payload.expires_at) : '100y')
    .sign(SECRET)

  const hash = createHash('sha256').update(raw).digest('hex')
  const prefix = raw.slice(-8) // last 8 chars as display prefix

  return { raw, hash, prefix }
}

// ── Verify and decode a token from an agent request ──────────────
export async function verifyMcpToken(token: string): Promise<McpTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return {
      mcp_server_id: payload.mcp_server_id as string,
      tag_ids: payload.tag_ids as string[],
      search_only: payload.search_only as boolean,
      expires_at: null,
    }
  } catch {
    return null
  }
}

// ── Hash a raw token for DB lookup ───────────────────────────────
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

// ── Extract bearer token from Authorization header ───────────────
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim()
}
