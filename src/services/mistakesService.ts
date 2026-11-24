import {
  deleteMistake,
  listAllQuestions,
  listMistakes,
  putQuestion,
  saveMistake,
  savePaper,
} from '../db/storage'
import { buildSearchText } from './sourceSync'
import type {
  MistakeRecord,
  MistakeStatus,
  PaperItem,
  QuestionRecord,
  QuestionType,
  ReviewRating,
  SavedPaper,
  StoredQuestion,
} from '../types/study'
import { sectionTitleForType } from '../engine/paperAssembler'

const DAY_MS = 86_400_000

function clampEase(value: number): number {
  return Math.min(3, Math.max(1.3, Number(value.toFixed(2))))
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString()
}

export function scheduleSm2Review(
  mistake: Pick<MistakeRecord, 'review_count' | 'ease_factor' | 'interval_days'>,
  rating: ReviewRating,
): { status: MistakeStatus; interval_days: number; ease_factor: number } {
  const nextCount = mistake.review_count + 1
  let ease = mistake.ease_factor || 2.5
  let interval = mistake.interval_days || 1
  let status: MistakeStatus = 'reviewing'

  if (rating === 'again') {
    interval = 1
    ease = clampEase(ease - 0.2)
    status = 'unmastered'
  } else if (rating === 'hard') {
    interval = Math.max(1, Math.round(interval * 1.2))
    ease = clampEase(ease - 0.15)
  } else if (rating === 'good') {
    interval = nextCount === 1 ? 1 : nextCount === 2 ? 3 : Math.round(interval * ease)
    status = nextCount >= 2 ? 'mastered' : 'reviewing'
  } else {
    interval = Math.max(4, Math.round(interval * ease * 1.3))
    ease = clampEase(ease + 0.15)
    status = 'mastered'
  }

  return { status, interval_days: interval, ease_factor: ease }
}

export async function markQuestionAsMistake(params: {
  source_id: string
  question: QuestionRecord
  error_tags?: string[]
  wrong_attempt_md?: string
  reflection_md?: string
}): Promise<MistakeRecord> {
  const all = await listMistakes()
  const now = new Date().toISOString()
  const prior = all.find(
    m => m.source_id === params.source_id && m.question_id === params.question.id,
  )

  if (prior) {
    const mergedTags = Array.from(new Set([...(prior.error_tags ?? []), ...(params.error_tags ?? [])]))
    const updated: MistakeRecord = {
      ...prior,
      status: 'unmastered',
      wrong_count: prior.wrong_count + 1,
      interval_days: 1,
      next_review_at: addDays(now, 1),
      last_wrong_at: now,
      error_tags: mergedTags,
      wrong_attempt_md: params.wrong_attempt_md ?? prior.wrong_attempt_md,
      reflection_md: params.reflection_md ?? prior.reflection_md,
      updated_at: now,
    }
    await saveMistake(updated)
    return updated
  }

  const record: MistakeRecord = {
    mistake_id: `mk-${crypto.randomUUID().slice(0, 10)}`,
    source_id: params.source_id,
    course_code: params.question.course_code,
    question_id: params.question.id,
    status: 'unmastered',
    wrong_count: 1,
    review_count: 0,
    ease_factor: 2.5,
    interval_days: 1,
    next_review_at: now, // immediately available to review today
    last_wrong_at: now,
    last_reviewed_at: null,
    error_tags: Array.from(new Set(params.error_tags ?? [])),
    wrong_attempt_md: params.wrong_attempt_md ?? '',
    reflection_md: params.reflection_md ?? '',
    question: params.question,
    created_at: now,
    updated_at: now,
  }
  await saveMistake(record)
  return record
}

export async function createPersonalMistake(input: {
  course_code: string
  type: QuestionType
  stem_md: string
  answer_md: string
  solution_md: string
  difficulty?: number
  error_tags?: string[]
  wrong_attempt_md?: string
  reflection_md?: string
  source_ref?: string
}): Promise<MistakeRecord> {
  const now = new Date().toISOString()
  const dateCompact = now.slice(0, 10).replaceAll('-', '')
  const code = input.course_code.trim() || 'PERSONAL'
  const id = `${code}-personal-${dateCompact}-${crypto.randomUUID().slice(0, 6)}`
  const question: QuestionRecord = {
    id,
    course_code: code,
    schema_version: '1.0',
    type: input.type,
    stem: { md: input.stem_md.trim(), figures: [] },
    options: [],
    answer: {
      md: input.answer_md.trim(),
      figures: [],
      origin: 'community',
      origin_detail: '个人自录错题',
    },
    solution: {
      md: input.solution_md.trim(),
      steps: [],
      figures: [],
    },
    tags: {
      kp_ids: ['personal-general'],
      keywords: input.error_tags ?? [],
      difficulty: input.difficulty ?? 3,
    },
    source: {
      kind: 'notes',
      batch: 'personal_mistakes',
      ref: input.source_ref?.trim() || '个人手工录入',
      year: new Date().getFullYear(),
      rights: 'original',
    },
    quality: {
      quarantined: false,
      note: null,
    },
  }

  const stored: StoredQuestion = {
    ...question,
    source_id: 'local-personal',
    key: `local-personal\0${id}`,
    search_text: buildSearchText(question),
  }
  await putQuestion(stored)

  return markQuestionAsMistake({
    source_id: 'local-personal',
    question,
    error_tags: input.error_tags,
    wrong_attempt_md: input.wrong_attempt_md,
    reflection_md: input.reflection_md,
  })
}

