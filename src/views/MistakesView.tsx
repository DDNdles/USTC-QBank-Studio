import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookPlus,
  CheckCircle2,
  Eye,
  FileText,
  Flame,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useStudy } from '../context/StudyContext'
import { RichMath } from '../components/RichMath'
import { assembleMistakePaper, scheduleSm2Review } from '../services/mistakesService'
import { resolveSolutionText } from '../engine/examRenderer'
import { typeLabel } from '../engine/paperAssembler'
import type { MistakeStatus, ReviewRating } from '../types/study'

const STATUS_LABEL: Record<MistakeStatus, string> = {
  unmastered: '未掌握',
  reviewing: '复习中',
  mastered: '已掌握',
}

const RATINGS: { id: ReviewRating; label: string; tone: string }[] = [
  { id: 'again', label: '重来', tone: 'border-[var(--comment-red)]/40 bg-[var(--comment-red-soft)] text-[var(--comment-red)]' },
  { id: 'hard', label: '困难', tone: 'border-[var(--amber)]/40 bg-[var(--amber-soft)] text-[var(--amber)]' },
  { id: 'good', label: '良好', tone: 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]' },
  { id: 'easy', label: '轻松掌握', tone: 'border-[var(--mastered)]/40 bg-[var(--mastered-soft)] text-[var(--mastered)]' },
]

