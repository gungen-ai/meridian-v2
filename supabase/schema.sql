-- ============================================================
-- Knowledge Base Manager — Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ============================================================
-- ENUMS
-- ============================================================
create type article_status as enum (
  'draft', 'in_review', 'approved', 'published', 'archived'
);

create type tag_status as enum ('active', 'deprecated');

create type user_role as enum (
  'viewer', 'editor', 'kb_admin', 'mcp_owner', 'super_admin'
);

create type tag_assignment_source as enum ('manual', 'ai');

create type review_decision as enum ('approved', 'changes_requested');

create type approval_policy as enum (
  'single', 'majority', 'all_must_approve', 'timed_auto'
);

-- ============================================================
-- USER PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  avatar_url    text,
  role          user_role not null default 'editor',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- CATEGORIES
-- ============================================================
create table public.categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  color       text default '#3b82f6',
  -- Approval policy for articles in this category
  approval_policy       approval_policy not null default 'single',
  auto_stale_days       int not null default 90,  -- days before article is stale
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- TAGS
-- ============================================================
create table public.tags (
  id          uuid primary key default uuid_generate_v4(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name        text not null,
  description text,
  status      tag_status not null default 'active',
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(category_id, name)
);

-- ============================================================
-- ARTICLES
-- ============================================================
create table public.articles (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null default 'Untitled Article',
  content         text not null default '',        -- HTML content from Tiptap
  content_text    text not null default '',        -- Plain text for search/embedding
  status          article_status not null default 'draft',
  author_id       uuid not null references public.profiles(id),
  owner_id        uuid references public.profiles(id),  -- accountability owner
  category_id     uuid references public.categories(id),
  -- Freshness tracking
  last_reviewed_at   timestamptz,
  freshness_score    int not null default 100,     -- 0-100
  freshness_label    text not null default 'fresh', -- fresh|review_suggested|review_required|stale
  -- Publishing
  published_at       timestamptz,
  scheduled_publish_at timestamptz,
  expires_at         timestamptz,
  -- Embedding for semantic search
  embedding          vector(1536),
  -- Meta
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Full-text search index
create index articles_content_text_fts on public.articles
  using gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content_text,'')));

-- Vector similarity index (for contradiction detection & semantic search)
create index articles_embedding_idx on public.articles
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Status index for fast filtering
create index articles_status_idx on public.articles(status);
create index articles_author_idx on public.articles(author_id);
create index articles_owner_idx on public.articles(owner_id);

-- ============================================================
-- ARTICLE VERSIONS (immutable history)
-- ============================================================
create table public.article_versions (
  id              uuid primary key default uuid_generate_v4(),
  article_id      uuid not null references public.articles(id) on delete cascade,
  version_number  int not null,
  title           text not null,
  content         text not null,
  content_text    text not null,
  status          article_status not null,
  editor_id       uuid not null references public.profiles(id),
  change_summary  text,
  created_at      timestamptz not null default now(),
  unique(article_id, version_number)
);

create index article_versions_article_idx on public.article_versions(article_id);

-- ============================================================
-- ARTICLE TAGS (junction table)
-- ============================================================
create table public.article_tags (
  id                uuid primary key default uuid_generate_v4(),
  article_id        uuid not null references public.articles(id) on delete cascade,
  tag_id            uuid not null references public.tags(id) on delete cascade,
  assigned_by       tag_assignment_source not null default 'manual',
  confidence_score  float,             -- 0-1 for AI assignments
  assigned_user_id  uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  unique(article_id, tag_id)
);

create index article_tags_article_idx on public.article_tags(article_id);
create index article_tags_tag_idx on public.article_tags(tag_id);

-- ============================================================
-- AI TAG SUGGESTIONS (pending human acceptance)
-- ============================================================
create table public.tag_suggestions (
  id                uuid primary key default uuid_generate_v4(),
  article_id        uuid not null references public.articles(id) on delete cascade,
  tag_id            uuid not null references public.tags(id) on delete cascade,
  confidence_score  float not null,
  justification     text,
  status            text not null default 'pending', -- pending|accepted|rejected
  rejected_reason   text,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

create index tag_suggestions_article_idx on public.tag_suggestions(article_id, status);

-- ============================================================
-- REVIEW TASKS
-- ============================================================
create table public.review_tasks (
  id            uuid primary key default uuid_generate_v4(),
  article_id    uuid not null references public.articles(id) on delete cascade,
  reviewer_id   uuid not null references public.profiles(id),
  status        text not null default 'awaiting', -- awaiting|approved|changes_requested
  decision      review_decision,
  comment       text,
  ai_brief      text,   -- AI-generated reviewer brief
  assigned_at   timestamptz not null default now(),
  completed_at  timestamptz
);

create index review_tasks_article_idx on public.review_tasks(article_id);
create index review_tasks_reviewer_idx on public.review_tasks(reviewer_id, status);

-- ============================================================
-- AUDIT LOG (immutable)
-- ============================================================
create table public.audit_events (
  id          bigserial primary key,
  event_type  text not null,
  entity_type text not null,   -- article|tag|category|review_task
  entity_id   uuid,
  actor_id    uuid references public.profiles(id),
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now()
);

create index audit_events_entity_idx on public.audit_events(entity_type, entity_id);
create index audit_events_actor_idx on public.audit_events(actor_id);
create index audit_events_type_idx on public.audit_events(event_type);
create index audit_events_created_idx on public.audit_events(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Profiles: users can read all profiles, update only their own
alter table public.profiles enable row level security;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Categories: authenticated users can read; admins can write
alter table public.categories enable row level security;
create policy "Categories viewable by authenticated users"
  on public.categories for select to authenticated using (true);
create policy "KB admins can manage categories"
  on public.categories for all to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('kb_admin','super_admin'))
  );

