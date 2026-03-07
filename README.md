# Knowledge Base Manager — Phase 1

A full-stack KB management platform built with Next.js, Supabase, and Claude AI.

## What's in Phase 1

- ✅ Auth (signup, login, role-based access)
- ✅ Article CRUD with rich text editor (TipTap)
- ✅ Article lifecycle: Draft → In Review → Approved → Published → Archived
- ✅ Version history (every save creates an immutable snapshot)
- ✅ Tag & Category taxonomy management
- ✅ AI Auto-Tagging via Claude API
- ✅ AI Reviewer Brief generation via Claude API
- ✅ Review workflow (assign reviewer, approve/request changes)
- ✅ Dashboard with stats and recent activity
- ✅ Full audit logging

---

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for it to initialize (~2 minutes)
3. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 2. Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Copy the entire contents of `supabase/schema.sql`
3. Paste it and click **Run**
4. You should see: tables created, RLS policies applied, seed data inserted

### 3. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
ANTHROPIC_API_KEY=sk-ant-...
```

Get your Anthropic API key at [console.anthropic.com](https://console.anthropic.com)

### 4. Install Dependencies & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Create Your First User

1. Go to `http://localhost:3000/auth/signup`
2. Create an account
3. **Important:** To give yourself admin access, go to Supabase → Table Editor → `profiles` → find your row → set `role` to `kb_admin`

---

## How to Test Each Feature

### Article Creation
1. Click "New Article" in the dashboard
2. Write content using the rich text editor
3. Select a category and owner in the sidebar
4. Click "Create Article" → you'll be redirected to the article page

### AI Auto-Tagging
1. Open any saved article in the editor
2. Click "AI Auto-Tag" (purple button, top right of editor)
3. Tag suggestions appear in the right sidebar with confidence scores and justifications
4. Accept or dismiss each suggestion

### Submit for Review
1. Open a draft article in the editor
2. Click "Submit for Review"
3. Select a reviewer from the dropdown
4. Claude generates a reviewer brief automatically
5. The reviewer sees their task in "My Review Queue" on the dashboard

### Reviewing an Article
1. Log in as the assigned reviewer
2. Click the article in "My Review Queue"
3. Expand "AI Reviewer Brief" to see Claude's analysis
4. Click "Approve" or "Request Changes"

### Tag Management
1. Go to Dashboard → Tags
2. KB Admins can create categories and tags
3. Tags are organized hierarchically under categories

### Publishing
1. After an article is approved, KB Admins see a "Publish" button
2. Click Publish → article status changes to Published with a timestamp
3. Published articles show a Freshness badge (starts as "Fresh")

---

## Project Structure

```
src/
├── app/
│   ├── api/                    # API routes
│   │   ├── articles/           # Article CRUD + publish + autotag + review
│   │   ├── tags/               # Tag CRUD
│   │   └── categories/         # Category CRUD
│   ├── auth/                   # Login + signup pages
│   └── dashboard/              # Main app pages
│       ├── page.tsx            # Dashboard home
│       ├── articles/           # Article list + detail + edit + new
│       └── tags/               # Tag management
├── components/
│   ├── articles/               # ArticleActions, ReviewPanel, TagPanel
│   ├── editor/                 # ArticleEditor (TipTap), TagSelector
│   ├── tags/                   # TagManager
│   └── ui/                     # Sidebar
├── lib/
│   ├── claude.ts               # All Claude API calls
│   ├── utils.ts                # Helpers, status configs
│   └── supabase/               # client.ts + server.ts
└── types/
    └── index.ts                # All TypeScript types
```

---

## User Roles

| Role | Can Do |
|------|--------|
| `viewer` | Read published articles |
| `editor` | Create/edit articles, submit for review |
| `kb_admin` | Everything + publish, manage taxonomy, view audit log |
| `super_admin` | Everything |

Change roles in: Supabase → Table Editor → `profiles` → edit `role` column

---

## Phase 2 Preview

Phase 2 will add:
- **MCP Server Generation Wizard** — 5-step no-code wizard to create scoped MCP servers
- **MCP Runtime** — hosted endpoints AI agents can query
- **Scoped token architecture** — cryptographic tag-set enforcement

Phase 3 will add:
- **Knowledge Gap Intelligence** — detect and diagnose when agents can't find answers
- **Contradiction Detection** — LLM-powered conflict detection across articles
- **Freshness Management** — staleness scoring, ownership nudges, review campaigns