export function MistakesView({
  onOpenAddModal,
}: {
  onOpenAddModal: () => void
}) {
  const {
    mistakes,
    courseNameMap,
    reviewMistake,
    editMistakeNotes,
    deleteMistakeById,
    persistPaper,
    setActiveTab,
    showToast,
  } = useStudy()

  const [statusFilter, setStatusFilter] = useState<'all' | MistakeStatus>('all')
  const [courseFilter, setCourseFilter] = useState('')
  const [reviewMode, setReviewMode] = useState(false)
  const [revealAnswer, setRevealAnswer] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [generatingPaper, setGeneratingPaper] = useState(false)

  const now = Date.now()
  const dueList = useMemo(
    () => mistakes.filter(m => m.status !== 'mastered' && Date.parse(m.next_review_at) <= now),
    [mistakes, now],
  )
  const masteredCount = useMemo(
    () => mistakes.filter(m => m.status === 'mastered').length,
    [mistakes],
  )

  const courseOptions = useMemo(
    () => Array.from(new Set(mistakes.map(m => m.course_code))).sort(),
    [mistakes],
  )

  const filtered = useMemo(
    () =>
      mistakes.filter(m => {
        if (statusFilter !== 'all' && m.status !== statusFilter) return false
        if (courseFilter && m.course_code !== courseFilter) return false
        return true
      }),
    [mistakes, statusFilter, courseFilter],
  )

  const handleGenerateConsolidationPaper = async () => {
    setGeneratingPaper(true)
    try {
      const paper = await assembleMistakePaper({
        mistakes,
        courseCodes: courseFilter ? [courseFilter] : [],
        courseNameMap,
        count: Math.min(12, Math.max(4, mistakes.length * 2)),
        originalRedoRatio: 0.6,
        includeSimilar: true,
      })
      await persistPaper(paper, true)
      showToast(`已生成错题巩固卷「${paper.title}」（含错题原题与举一反三题）`, 'success')
      setActiveTab('paper')
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setGeneratingPaper(false)
    }
  }

  const activeCard = dueList[0] ?? null

  return (
    <div className="mx-auto max-w-[1140px] px-4 sm:px-6 py-8 pb-28 md:pb-16 space-y-7">
      {/* Header & Telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[var(--ink-primary)]">
            错题本与复盘
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-3.5 py-2 text-xs font-medium text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <BookPlus className="h-3.5 w-3.5 text-[var(--accent)]" /> 手工录错题
          </button>

          {mistakes.length > 0 && (
            <button
              type="button"
              disabled={generatingPaper}
              onClick={() => void handleGenerateConsolidationPaper()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--ink-primary)] px-4 py-2 text-xs font-medium text-[var(--bg-paper)] hover:opacity-92 disabled:opacity-50 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" /> 一键生成错题巩固卷
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="paper-card rounded-2xl p-4">
          <div className="text-xs text-[var(--ink-muted)]">累计错题</div>
          <div className="font-mono-num text-2xl font-semibold mt-1">{mistakes.length}</div>
        </div>
        <div className="paper-card rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
            <span>今日待复习</span>
            {dueList.length > 0 && <Flame className="h-3.5 w-3.5 text-[var(--amber)]" />}
          </div>
          <div className="font-mono-num text-2xl font-semibold text-[var(--amber)] mt-1">{dueList.length}</div>
        </div>
        <div className="paper-card rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-[var(--ink-muted)]">
            <span>已掌握</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--mastered)]" />
          </div>
          <div className="font-mono-num text-2xl font-semibold text-[var(--mastered)] mt-1">
            {mistakes.length ? `${Math.round((masteredCount / mistakes.length) * 100)}%` : '0%'}
          </div>
        </div>
      </div>

      {/* Interactive SM-2 Flashcard Session */}
      {dueList.length > 0 && (
        <div className="paper-card rounded-2xl p-5 space-y-4 border-[var(--amber)]/35">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--amber)]" />
              <span className="font-editorial text-base font-semibold">
                今日待复习闪卡队列（剩余 {dueList.length} 题）
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setReviewMode(v => !v)
                setRevealAnswer(false)
              }}
              className="rounded-full bg-[var(--amber)] px-4 py-1.5 text-xs font-medium text-white cursor-pointer"
            >
              {reviewMode ? '暂离闪卡' : '开始专注复习'}
            </button>
          </div>

          <AnimatePresence>
            {reviewMode && activeCard && (
              <motion.div
                key={activeCard.mistake_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono-num font-semibold text-[var(--accent)]">
                    {courseNameMap[activeCard.course_code] || activeCard.course_code}
                  </span>
                  <span className="rounded bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px]">
                    {typeLabel(activeCard.question.type)}
                  </span>
                  <span className="font-mono-num text-[11px] text-[var(--ink-muted)]">
                    累计错 {activeCard.wrong_count} 次 · 复习 {activeCard.review_count} 次
                  </span>
                </div>

                <div className="text-[15px] leading-relaxed">
                  <RichMath text={activeCard.question.stem.md} />
                </div>

                {!revealAnswer ? (
                  <button
                    type="button"
                    onClick={() => setRevealAnswer(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-2 text-xs font-medium text-[var(--accent)] cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" /> 查看答案、解析与上次反思
                  </button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4 border-t border-[var(--border-hairline)] pt-4"
                  >
                    {activeCard.question.answer?.md && (
                      <div className="text-sm">
                        <strong className="text-[var(--amber)]">【参考答案】</strong>
                        <RichMath text={activeCard.question.answer.md} className="mt-1" />
                      </div>
                    )}
                    {resolveSolutionText(activeCard.question) && (
                      <div className="text-sm">
                        <strong className="text-[var(--accent)]">【解析】</strong>
                        <RichMath text={resolveSolutionText(activeCard.question)} className="mt-1" />
                      </div>
                    )}
                    {activeCard.reflection_md && (
                      <div className="rounded-lg bg-[var(--comment-red-soft)] px-3 py-2 text-xs text-[var(--comment-red)]">
                        <strong>我的错因反思：</strong> {activeCard.reflection_md}
                      </div>
                    )}

                    <div>
                      <div className="text-xs text-[var(--ink-muted)] mb-2">评估本次回忆质量（SM-2 自动计算下次间隔）：</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {RATINGS.map(r => {
                          const preview = scheduleSm2Review(activeCard, r.id)
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={async () => {
                                await reviewMistake(activeCard, r.id)
                                setRevealAnswer(false)
                              }}
                              className={`rounded-xl border px-3 py-2 text-center transition-transform hover:scale-[1.02] cursor-pointer ${r.tone}`}
                            >
                              <div className="text-xs font-semibold">{r.label}</div>
                              <div className="font-mono-num text-[10.5px] opacity-80 mt-0.5">
                                {preview.interval_days} 天后
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Filter Bar & Mistake List */}
      {mistakes.length === 0 ? (
        <div className="paper-card rounded-2xl p-10 text-center space-y-4">
          <div className="mx-auto w-52 overflow-hidden rounded-xl border border-[var(--border-hairline)] p-1.5 bg-[var(--bg-canvas)]">
            <img src="./images/study-vignette.svg" alt="静谧笔记本" className="aspect-[4/3] w-full rounded-lg object-cover" />
          </div>
          <h3 className="font-editorial text-xl font-medium">暂无错题</h3>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-xl bg-[var(--bg-subtle)] p-1 text-xs">
              {(['all', 'unmastered', 'reviewing', 'mastered'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-3 py-1 cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[var(--bg-paper)] text-[var(--ink-primary)] font-medium shadow-xs'
                      : 'text-[var(--ink-secondary)]'
                  }`}
                >
                  {st === 'all' ? '全部' : STATUS_LABEL[st]}
                </button>
              ))}
            </div>

            <select
              value={courseFilter}
              onChange={e => setCourseFilter(e.target.value)}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-3 py-1.5 text-xs"
            >
              <option value="">全部课程</option>
              {courseOptions.map(c => (
                <option key={c} value={c}>
                  {c} · {courseNameMap[c] || c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {filtered.map(m => {
              const isDue = m.status !== 'mastered' && Date.parse(m.next_review_at) <= now
              const editing = editingId === m.mistake_id

              return (
                <article key={m.mistake_id} className="paper-card rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono-num font-semibold text-[var(--accent)]">
                        {courseNameMap[m.course_code] || m.course_code}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          m.status === 'mastered'
                            ? 'bg-[var(--mastered-soft)] text-[var(--mastered)]'
                            : isDue
                              ? 'bg-[var(--amber-soft)] text-[var(--amber)]'
                              : 'bg-[var(--bg-subtle)] text-[var(--ink-secondary)]'
                        }`}
                      >
                        {isDue ? '今日待复习' : STATUS_LABEL[m.status]}
                      </span>
                      <span className="font-mono-num text-[11px] text-[var(--ink-muted)]">
                        错 {m.wrong_count} 次 · 间隔 {m.interval_days} 天
                      </span>
                      {m.error_tags.map(t => (
                        <span key={t} className="rounded bg-[var(--comment-red-soft)] px-2 py-0.5 text-[11px] text-[var(--comment-red)]">
                          {t}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void reviewMistake(m, 'good')}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1 text-[11px] text-[var(--mastered)] hover:border-[var(--mastered)] cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" /> 打卡掌握
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (editing) {
                            setEditingId(null)
                          } else {
                            setEditingId(m.mistake_id)
                            setNoteDraft(m.reflection_md)
                          }
                        }}
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1 text-[11px] text-[var(--ink-secondary)] cursor-pointer"
                      >
                        {editing ? '取消' : '写反思'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteMistakeById(m.mistake_id)}
                        className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:text-[var(--comment-red)] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-sm leading-relaxed">
                    <RichMath text={m.question.stem.md} />
                  </div>

                  {m.reflection_md && !editing && (
                    <div className="rounded-xl bg-[var(--comment-red-soft)] px-3 py-2 text-xs text-[var(--comment-red)]">
                      <strong>复盘笔记：</strong> {m.reflection_md}
                    </div>
                  )}

                  {editing && (
                    <div className="flex gap-2">
                      <input
                        value={noteDraft}
                        onChange={e => setNoteDraft(e.target.value)}
                        placeholder="输入错因与关键反思，导出巩固卷时自动作为红字点评..."
                        className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await editMistakeNotes(m, { reflection_md: noteDraft })
                          setEditingId(null)
                        }}
                        className="rounded-xl bg-[var(--accent)] px-3.5 py-1.5 text-xs font-medium text-white cursor-pointer"
                      >
                        保存
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
