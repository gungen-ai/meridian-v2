-- ============================================================
-- Phase 3 Schema — Run in Supabase SQL Editor
-- (after Phase 1 + Phase 2 schemas are applied)
-- ============================================================

-- ============================================================
-- KNOWLEDGE GAPS
-- ============================================================
create type gap_type as enum ('type_a', 'type_b', 'type_c');
-- type_a: content exists but outside MCP scope
-- type_b: content genuinely absent from KB
-- type_c: ambiguous partial match

create type gap_status as enum ('open', 'resolved', 'dismissed');

create table public.knowledge_gaps (
  id                  uuid primary key default uuid_generate_v4(),
  mcp_server_id       uuid not null references public.mcp_servers(id) on delete cascade,
  query_text          text not null,
  gap_type            gap_type,               -- null until classified
  status              gap_status not null default 'open',
  recurrence_count    int not null default 1,
  last_seen_at        timestamptz not null default now(),
  -- Classification details
  candidate_article_id uuid references public.articles(id), -- for type_a: the article that exists
  suggested_title     text,                   -- for type_b: AI-suggested article title
  -- Resolution
  resolved_by         uuid references public.profiles(id),
  resolved_at         timestamptz,
  resolution_action   text,                   -- 'added_to_scope'|'article_created'|'dismissed'
  resolution_article_id uuid references public.articles(id),
  -- Vector fingerprint for deduplication
  query_embedding     vector(1536),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index knowledge_gaps_server_idx on public.knowledge_gaps(mcp_server_id, status);
create index knowledge_gaps_status_idx on public.knowledge_gaps(status, recurrence_count desc);
create index knowledge_gaps_updated_idx on public.knowledge_gaps(updated_at desc);

-- ============================================================
-- CONTRADICTIONS
-- ============================================================
create type contradiction_severity as enum ('critical', 'moderate', 'minor');
create type contradiction_status as enum ('open', 'resolved', 'dismissed');

create table public.contradictions (
  id                  uuid primary key default uuid_generate_v4(),
  article_a_id        uuid not null references public.articles(id) on delete cascade,
  article_b_id        uuid not null references public.articles(id) on delete cascade,
  severity            contradiction_severity not null default 'moderate',
  status              contradiction_status not null default 'open',
  -- LLM-extracted details
  sentence_a          text,   -- the conflicting sentence from article A
  sentence_b          text,   -- the conflicting sentence from article B
  explanation         text,   -- why they contradict
  suggested_resolution text,
  -- Resolution
  resolved_by         uuid references public.profiles(id),
  resolved_at         timestamptz,
  -- Dedup: don't re-check pairs we already know about
  pair_hash           text unique,            -- sha256(min(a,b) || max(a,b))
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index contradictions_article_a_idx on public.contradictions(article_a_id, status);
create index contradictions_article_b_idx on public.contradictions(article_b_id, status);
create index contradictions_status_idx on public.contradictions(status, severity);

-- ============================================================
-- RLS
-- ============================================================
alter table public.knowledge_gaps enable row level security;
create policy "Authenticated users can view gaps"
  on public.knowledge_gaps for select to authenticated using (true);
create policy "System can insert gaps"
  on public.knowledge_gaps for insert to authenticated with check (true);
create policy "Admins can update gaps"
  on public.knowledge_gaps for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('kb_admin','super_admin')));

alter table public.contradictions enable row level security;
create policy "Authenticated users can view contradictions"
  on public.contradictions for select to authenticated using (true);
create policy "System can insert contradictions"
  on public.contradictions for insert to authenticated with check (true);
create policy "Admins can update contradictions"
  on public.contradictions for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('kb_admin','super_admin')));

-- Auto-update triggers
create trigger knowledge_gaps_updated_at before update on public.knowledge_gaps
  for each row execute procedure public.handle_updated_at();
create trigger contradictions_updated_at before update on public.contradictions
  for each row execute procedure public.handle_updated_at();
