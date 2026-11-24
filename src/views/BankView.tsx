import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  Filter,
  Flag,
  Presentation,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react'
import { useStudy } from '../context/StudyContext'
import { RichMath, QuestionFigures } from '../components/RichMath'
import { TaxonomyTreeSelect } from '../components/TaxonomyTreeSelect'
import {
  assemblePaperFromSelection,
  expandTaxonomySelection,
  originLabel,
  typeLabel,
} from '../engine/paperAssembler'
import { resolveSolutionText } from '../engine/examRenderer'
import type { AnswerOrigin, QuestionRecord, QuestionType } from '../types/study'

const TYPES: QuestionType[] = ['single', 'multi', 'blank', 'solve', 'proof']
const ORIGINS: AnswerOrigin[] = ['official', 'community', 'ai']
const PAGE_SIZE = 20

export function BankView({
  onOpenFeedback,
}: {
  onOpenFeedback: (target: { source_id: string; question: QuestionRecord }) => void
}) {
  const {
    questions,
    taxonomies,
    sources,
    sourceMap,
    courseNameMap,
    cartKeys,
    toggleCartKey,
    clearCart,
    persistPaper,
    markMistake,
    setActiveTab,
    bankCourseFilter,
    setBankCourseFilter,
    showToast,
  } = useStudy()

  const [query, setQuery] = useState('')
  const [selectedKps, setSelectedKps] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([])
  const [selectedOrigins, setSelectedOrigins] = useState<AnswerOrigin[]>([])
  const [diffMin, setDiffMin] = useState(1)
  const [diffMax, setDiffMax] = useState(5)
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({})
  const [page, setPage] = useState(1)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const installedCourses = useMemo(() => {
    const map = new Map<string, { code: string; name: string; count: number }>()
    for (const q of questions) {
      const cur = map.get(q.course_code)
      if (cur) cur.count++
      else map.set(q.course_code, { code: q.course_code, name: courseNameMap[q.course_code] || q.course_code, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code))
  }, [questions, courseNameMap])

  const filtered = useMemo(() => {
    const tokens = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
    const kpSet = expandTaxonomySelection(taxonomies, bankCourseFilter, selectedKps)
    const yf = yearFrom ? Number(yearFrom) : null
    const yt = yearTo ? Number(yearTo) : null

    return questions.filter(q => {
      if (q.quality?.quarantined) return false
      if (bankCourseFilter.length && !bankCourseFilter.includes(q.course_code)) return false
      if (selectedTypes.length && !selectedTypes.includes(q.type)) return false
      if (selectedOrigins.length && !selectedOrigins.includes(q.answer?.origin)) return false
      const d = q.tags?.difficulty ?? 3
      if (d < diffMin || d > diffMax) return false
      if (yf && (!q.source?.year || q.source.year < yf)) return false
      if (yt && (!q.source?.year || q.source.year > yt)) return false
      if (kpSet.size > 0 && !(q.tags?.kp_ids ?? []).some(id => kpSet.has(id))) return false
      if (tokens.length && !tokens.every(t => q.search_text.includes(t))) return false
      return true
    })
  }, [questions, taxonomies, bankCourseFilter, selectedKps, selectedTypes, selectedOrigins, diffMin, diffMax, yearFrom, yearTo, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const toggleCourse = (code: string) => {
    setPage(1)
    setBankCourseFilter(
      bankCourseFilter.includes(code)
        ? bankCourseFilter.filter(c => c !== code)
        : [...bankCourseFilter, code],
    )
  }

  const handleAssembleCart = async (goTo: 'paper' | 'ppt') => {
    const keySet = new Set(cartKeys)
    const picked = questions.filter(q => keySet.has(q.key))
    if (!picked.length) return
    const paper = assemblePaperFromSelection(picked, courseNameMap)
    await persistPaper(paper, true)
    clearCart()
    showToast(`已将 ${picked.length} 道自选题组装为「${paper.title}」`, 'success')
    setActiveTab(goTo)
  }

  const filterPanel = (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[var(--ink-primary)]">已同步课程</span>
          {bankCourseFilter.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setBankCourseFilter([])
                setPage(1)
              }}
              className="text-[11px] text-[var(--accent)] hover:underline cursor-pointer"
            >
              全部
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {installedCourses.map(c => {
            const on = bankCourseFilter.includes(c.code)
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => toggleCourse(c.code)}
                className={`rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                  on
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-paper)] text-[var(--ink-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                {c.name} <span className="font-mono-num opacity-70">{c.count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-[var(--ink-primary)] mb-2">层级知识点树</div>
        <TaxonomyTreeSelect
          taxonomies={taxonomies}
          questions={questions}
          courseCodes={bankCourseFilter}
          selectedIds={selectedKps}
          onChange={ids => {
            setSelectedKps(ids)
            setPage(1)
          }}
        />
      </div>

      <div>
        <div className="text-xs font-semibold text-[var(--ink-primary)] mb-2">题型</div>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map(t => {
            const on = selectedTypes.includes(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setSelectedTypes(prev => (on ? prev.filter(x => x !== t) : [...prev, t]))
                  setPage(1)
                }}
                className={`rounded-full border px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                  on
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-paper)] text-[var(--ink-secondary)]'
                }`}
              >
                {typeLabel(t)}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-[var(--ink-primary)] mb-2">答案来源</div>
        <div className="flex flex-wrap gap-1.5">
          {ORIGINS.map(o => {
            const on = selectedOrigins.includes(o)
            return (
              <button
                key={o}
                type="button"
                onClick={() => {
                  setSelectedOrigins(prev => (on ? prev.filter(x => x !== o) : [...prev, o]))
                  setPage(1)
                }}
                className={`rounded-full border px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                  on
                    ? 'border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)] font-medium'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-paper)] text-[var(--ink-secondary)]'
                }`}
              >
                {originLabel(o)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[11px] text-[var(--ink-muted)] mb-1">难度下限 ({diffMin})</label>
          <input
            type="range"
            min={1}
            max={5}
            value={diffMin}
            onChange={e => {
              const v = Number(e.target.value)
              setDiffMin(v)
              if (v > diffMax) setDiffMax(v)
              setPage(1)
            }}
            className="w-full accent-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-[11px] text-[var(--ink-muted)] mb-1">难度上限 ({diffMax})</label>
          <input
            type="range"
            min={1}
            max={5}
            value={diffMax}
            onChange={e => {
              const v = Number(e.target.value)
              setDiffMax(v)
              if (v < diffMin) setDiffMin(v)
              setPage(1)
            }}
            className="w-full accent-[var(--accent)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={yearFrom}
          onChange={e => {
            setYearFrom(e.target.value)
            setPage(1)
          }}
          placeholder="起始年份 (如2018)"
          className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-2.5 py-1.5 text-xs font-mono-num"
        />
        <input
          type="number"
          value={yearTo}
          onChange={e => {
            setYearTo(e.target.value)
            setPage(1)
          }}
          placeholder="截止年份 (如2026)"
          className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-2.5 py-1.5 text-xs font-mono-num"
        />
      </div>
    </div>
  )

  if (!questions.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-5 pb-28">
        <div className="mx-auto w-56 overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-paper)] p-2 shadow-sm">
          <img src="./images/study-vignette.svg" alt="静谧书桌" className="aspect-[4/3] w-full rounded-xl object-cover" />
        </div>
        <h2 className="font-editorial text-2xl font-medium">尚未同步课程</h2>
        <button
          type="button"
          onClick={() => setActiveTab('sources')}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--ink-primary)] px-5 py-2 text-xs font-medium text-[var(--bg-paper)] cursor-pointer"
        >
          <Database className="h-3.5 w-3.5" /> 同步课程 ({sources.find(s => s.source_id === 'ustc-official')?.manifest?.courses.length ?? 18})
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1360px] px-4 sm:px-6 py-6 pb-32 md:pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Desktop Sticky Left Filter Atelier */}
        <aside className="hidden lg:block lg:col-span-3 sticky top-20 paper-card rounded-2xl p-4 max-h-[calc(100vh-104px)] overflow-y-auto">
          {filterPanel}
        </aside>

        {/* Main Question Stream */}
        <main className="lg:col-span-9 space-y-4">
          {/* Search & Mobile Filter Trigger */}
          <div className="paper-card rounded-2xl p-3 flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-muted)]" />
              <input
                value={query}
                onChange={e => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder="全文检索题干、公式关键词、年份出处（空格分隔多词）..."
                className="w-full rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] pl-9 pr-3 py-2 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs font-medium text-[var(--ink-primary)] cursor-pointer"
            >
              <Filter className="h-3.5 w-3.5 text-[var(--accent)]" />
              筛选
            </button>

            <div className="text-xs font-mono-num text-[var(--ink-muted)] px-1">
              匹配 <strong className="text-[var(--ink-primary)]">{filtered.length}</strong> 题
            </div>
          </div>

          {/* Question Cards */}
          <div className="space-y-3.5">
            {pageItems.map(q => {
              const inCart = cartKeys.includes(q.key)
              const open = Boolean(expandedKeys[q.key])
              const solText = resolveSolutionText(q)

              return (
                <motion.article
                  key={q.key}
                  layout="position"
                  className={`paper-card rounded-2xl p-4 sm:p-5 transition-colors ${
                    inCart ? 'border-[var(--accent)] ring-1 ring-[var(--accent-border)]' : ''
                  }`}
                >
                  {/* Meta Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[var(--border-hairline)] text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono-num font-semibold text-[var(--accent)]">
                        {courseNameMap[q.course_code] || q.course_code}
                      </span>
                      <span className="rounded-md bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--ink-secondary)]">
                        {typeLabel(q.type)}
                      </span>
                      <span className="rounded-md bg-[var(--amber-soft)] px-2 py-0.5 text-[11px] text-[var(--amber)]">
                        {originLabel(q.answer?.origin)}
                      </span>
                      <span className="font-mono-num text-[11px] text-[var(--ink-muted)]">
                        难度 {'★'.repeat(q.tags?.difficulty ?? 3)}
                      </span>
                      {q.source?.ref && (
                        <span className="text-[11px] text-[var(--ink-muted)] truncate max-w-[260px]">
                          · {q.source.ref}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleCartKey(q.key)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition-colors cursor-pointer ${
                          inCart
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--ink-primary)] hover:border-[var(--accent)]'
                        }`}
                      >
                        {inCart ? <Check className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
                        {inCart ? '已选入篮' : '加入组卷篮'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void markMistake({ source_id: q.source_id, question: q })}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1 text-[11.5px] text-[var(--ink-secondary)] hover:text-[var(--amber)] hover:border-[var(--amber)]/40 cursor-pointer"
                        title="加入 SM-2 错题本"
                      >
                        <BookmarkPlus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">记错题</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenFeedback({ source_id: q.source_id, question: q })}
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-1.5 text-[var(--ink-muted)] hover:text-[var(--comment-red)] cursor-pointer"
                        title="纠错反馈"
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Stem & Options */}
                  <div className="text-[14.5px] leading-relaxed text-[var(--ink-primary)]">
                    <RichMath text={q.stem.md} />
                    <QuestionFigures
                      figures={q.stem.figures}
                      source={sourceMap[q.source_id]}
                      sourceId={q.source_id}
                      courseCode={q.course_code}
                    />
                    {q.options?.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                        {q.options.map(opt => (
                          <div key={opt.key} className="flex gap-1.5 text-sm">
                            <span className="font-mono-num font-semibold text-[var(--accent)]">{opt.key}.</span>
                            <RichMath text={opt.md} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Toggle Answer / Solution */}
                  <div className="mt-3.5 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {(q.tags?.keywords ?? []).slice(0, 4).map(kw => (
                        <span
                          key={kw}
                          className="rounded bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedKeys(prev => ({ ...prev, [q.key]: !open }))}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      {open ? '收起答案与解析' : '展开答案与解析'}
                      {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.24 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 space-y-3 text-sm">
                          {q.answer?.md && (
                            <div>
                              <span className="font-semibold text-[var(--amber)] mr-2">【参考答案】</span>
                              <RichMath text={q.answer.md} className="inline-block" />
                            </div>
                          )}
                          {solText && (
                            <div className="border-t border-[var(--border-hairline)] pt-2.5">
                              <div className="font-semibold text-[var(--accent)] mb-1">
                                {q.type === 'proof' ? '【证明过程】' : '【详细解析】'}
                              </div>
                              <RichMath text={solText} />
                              <QuestionFigures
                                figures={q.solution?.figures}
                                source={sourceMap[q.source_id]}
                                sourceId={q.source_id}
                                courseCode={q.course_code}
                              />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.article>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-3">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => {
                  setPage(p => Math.max(1, p - 1))
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-3 py-1.5 text-xs disabled:opacity-40 cursor-pointer"
              >
                上一页
              </button>
              <span className="font-mono-num text-xs text-[var(--ink-secondary)] px-2">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => {
                  setPage(p => Math.min(totalPages, p + 1))
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-3 py-1.5 text-xs disabled:opacity-40 cursor-pointer"
              >
                下一页
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Filter Drawer */}
      <AnimatePresence>
        {mobileFilterOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs lg:hidden flex justify-end"
            onClick={() => setMobileFilterOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              onClick={e => e.stopPropagation()}
              className="h-full w-[86vw] max-w-sm bg-[var(--bg-canvas)] border-l border-[var(--border-hairline)] p-4 overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--border-hairline)]">
                <span className="font-editorial text-base font-semibold">题库精细筛选</span>
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="rounded-lg p-1 text-[var(--ink-muted)] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {filterPanel}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Cart Assembly Bar */}
      <AnimatePresence>
        {cartKeys.length > 0 && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-40 glass-dock rounded-full px-4 py-2 flex items-center gap-3 max-w-[94vw]"
          >
            <span className="text-xs font-medium whitespace-nowrap">
              自选篮 <strong className="font-mono-num text-[var(--accent)]">{cartKeys.length}</strong> 题
            </span>
            <button
              type="button"
              onClick={() => void handleAssembleCart('paper')}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--ink-primary)] px-3.5 py-1.5 text-xs font-medium text-[var(--bg-paper)] whitespace-nowrap cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" /> 组装试卷
            </button>
            <button
              type="button"
              onClick={() => void handleAssembleCart('ppt')}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-medium text-white whitespace-nowrap cursor-pointer"
            >
              <Presentation className="h-3.5 w-3.5" /> 直出 PPT
            </button>
            <button
              type="button"
              onClick={clearCart}
              className="rounded-full p-1 text-[var(--ink-muted)] hover:text-[var(--ink-primary)] cursor-pointer"
              title="清空自选篮"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
