export type AnswerOrigin = 'official' | 'community' | 'ai'
export type QuestionType = 'single' | 'multi' | 'blank' | 'solve' | 'proof'
export type MistakeStatus = 'unmastered' | 'reviewing' | 'mastered'
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'
export type PaperMode = 'exam' | 'topic' | 'mistake'
export type PdfTemplateId = 'ustc-exam' | 'gaokao'
export type PdfExportMode = 'inline-solution' | 'split'
export type WriteSpaceSize = 'compact' | 'standard' | 'spacious'
export type NavTab = 'home' | 'bank' | 'paper' | 'ppt' | 'mistakes' | 'sources'

export interface FigureRef {
  path: string
  alt?: string | null
  sha256?: string | null
  width?: number | null
  height?: number | null
}

export interface QuestionOption {
  key: string
  md: string
  figures?: FigureRef[]
}

export interface QuestionRecord {
  id: string
  course_code: string
  schema_version?: string
  type: QuestionType
  stem: {
    md: string
    figures: FigureRef[]
  }
  options: QuestionOption[]
  answer: {
    md: string
    figures: FigureRef[]
    origin: AnswerOrigin
    origin_detail?: string | null
  }
  solution: {
    md: string
    steps?: string[]
    figures: FigureRef[]
  }
  tags: {
    kp_ids: string[]
    keywords: string[]
    difficulty: number
  }
  source: {
    kind: string
    batch: string
    ref: string
    year: number | null
    term?: string | null
    exam_kind?: string | null
    url?: string | null
    rights?: string
  }
  quality: {
    quarantined: boolean
    quarantine_reason?: string | null
    confidence?: number | null
    note?: string | null
    overlap_hint?: string | null
  }
}

export interface StoredQuestion extends QuestionRecord {
  source_id: string
  key: string // `${source_id}\0${id}`
  search_text: string
}

export interface TaxonomyNode {
  id: string
  parent_id: string | null
  level: number
  name: string
  chapter_ref?: string | null
}

export interface StoredTaxonomy {
  key: string // `${source_id}\0${course_code}`
  source_id: string
  course_code: string
  nodes: TaxonomyNode[]
}

export interface ManifestCourse {
  code: string
  name: string
  name_en: string
  department: string
  category: string
  total: number
  quarantined: number
  by_origin: Record<AnswerOrigin, number>
  exam_years: number[]
  paths: {
    meta: string
    taxonomy: string
    questions: string
  }
  sha256: {
    meta: string
    taxonomy: string
    questions: string
  }
}

export interface BankManifest {
  name: string
  schema_version: string
  data_version: string
  updated_at: string
  repository: string
  asset_base_url: string | null
  feedback_endpoint?: string | null
  feedback_url?: string | null
  license?: {
    code_and_schema?: string
    question_content?: string
  }
  stats: {
    courses: number
    questions: number
    quarantined: number
    by_origin: Record<AnswerOrigin, number>
  }
  courses: ManifestCourse[]
}

export interface SourceConfig {
  source_id: string
  name: string
  transport: 'github-raw' | 'http-manifest' | 'local-import' | 'personal'
  location: string
  ref?: string | null
  mirror_url?: string | null
  data_version?: string | null
  last_synced_at?: string | null
  manifest?: BankManifest | null
  installed_courses: Record<
    string,
    {
      installed_at: string
      question_count: number
      questions_sha256?: string
      taxonomy_sha256?: string
      description?: string
    }
  >
  builtin?: boolean
}

export interface PaperItem {
  seq: number
  section_index: number
  section_title: string
  source_id: string
  question_id: string
  score: number
  is_original_redo: boolean
  comment_md: string | null
  question: QuestionRecord
}

export interface PaperHeaderMeta {
  schoolTerm: string
  courseTitle: string
  examDate: string
  examForm: string
  footerTerm: string
  subject: string
  showBindingLine: boolean
  writeSpace: WriteSpaceSize
}

export interface SavedPaper {
  paper_id: string
  title: string
  mode: PaperMode
  course_codes: string[]
  course_names: string[]
  header_meta: Partial<PaperHeaderMeta>
  config: Record<string, unknown>
  items: PaperItem[]
  created_at: string
  updated_at: string
}

export interface MistakeRecord {
  mistake_id: string
  source_id: string
  course_code: string
  question_id: string
  status: MistakeStatus
  wrong_count: number
  review_count: number
  ease_factor: number
  interval_days: number
  next_review_at: string
  last_wrong_at: string
  last_reviewed_at: string | null
  error_tags: string[]
  wrong_attempt_md: string
  reflection_md: string
  question: QuestionRecord
  created_at: string
  updated_at: string
}

export interface FeedbackRecord {
  feedback_id: string
  source_id: string
  question_id: string
  course_code: string
  categories: string[]
  detail: string
  delivery_status: 'delivered' | 'prepared' | 'local'
  delivered_issue_url?: string | null
  issue_channels: { id: string; label: string; url: string; primary: boolean }[]
  markdown: string
  created_at: string
}

export interface AssembleSectionConfig {
  id: string
  title: string
  count: number
  score: number
  types: QuestionType[]
}

export interface AssembleGap {
  section: string
  requested: number
  available: number
  missing: number
  suggestions: string[]
}
