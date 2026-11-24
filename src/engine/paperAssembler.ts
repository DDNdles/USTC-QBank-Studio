import type {
  AnswerOrigin,
  AssembleGap,
  AssembleSectionConfig,
  PaperItem,
  PaperMode,
  QuestionType,
  SavedPaper,
  StoredQuestion,
  StoredTaxonomy,
} from '../types/study'

export function sectionTitleForType(type: string): string {
  const map: Record<string, string> = {
    single: '单项选择题',
    multi: '多项选择题',
    blank: '填空题',
    solve: '计算与解答题',
    proof: '证明题',
  }
  return map[type] ?? '解答题'
}

export function typeLabel(type: string): string {
  const map: Record<string, string> = {
    single: '单选题',
    multi: '多选题',
    blank: '填空题',
    solve: '解答题',
    proof: '证明题',
  }
  return map[type] ?? '解答题'
}

export function originLabel(origin: string): string {
  const map: Record<string, string> = {
    official: '官方标答',
    community: '社区详解',
    ai: 'AI 推导',
  }
  return map[origin] ?? '参考答案'
}

export function chineseNumber(value: number): string {
  const arr = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']
  return arr[value] ?? String(value)
}

function hashSeed(value: string): number {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createRandom(seed: number | string): () => number {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(String(seed))
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function shuffleInPlace<T>(values: T[], random: () => number): T[] {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  return values
}

export function expandTaxonomySelection(
  taxonomies: StoredTaxonomy[],
  courseCodes: string[],
  requestedKpIds: string[],
): Set<string> {
  if (!requestedKpIds.length) return new Set()
  const filtered = courseCodes.length
    ? taxonomies.filter(t => courseCodes.includes(t.course_code))
    : taxonomies

  const childrenMap = new Map<string, string[]>()
  for (const tax of filtered) {
    for (const node of tax.nodes) {
      const parentKey = `${tax.course_code}\0${node.parent_id ?? ''}`
      const list = childrenMap.get(parentKey) ?? []
      list.push(node.id)
      childrenMap.set(parentKey, list)
    }
  }

  const expanded = new Set<string>()
  for (const tax of filtered) {
    const nodeIds = new Set(tax.nodes.map(n => n.id))
    for (const req of requestedKpIds) {
      if (!nodeIds.has(req)) continue
      const stack = [req]
      while (stack.length) {
        const cur = stack.pop()!
        if (expanded.has(cur)) continue
        expanded.add(cur)
        const kids = childrenMap.get(`${tax.course_code}\0${cur}`) ?? []
        for (const k of kids) stack.push(k)
      }
    }
  }
  return expanded
}

export interface AssembleFilters {
  courseCodes: string[]
  kpIds?: string[]
  types?: QuestionType[]
  answerOrigins?: AnswerOrigin[]
  difficultyMin?: number
  difficultyMax?: number
  yearFrom?: number | null
  yearTo?: number | null
  excludeQuarantined?: boolean
}

export function filterCandidates(
  questions: StoredQuestion[],
  taxonomies: StoredTaxonomy[],
  filters: AssembleFilters,
): StoredQuestion[] {
  const expandedKps = expandTaxonomySelection(taxonomies, filters.courseCodes, filters.kpIds ?? [])

  return questions.filter(q => {
    if (filters.excludeQuarantined !== false && q.quality?.quarantined) return false
    if (filters.courseCodes.length && !filters.courseCodes.includes(q.course_code)) return false
    if (filters.types?.length && !filters.types.includes(q.type)) return false
    if (filters.answerOrigins?.length && !filters.answerOrigins.includes(q.answer?.origin)) return false
    const diff = q.tags?.difficulty ?? 3
    if (filters.difficultyMin != null && diff < filters.difficultyMin) return false
    if (filters.difficultyMax != null && diff > filters.difficultyMax) return false
    const year = q.source?.year
    if (filters.yearFrom != null && (year == null || year < filters.yearFrom)) return false
    if (filters.yearTo != null && (year == null || year > filters.yearTo)) return false
    if (expandedKps.size > 0) {
      const qKps = q.tags?.kp_ids ?? []
      if (!qKps.some(id => expandedKps.has(id))) return false
    }
    return true
  })
}

function relaxationSuggestions(filters: AssembleFilters): string[] {
  const list: string[] = []
  if (filters.yearFrom || filters.yearTo) list.push('放宽年份范围')
  if (filters.answerOrigins?.length) list.push('允许更多答案来源（官方 / 社区 / AI）')
  if (filters.difficultyMin || filters.difficultyMax) list.push('放宽难度区间')
  if (filters.kpIds?.length) list.push('选择父级或更多知识点')
  if (filters.types?.length) list.push('增加可选题型')
  return list
}

export interface AssemblePaperRequest {
  title?: string
  mode: PaperMode
  count: number
  scorePerQuestion?: number
  seed?: number | string
  filters: AssembleFilters
  sections?: AssembleSectionConfig[]
  courseNameMap: Record<string, string>
}

export function assemblePaperFromPool(
  questions: StoredQuestion[],
  taxonomies: StoredTaxonomy[],
  req: AssemblePaperRequest,
): { paper: SavedPaper; gaps: AssembleGap[] } {
  const seed = req.seed ?? Date.now()
  const rng = createRandom(seed)
  const used = new Set<string>()
  const typeOrder: Record<string, number> = { single: 0, multi: 1, blank: 2, solve: 3, proof: 4 }

  const useCustomSections = Array.isArray(req.sections) && req.sections.length > 0
  const sections: AssembleSectionConfig[] = useCustomSections
    ? req.sections!
    : [
        {
          id: 'default',
          title: '',
          count: Math.max(1, Math.min(200, Math.trunc(req.count || 10))),
          score: req.scorePerQuestion && req.scorePerQuestion > 0 ? req.scorePerQuestion : 10,
          types: req.filters.types ?? [],
        },
      ]

  const items: PaperItem[] = []
  const gaps: AssembleGap[] = []

  for (const [secIdx, sec] of sections.entries()) {
    const secFilters: AssembleFilters = {
      ...req.filters,
      types: sec.types?.length ? sec.types : req.filters.types,
    }
    const candidates = filterCandidates(questions, taxonomies, secFilters)
    const shuffled = shuffleInPlace([...candidates], rng)
    const chosen = shuffled.filter(q => !used.has(q.key)).slice(0, sec.count)

    if (!useCustomSections) {
      chosen.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9))
    }

    for (const q of chosen) {
      used.add(q.key)
      items.push({
        seq: items.length + 1,
        section_index: useCustomSections ? secIdx : (typeOrder[q.type] ?? 3),
        section_title: sec.title.trim() || sectionTitleForType(q.type),
        source_id: q.source_id,
        question_id: q.id,
        score: sec.score > 0 ? sec.score : 10,
        is_original_redo: false,
        comment_md: null,
        question: q,
      })
    }

    if (chosen.length < sec.count) {
      gaps.push({
        section: sec.title.trim() || '全部题目',
        requested: sec.count,
        available: candidates.length,
        missing: sec.count - chosen.length,
        suggestions: relaxationSuggestions(secFilters),
      })
    }
  }

  const codes = req.filters.courseCodes.length
    ? req.filters.courseCodes
    : Array.from(new Set(items.map(i => i.question.course_code)))
  const names = codes.map(c => req.courseNameMap[c] || c)
  const fallbackTitle = names.length
    ? `《${names.join('、')}》${req.mode === 'topic' ? '专题练习卷' : '模拟试卷'}`
    : req.mode === 'topic'
      ? '专题练习卷'
      : '综合模拟试卷'

  const now = new Date().toISOString()
  const paper: SavedPaper = {
    paper_id: `paper-${crypto.randomUUID().slice(0, 10)}`,
    title: req.title?.trim() || fallbackTitle,
    mode: req.mode,
    course_codes: codes,
    course_names: names,
    header_meta: {},
    config: { mode: req.mode, seed, filters: req.filters, gaps },
    items,
    created_at: now,
    updated_at: now,
  }

  return { paper, gaps }
}

export function assemblePaperFromSelection(
  selected: StoredQuestion[],
  courseNameMap: Record<string, string>,
  title?: string,
  scorePerQuestion = 10,
): SavedPaper {
  const typeOrder: Record<string, number> = { single: 0, multi: 1, blank: 2, solve: 3, proof: 4 }
  const ordered = [...selected].sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9))
  const codes = Array.from(new Set(ordered.map(q => q.course_code)))
  const names = codes.map(c => courseNameMap[c] || c)
  const now = new Date().toISOString()

  return {
    paper_id: `paper-${crypto.randomUUID().slice(0, 10)}`,
    title: title?.trim() || (names.length ? `《${names.join('、')}》自选练习卷` : '自选练习卷'),
    mode: 'topic',
    course_codes: codes,
    course_names: names,
    header_meta: {},
    config: { custom: true },
    items: ordered.map((q, i) => ({
      seq: i + 1,
      section_index: typeOrder[q.type] ?? 3,
      section_title: sectionTitleForType(q.type),
      source_id: q.source_id,
      question_id: q.id,
      score: scorePerQuestion,
      is_original_redo: false,
      comment_md: null,
      question: q,
    })),
    created_at: now,
    updated_at: now,
  }
}