-- Tags: authenticated users can read; admins can write
alter table public.tags enable row level security;
create policy "Tags viewable by authenticated users"
  on public.tags for select to authenticated using (true);
create policy "KB admins can manage tags"
  on public.tags for all to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('kb_admin','super_admin'))
  );

-- Articles: complex policies based on status and role
alter table public.articles enable row level security;

-- All authenticated users can view published articles
create policy "Published articles viewable by all"
  on public.articles for select to authenticated
  using (status = 'published');

-- Authors can view their own articles in any state
create policy "Authors can view own articles"
  on public.articles for select to authenticated
  using (author_id = auth.uid());

-- KB admins and editors can view all articles
create policy "Admins and editors can view all articles"
  on public.articles for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('editor','kb_admin','super_admin'))
  );

-- Authors can insert articles
create policy "Editors can create articles"
  on public.articles for insert to authenticated
  with check (
    author_id = auth.uid() and
    exists (select 1 from public.profiles where id = auth.uid() and role in ('editor','kb_admin','super_admin'))
  );

-- Authors can update their own drafts; admins can update any
create policy "Authors update own drafts"
  on public.articles for update to authenticated
  using (
    author_id = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('kb_admin','super_admin'))
  );

-- Article versions: same as articles
alter table public.article_versions enable row level security;
create policy "Article versions follow article permissions"
  on public.article_versions for select to authenticated using (true);
create policy "Editors can insert versions"
  on public.article_versions for insert to authenticated
  with check (editor_id = auth.uid());

-- Article tags
alter table public.article_tags enable row level security;
create policy "Article tags viewable by all authenticated"
  on public.article_tags for select to authenticated using (true);
create policy "Editors can manage article tags"
  on public.article_tags for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('editor','kb_admin','super_admin'))
  );

-- Tag suggestions
alter table public.tag_suggestions enable row level security;
create policy "Tag suggestions viewable by authenticated"
  on public.tag_suggestions for select to authenticated using (true);
create policy "System can insert tag suggestions"
  on public.tag_suggestions for insert to authenticated with check (true);
create policy "Editors can update tag suggestions"
  on public.tag_suggestions for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('editor','kb_admin','super_admin'))
  );

-- Review tasks
alter table public.review_tasks enable row level security;
create policy "Reviewers can see their tasks"
  on public.review_tasks for select to authenticated
  using (reviewer_id = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('kb_admin','super_admin'))
  );
create policy "System can manage review tasks"
  on public.review_tasks for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('kb_admin','super_admin'))
  );
create policy "Reviewers can update their tasks"
  on public.review_tasks for update to authenticated
  using (reviewer_id = auth.uid());

-- Audit log: admins read; system inserts only
alter table public.audit_events enable row level security;
create policy "Admins can read audit log"
  on public.audit_events for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('kb_admin','super_admin'))
  );
create policy "System can insert audit events"
  on public.audit_events for insert to authenticated with check (true);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get next version number for an article
create or replace function public.next_version_number(p_article_id uuid)
returns int language sql security definer as $$
  select coalesce(max(version_number), 0) + 1
  from public.article_versions
  where article_id = p_article_id;
$$;

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger articles_updated_at before update on public.articles
  for each row execute procedure public.handle_updated_at();
create trigger categories_updated_at before update on public.categories
  for each row execute procedure public.handle_updated_at();
create trigger tags_updated_at before update on public.tags
  for each row execute procedure public.handle_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- SEED DATA — starter categories and tags
-- ============================================================
insert into public.categories (name, description, color, auto_stale_days) values
  ('Customer Support', 'Articles for customer-facing support agents', '#3b82f6', 90),
  ('Product', 'Product documentation and feature guides', '#8b5cf6', 60),
  ('Marketing', 'Brand guidelines and campaign resources', '#ec4899', 90),
  ('Engineering', 'Technical documentation and API references', '#14b8a6', 45),
  ('Legal & Compliance', 'Policies, terms, and compliance documentation', '#f59e0b', 180)
on conflict do nothing;

-- Insert tags for Customer Support
insert into public.tags (category_id, name, description) 
select id, 'Billing FAQs', 'Billing and payment related questions'
from public.categories where name = 'Customer Support';

insert into public.tags (category_id, name, description)
select id, 'Refund Policies', 'Refund and return policies'
from public.categories where name = 'Customer Support';

insert into public.tags (category_id, name, description)
select id, 'Escalation Procedures', 'How to escalate support issues'
from public.categories where name = 'Customer Support';

-- Insert tags for Product
insert into public.tags (category_id, name, description)
select id, 'Feature Guides', 'How-to guides for product features'
from public.categories where name = 'Product';

insert into public.tags (category_id, name, description)
select id, 'API Reference', 'API documentation and examples'
from public.categories where name = 'Product';

insert into public.tags (category_id, name, description)
select id, 'Release Notes', 'Product release notes and changelog'
from public.categories where name = 'Product';

-- Insert tags for Engineering
insert into public.tags (category_id, name, description)
select id, 'Architecture', 'System architecture documentation'
from public.categories where name = 'Engineering';

insert into public.tags (category_id, name, description)
select id, 'Runbooks', 'Operational runbooks and procedures'
from public.categories where name = 'Engineering';
