-- ============================================================
-- Phase 2 Schema — Run this in Supabase SQL Editor
-- (after Phase 1 schema.sql is already applied)
-- ============================================================

create type mcp_server_status as enum ('provisioning', 'active', 'paused', 'deleted');

-- ============================================================
-- MCP SERVERS
-- ============================================================
create table public.mcp_servers (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  description           text,
  status                mcp_server_status not null default 'provisioning',
  -- Scoped tag set (array of tag UUIDs)
  tag_ids               uuid[] not null default '{}',
  -- Access rules
  rate_limit_per_min    int not null default 60,
  rate_limit_per_day    int not null default 5000,
  search_only_mode      boolean not null default false,
  ip_allowlist          text[],                     -- CIDR strings, null = allow all
  token_expires_at      timestamptz,                -- null = never expires
  -- Token (hashed — raw token returned only at creation/rotation)
  token_hash            text,
  token_prefix          text,                       -- first 8 chars for display
  -- Ownership
  created_by            uuid not null references public.profiles(id),
  owner_id              uuid references public.profiles(id),
  -- Stats (updated async)
  total_queries         bigint not null default 0,
  last_queried_at       timestamptz,
  -- Meta
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index mcp_servers_created_by_idx on public.mcp_servers(created_by);
create index mcp_servers_status_idx on public.mcp_servers(status);

-- ============================================================
-- MCP QUERY LOG (for analytics + gap detection in Phase 3)
-- ============================================================
create table public.mcp_query_log (
  id                uuid primary key default uuid_generate_v4(),
  mcp_server_id     uuid not null references public.mcp_servers(id) on delete cascade,
  tool_name         text not null,       -- search|get|list
  query_text        text,               -- for search calls
  result_count      int,
  top_confidence    float,
  latency_ms        int,
  created_at        timestamptz not null default now()
);

create index mcp_query_log_server_idx on public.mcp_query_log(mcp_server_id, created_at desc);

-- ============================================================
-- RLS for MCP tables
-- ============================================================
alter table public.mcp_servers enable row level security;

create policy "Authenticated users can view mcp servers"
  on public.mcp_servers for select to authenticated using (true);

create policy "MCP owners and admins can create servers"
  on public.mcp_servers for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('mcp_owner', 'kb_admin', 'super_admin')
    )
  );

create policy "Owners and admins can update servers"
  on public.mcp_servers for update to authenticated
  using (
    created_by = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('kb_admin', 'super_admin'))
  );

alter table public.mcp_query_log enable row level security;

create policy "Admins can read query log"
  on public.mcp_query_log for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('kb_admin', 'super_admin'))
  );

create policy "System can insert query log"
  on public.mcp_query_log for insert to authenticated with check (true);

-- Auto-update updated_at
create trigger mcp_servers_updated_at before update on public.mcp_servers
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- Update profiles to allow mcp_owner role (already in Phase 1 enum)
-- No changes needed if Phase 1 schema was run first
-- ============================================================
