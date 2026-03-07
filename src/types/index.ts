export type UserRole = 'viewer' | 'editor' | 'kb_admin' | 'mcp_owner' | 'super_admin'
export type ArticleStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'archived'
export type TagStatus = 'active' | 'deprecated'
export type TagAssignmentSource = 'manual' | 'ai'
export type ReviewDecision = 'approved' | 'changes_requested'
export type ApprovalPolicy = 'single' | 'majority' | 'all_must_approve' | 'timed_auto'
export type FreshnessLabel = 'fresh' | 'review_suggested' | 'review_required' | 'stale'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  color: string
  approval_policy: ApprovalPolicy
  auto_stale_days: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  category_id: string
  name: string
  description: string | null
  status: TagStatus
  created_by: string | null
  created_at: string
  updated_at: string
  category?: Category
}

export interface Article {
  id: string
  title: string
  content: string
  content_text: string
  status: ArticleStatus
  author_id: string
  owner_id: string | null
  category_id: string | null
  last_reviewed_at: string | null
  freshness_score: number
  freshness_label: FreshnessLabel
  published_at: string | null
  scheduled_publish_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
  // Joined fields
  author?: Profile
  owner?: Profile
  category?: Category
  tags?: ArticleTag[]
}

export interface ArticleTag {
  id: string
  article_id: string
  tag_id: string
  assigned_by: TagAssignmentSource
  confidence_score: number | null
  assigned_user_id: string | null
  created_at: string
  tag?: Tag
}

export interface TagSuggestion {
  id: string
  article_id: string
  tag_id: string
  confidence_score: number
  justification: string | null
  status: 'pending' | 'accepted' | 'rejected'
  rejected_reason: string | null
  created_at: string
  resolved_at: string | null
  tag?: Tag
}

export interface ReviewTask {
  id: string
  article_id: string
  reviewer_id: string
  status: 'awaiting' | 'approved' | 'changes_requested'
  decision: ReviewDecision | null
  comment: string | null
  ai_brief: string | null
  assigned_at: string
  completed_at: string | null
  reviewer?: Profile
  article?: Article
}

export interface ArticleVersion {
  id: string
  article_id: string
  version_number: number
  title: string
  content: string
  content_text: string
  status: ArticleStatus
  editor_id: string
  change_summary: string | null
  created_at: string
  editor?: Profile
}

export interface AuditEvent {
  id: number
  event_type: string
  entity_type: string
  entity_id: string | null
  actor_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  actor?: Profile
}

// API response types
export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
}