export async function reviewMistakeRecord(
  mistake: MistakeRecord,
  rating: ReviewRating,
): Promise<MistakeRecord> {
  const now = new Date().toISOString()
  const next = scheduleSm2Review(mistake, rating)
  const updated: MistakeRecord = {
    ...mistake,
    status: next.status,
    review_count: mistake.review_count + 1,
    ease_factor: next.ease_factor,
    interval_days: next.interval_days,
    next_review_at: addDays(now, next.interval_days),
    last_reviewed_at: now,
    updated_at: now,
  }
  await saveMistake(updated)
  return updated
}

export async function updateMistakeNotes(
  mistake: MistakeRecord,
  patch: { error_tags?: string[]; wrong_attempt_md?: string; reflection_md?: string },
): Promise<MistakeRecord> {
  const updated: MistakeRecord = {
    ...mistake,
    error_tags: patch.error_tags ?? mistake.error_tags,
    wrong_attempt_md: patch.wrong_attempt_md ?? mistake.wrong_attempt_md,
    reflection_md: patch.reflection_md ?? mistake.reflection_md,
    updated_at: new Date().toISOString(),
  }
  await saveMistake(updated)
  return updated
}

export async function removeMistakeRecord(mistakeId: string): Promise<void> {
  await deleteMistake(mistakeId)
}

export async function assembleMistakePaper(options: {
  mistakes: MistakeRecord[]
  courseCodes?: string[]
  courseNameMap?: Record<string, string>
  count?: number
  originalRedoRatio?: number
  includeSimilar?: boolean
  title?: string
}): Promise<SavedPaper> {
  const now = Date.now()
  const filtered = options.mistakes.filter(
    m => !options.courseCodes?.length || options.courseCodes.includes(m.course_code),
  )
  if (!filtered.length) throw new Error('所选范围内暂无错题记录')

  const ranked = [...filtered].sort((a, b) => {
    const aDue = Number(Date.parse(a.next_review_at) <= now)
    const bDue = Number(Date.parse(b.next_review_at) <= now)
    return (
      bDue - aDue ||
      Number(b.status === 'unmastered') - Number(a.status === 'unmastered') ||
      b.wrong_count - a.wrong_count ||
      b.last_wrong_at.localeCompare(a.last_wrong_at)
    )
  })

  const target = Math.max(1, Math.min(100, options.count ?? 10))
  const ratio = Math.min(1, Math.max(0, options.originalRedoRatio ?? 0.6))
  const origTarget = options.includeSimilar === false ? target : Math.max(1, Math.round(target * ratio))
  const originals = ranked.slice(0, origTarget)

  const usedKeys = new Set(originals.map(m => `${m.source_id}\0${m.question_id}`))
  const related: StoredQuestion[] = []

  if (options.includeSimilar !== false && originals.length < target) {
    const pool = await listAllQuestions()
    const kpSet = new Set(originals.flatMap(m => m.question.tags?.kp_ids ?? []))
    const courseSet = new Set(originals.map(m => m.course_code))

    for (const q of pool) {
      if (related.length + originals.length >= target) break
      if (q.quality?.quarantined) continue
      if (!courseSet.has(q.course_code)) continue
      const key = `${q.source_id}\0${q.id}`
      if (usedKeys.has(key)) continue
      if (q.tags?.kp_ids?.some(kp => kpSet.has(kp))) {
        usedKeys.add(key)
        related.push(q)
      }
    }
  }

  const typeOrder: Record<string, number> = { single: 0, multi: 1, blank: 2, solve: 3, proof: 4 }
  const combined = [
    ...originals.map(m => ({
      source_id: m.source_id,
      question_id: m.question_id,
      question: m.question,
      is_original_redo: true,
      comment_md:
        [
          m.error_tags?.length ? `错因：${m.error_tags.join('、')}` : '',
          m.reflection_md?.trim() ?? '',
        ]
          .filter(Boolean)
          .join('；') || null,
    })),
    ...related.map(q => ({
      source_id: q.source_id,
      question_id: q.id,
      question: q,
      is_original_redo: false,
      comment_md: '同知识点举一反三巩固题',
    })),
  ].sort((a, b) => (typeOrder[a.question.type] ?? 3) - (typeOrder[b.question.type] ?? 3))

  const items: PaperItem[] = combined.map((entry, idx) => ({
    seq: idx + 1,
    section_index: typeOrder[entry.question.type] ?? 3,
    section_title: sectionTitleForType(entry.question.type),
    source_id: entry.source_id,
    question_id: entry.question_id,
    score: 10,
    is_original_redo: entry.is_original_redo,
    comment_md: entry.comment_md,
    question: entry.question,
  }))

  const codes = Array.from(new Set(items.map(i => i.question.course_code)))
  const names = codes.map(c => options.courseNameMap?.[c] || c)
  const iso = new Date().toISOString()

  const paper: SavedPaper = {
    paper_id: `paper-${crypto.randomUUID().slice(0, 10)}`,
    title: options.title?.trim() || (names.length ? `《${names.join('、')}》错题巩固卷` : '错题巩固卷'),
    mode: 'mistake',
    course_codes: codes,
    course_names: names,
    header_meta: {},
    config: { count: target, originalRedoRatio: ratio, includeSimilar: options.includeSimilar !== false },
    items,
    created_at: iso,
    updated_at: iso,
  }
  await savePaper(paper)
  return paper
}
