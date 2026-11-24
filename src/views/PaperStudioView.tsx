import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowUp,
  Code2,
  Database,
  Download,
  ExternalLink,
  FileText,
  Maximize2,
  Minimize2,
  Plus,
  Presentation,
  Printer,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { useStudy } from '../context/StudyContext'
import { TaxonomyTreeSelect } from '../components/TaxonomyTreeSelect'
import { RichMath, QuestionFigures } from '../components/RichMath'
import { UstcBindingLine } from '../components/UstcBindingLine'
import {
  assemblePaperFromPool,
  chineseNumber,
  originLabel,
  typeLabel,
} from '../engine/paperAssembler'
import {
  buildCommentText,
  buildExamLatex,
  buildPdfFields,
  buildStandaloneExamHtml,
  extractChoiceKey,
  formatDisplayTerm,
  formatSectionScore,
  groupItems,
  openInOverleaf,
  printExamViaIframe,
  resolveSolutionText,
  shouldShowAnswerLine,
} from '../engine/examRenderer'
import type {
  AnswerOrigin,
  AssembleGap,
  AssembleSectionConfig,
  PaperHeaderMeta,
  PaperMode,
  PdfExportMode,
  PdfTemplateId,
  QuestionType,
  WriteSpaceSize,
} from '../types/study'

const ALL_TYPES: QuestionType[] = ['single', 'multi', 'blank', 'solve', 'proof']
const ALL_ORIGINS: AnswerOrigin[] = ['official', 'community', 'ai']

type RailTab = 'assemble' | 'edit' | 'history'

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function PaperStudioView() {
  const {
    questions,
    taxonomies,
    papers,
    activePaper,
    setActivePaperId,
    persistPaper,
    removePaper,
    sourceMap,
    courseNameMap,
    setActiveTab,
    showToast,
  } = useStudy()

  const [railTab, setRailTab] = useState<RailTab>('assemble')
  const [focusMode, setFocusMode] = useState(false)

  // Assemble controls
  const [mode, setMode] = useState<PaperMode>('exam')
  const [paperTitle, setPaperTitle] = useState('')
  const [courseCodes, setCourseCodes] = useState<string[]>([])
  const [kpIds, setKpIds] = useState<string[]>([])
  const [types, setTypes] = useState<QuestionType[]>([])
  const [origins, setOrigins] = useState<AnswerOrigin[]>([])
  const [count, setCount] = useState(8)
  const [scorePer, setScorePer] = useState(10)
  const [diffMin, setDiffMin] = useState(1)
  const [diffMax, setDiffMax] = useState(5)
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [seedText, setSeedText] = useState('')
  const [useSections, setUseSections] = useState(false)
  const [sections, setSections] = useState<AssembleSectionConfig[]>([
    { id: 's1', title: '单项选择题', count: 3, score: 5, types: ['single'] },
    { id: 's2', title: '填空题', count: 3, score: 5, types: ['blank'] },
    { id: 's3', title: '计算与证明题', count: 4, score: 15, types: ['solve', 'proof'] },
  ])
  const [lastGaps, setLastGaps] = useState<AssembleGap[]>([])

  // Export & Preview settings
  const [templateId, setTemplateId] = useState<PdfTemplateId>('ustc-exam')
  const [exportMode, setExportMode] = useState<PdfExportMode>('inline-solution')
  const [splitTab, setSplitTab] = useState<'paper' | 'answers'>('paper')
  const [headerOverride, setHeaderOverride] = useState<Partial<PaperHeaderMeta>>({})

  const installedCourses = useMemo(() => {
    const map = new Map<string, number>()
    for (const q of questions) map.set(q.course_code, (map.get(q.course_code) ?? 0) + 1)
    return Array.from(map.entries())
      .map(([code, total]) => ({ code, name: courseNameMap[code] || code, total }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [questions, courseNameMap])

  const effectiveFields = useMemo(
    () => (activePaper ? buildPdfFields(activePaper, headerOverride) : null),
    [activePaper, headerOverride],
  )

  const handleAssemble = async () => {
    const targetCourses = courseCodes.length ? courseCodes : installedCourses.slice(0, 1).map(c => c.code)
    if (!targetCourses.length) {
      showToast('请先同步至少一门课程', 'error')
      return
    }
    const { paper, gaps } = assemblePaperFromPool(questions, taxonomies, {
      title: paperTitle,
      mode,
      count,
      scorePerQuestion: scorePer,
      seed: seedText.trim() || Date.now(),
      filters: {
        courseCodes: targetCourses,
        kpIds,
        types,
        answerOrigins: origins,
        difficultyMin: diffMin,
        difficultyMax: diffMax,
        yearFrom: yearFrom ? Number(yearFrom) : null,
        yearTo: yearTo ? Number(yearTo) : null,
      },
      sections: useSections ? sections : undefined,
      courseNameMap,
    })

    setLastGaps(gaps)
    if (!paper.items.length) {
      showToast('当前筛选条件下没有匹配题目，请放宽条件重试', 'error')
      return
    }
    await persistPaper(paper, true)
    setHeaderOverride({})
    showToast(`已生成「${paper.title}」（共 ${paper.items.length} 题）`, 'success')
  }

  const updateActivePaperItems = async (updater: (items: typeof activePaper extends null ? never : NonNullable<typeof activePaper>['items']) => NonNullable<typeof activePaper>['items']) => {
    if (!activePaper) return
    const nextItems = updater([...activePaper.items]).map((it, idx) => ({ ...it, seq: idx + 1 }))
    await persistPaper({ ...activePaper, items: nextItems }, true)
  }

  const handleMoveItem = async (idx: number, delta: number) => {
    if (!activePaper) return
    const target = idx + delta
    if (target < 0 || target >= activePaper.items.length) return
    await updateActivePaperItems(list => {
      const copy = [...list]
      ;[copy[idx], copy[target]] = [copy[target], copy[idx]]
      return copy
    })
  }

  const handleExportHtml = () => {
    if (!activePaper || !effectiveFields) return
    const html = buildStandaloneExamHtml(activePaper, templateId, exportMode, effectiveFields, sourceMap)
    const safe = activePaper.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 50)
    downloadBlob(html, `${safe}.html`, 'text/html;charset=utf-8')
    showToast('已下载独立离线可打印 HTML 试卷', 'success')
  }

  const handleExportTex = () => {
    if (!activePaper || !effectiveFields) return
    const tex = buildExamLatex(activePaper, templateId, exportMode, effectiveFields)
    const safe = activePaper.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 50)
    downloadBlob(tex, `${safe}.tex`, 'application/x-tex;charset=utf-8')
    showToast(`已导出 XeLaTeX 源码（${templateId} 模板）`, 'success')
  }

  const handleOpenOverleaf = () => {
    if (!activePaper || !effectiveFields) return
    const tex = buildExamLatex(activePaper, templateId, exportMode, effectiveFields)
    openInOverleaf(tex, activePaper.title)
    showToast('已打开 Overleaf（XeLaTeX）', 'info')
  }

  const handlePrintPdf = () => {
    if (!activePaper || !effectiveFields) return
    const html = buildStandaloneExamHtml(activePaper, templateId, exportMode, effectiveFields, sourceMap)
    printExamViaIframe(html)
  }

  if (!questions.length && !papers.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-5 pb-28">
        <div className="mx-auto w-56 overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-paper)] p-2 shadow-sm">
          <img src="./images/study-vignette.svg" alt="等待同步题库" className="aspect-[4/3] w-full rounded-xl object-cover" />
        </div>
        <h2 className="font-editorial text-2xl font-medium">尚未同步课程</h2>
        <button
          type="button"
          onClick={() => setActiveTab('sources')}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--ink-primary)] px-5 py-2 text-xs font-medium text-[var(--bg-paper)] cursor-pointer"
        >
          <Database className="h-3.5 w-3.5" /> 同步课程
        </button>
      </div>
    )
  }

  const showSolutions = exportMode === 'inline-solution' || splitTab === 'answers'
  const answerOnly = exportMode === 'split' && splitTab === 'answers'
  const groups = activePaper ? groupItems(activePaper.items) : []
  const totalScore = activePaper ? activePaper.items.reduce((s, it) => s + Number(it.score || 0), 0) : 0

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 py-5 pb-28 md:pb-14">
      <div className={`grid grid-cols-1 ${focusMode ? '' : 'xl:grid-cols-12'} gap-6 items-start`}>
        {/* Left Collapsible Atelier Control Rail */}
        {!focusMode && (
          <aside className="no-print xl:col-span-4 paper-card rounded-2xl overflow-hidden xl:sticky xl:top-20 xl:max-h-[calc(100vh-100px)] flex flex-col">
            {/* Rail Mode Switcher */}
            <div className="grid grid-cols-3 border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 p-1.5 gap-1">
              {(
                [
                  ['assemble', '条件组卷'],
                  ['edit', `调序与点评 (${activePaper?.items.length ?? 0})`],
                  ['history', `历史试卷 (${papers.length})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRailTab(id)}
                  className={`rounded-xl py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    railTab === id
                      ? 'bg-[var(--bg-paper)] text-[var(--ink-primary)] shadow-xs border border-[var(--border-hairline)]'
                      : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {railTab === 'assemble' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('exam')}
                      className={`rounded-xl border py-2 text-xs font-medium cursor-pointer ${
                        mode === 'exam'
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'border-[var(--border-hairline)] text-[var(--ink-secondary)]'
                      }`}
                    >
                      模拟考试卷
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('topic')}
                      className={`rounded-xl border py-2 text-xs font-medium cursor-pointer ${
                        mode === 'topic'
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'border-[var(--border-hairline)] text-[var(--ink-secondary)]'
                      }`}
                    >
                      专题练习卷
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[var(--ink-muted)] mb-1">自定义卷名（留空自动命名）</label>
                    <input
                      value={paperTitle}
                      onChange={e => setPaperTitle(e.target.value)}
                      placeholder="如：数学分析(B1) 期中模拟卷"
                      className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <div className="text-[11px] font-medium text-[var(--ink-muted)] mb-1.5">选择课程（可多选，默认首门已同步课）</div>
                    <div className="flex flex-wrap gap-1.5">
                      {installedCourses.map(c => {
                        const on = courseCodes.includes(c.code)
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() =>
                              setCourseCodes(prev => (on ? prev.filter(x => x !== c.code) : [...prev, c.code]))
                            }
                            className={`rounded-lg border px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                              on
                                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                                : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--ink-secondary)]'
                            }`}
                          >
                            {c.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-medium text-[var(--ink-muted)] mb-1.5">按知识点树精确圈定</div>
                    <TaxonomyTreeSelect
                      taxonomies={taxonomies}
                      questions={questions}
                      courseCodes={courseCodes}
                      selectedIds={kpIds}
                      onChange={setKpIds}
                    />
                  </div>

                  {/* Quick Count vs Custom Sections Blueprint */}
                  <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">大题结构</span>
                      <button
                        type="button"
                        onClick={() => setUseSections(v => !v)}
                        className="text-[11px] text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        {useSections ? '切换为快捷总题量' : '自定义大题蓝图'}
                      </button>
                    </div>

                    {!useSections ? (
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-[var(--ink-muted)] mb-1">抽题数量</label>
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={count}
                            onChange={e => setCount(Math.max(1, Number(e.target.value) || 1))}
                            className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-2.5 py-1.5 text-xs font-mono-num"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[var(--ink-muted)] mb-1">默认单题分值</label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={scorePer}
                            onChange={e => setScorePer(Math.max(1, Number(e.target.value) || 10))}
                            className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-2.5 py-1.5 text-xs font-mono-num"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sections.map((sec, idx) => (
                          <div key={sec.id} className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] p-2 space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                value={sec.title}
                                onChange={e =>
                                  setSections(prev =>
                                    prev.map((s, i) => (i === idx ? { ...s, title: e.target.value } : s)),
                                  )
                                }
                                className="flex-1 rounded border border-[var(--border-hairline)] px-2 py-1 text-xs"
                              />
                              <input
                                type="number"
                                min={1}
                                max={30}
                                value={sec.count}
                                onChange={e =>
                                  setSections(prev =>
                                    prev.map((s, i) => (i === idx ? { ...s, count: Number(e.target.value) || 1 } : s)),
                                  )
                                }
                                className="w-12 rounded border border-[var(--border-hairline)] px-1.5 py-1 text-xs font-mono-num"
                                title="题数"
                              />
                              <span className="text-[10px] text-[var(--ink-muted)]">题×</span>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={sec.score}
                                onChange={e =>
                                  setSections(prev =>
                                    prev.map((s, i) => (i === idx ? { ...s, score: Number(e.target.value) || 5 } : s)),
                                  )
                                }
                                className="w-12 rounded border border-[var(--border-hairline)] px-1.5 py-1 text-xs font-mono-num"
                                title="单题分"
                              />
                              <button
                                type="button"
                                onClick={() => setSections(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1 text-[var(--ink-muted)] hover:text-[var(--comment-red)] cursor-pointer"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setSections(prev => [
                              ...prev,
                              { id: `s-${Date.now()}`, title: '解答题', count: 2, score: 15, types: ['solve'] },
                            ])
                          }
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline cursor-pointer"
                        >
                          <Plus className="h-3 w-3" /> 添加大题区块
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Type & Origin Pills */}
                  {!useSections && (
                    <div>
                      <div className="text-[11px] text-[var(--ink-muted)] mb-1.5">限定题型（留空不限）</div>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_TYPES.map(t => {
                          const on = types.includes(t)
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTypes(prev => (on ? prev.filter(x => x !== t) : [...prev, t]))}
                              className={`rounded-full border px-2.5 py-0.5 text-[11.5px] cursor-pointer ${
                                on
                                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                                  : 'border-[var(--border-hairline)] text-[var(--ink-secondary)]'
                              }`}
                            >
                              {typeLabel(t)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-[11px] text-[var(--ink-muted)] mb-1.5">限定答案来源</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_ORIGINS.map(o => {
                        const on = origins.includes(o)
                        return (
                          <button
                            key={o}
                            type="button"
                            onClick={() => setOrigins(prev => (on ? prev.filter(x => x !== o) : [...prev, o]))}
                            className={`rounded-full border px-2.5 py-0.5 text-[11.5px] cursor-pointer ${
                              on
                                ? 'border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]'
                                : 'border-[var(--border-hairline)] text-[var(--ink-secondary)]'
                            }`}
                          >
                            {originLabel(o)}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      value={yearFrom}
                      onChange={e => setYearFrom(e.target.value)}
                      placeholder="起始年份"
                      className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5 text-xs font-mono-num"
                    />
                    <input
                      type="number"
                      value={yearTo}
                      onChange={e => setYearTo(e.target.value)}
                      placeholder="截止年份"
                      className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5 text-xs font-mono-num"
                    />
                    <input
                      value={seedText}
                      onChange={e => setSeedText(e.target.value)}
                      placeholder="随机种子(选)"
                      className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5 text-xs font-mono-num"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--ink-muted)]">
                    <label>
                      难度下限 {diffMin}
                      <input
                        type="range"
                        min={1}
                        max={5}
                        value={diffMin}
                        onChange={e => setDiffMin(Number(e.target.value))}
                        className="w-full accent-[var(--accent)]"
                      />
                    </label>
                    <label>
                      难度上限 {diffMax}
                      <input
                        type="range"
                        min={1}
                        max={5}
                        value={diffMax}
                        onChange={e => setDiffMax(Number(e.target.value))}
                        className="w-full accent-[var(--accent)]"
                      />
                    </label>
                  </div>

                  {lastGaps.length > 0 && (
                    <div className="rounded-xl border border-[var(--amber)]/35 bg-[var(--amber-soft)] p-3 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-medium text-[var(--amber)]">
                        <AlertTriangle className="h-3.5 w-3.5" /> 部分区块候选不足
                      </div>
                      {lastGaps.map((g, i) => (
                        <div key={i} className="text-[11px] text-[var(--ink-secondary)]">
                          「{g.section}」需 {g.requested} 题，匹配 {g.available} 题
                          {g.suggestions.length > 0 && `（建议：${g.suggestions.join('、')}）`}
                        </div>
                      ))}
                    </div>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.985 }}
                    type="button"
                    onClick={() => void handleAssemble()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--ink-primary)] py-2.5 text-sm font-medium text-[var(--bg-paper)] shadow-sm hover:opacity-92 cursor-pointer"
                  >
                    <Shuffle className="h-4 w-4" />
                    一键智能组卷并排版
                  </motion.button>
                </>
              )}

              {railTab === 'edit' && (
                activePaper ? (
                  <div className="space-y-4">
                    {/* Header Metadata Editor */}
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--accent)]" /> 卷头与排版参数
                      </div>
                      <input
                        value={effectiveFields?.courseTitle ?? ''}
                        onChange={e => setHeaderOverride(prev => ({ ...prev, courseTitle: e.target.value }))}
                        placeholder="试卷主标题"
                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-2.5 py-1.5 text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={effectiveFields?.examDate ?? ''}
                          onChange={e => setHeaderOverride(prev => ({ ...prev, examDate: e.target.value }))}
                          placeholder="考试时间"
                          className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-2.5 py-1.5 text-xs font-mono-num"
                        />
                        <input
                          value={effectiveFields?.examForm ?? ''}
                          onChange={e => setHeaderOverride(prev => ({ ...prev, examForm: e.target.value }))}
                          placeholder="考试形式（闭卷）"
                          className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={effectiveFields?.showBindingLine ?? true}
                            onChange={e => setHeaderOverride(prev => ({ ...prev, showBindingLine: e.target.checked }))}
                            className="accent-[var(--accent)]"
                          />
                          <span>显示左侧密封装订线</span>
                        </label>
                        <select
                          value={effectiveFields?.writeSpace ?? 'standard'}
                          onChange={e => setHeaderOverride(prev => ({ ...prev, writeSpace: e.target.value as WriteSpaceSize }))}
                          className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-2 py-1 text-[11px]"
                        >
                          <option value="compact">留白：紧凑</option>
                          <option value="standard">留白：标准</option>
                          <option value="spacious">留白：宽敞</option>
                        </select>
                      </div>
                    </div>

                    {/* Per-question Score, Order & Red Comment Editor */}
                    <div className="space-y-2">
                      {activePaper.items.map((item, idx) => (
                        <div
                          key={`${item.source_id}-${item.question_id}-${idx}`}
                          className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2.5 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono-num text-xs font-semibold text-[var(--accent)]">
                                #{idx + 1}
                              </span>
                              <span className="text-[11px] text-[var(--ink-secondary)] truncate">
                                {typeLabel(item.question.type)} · {item.question.source?.ref || item.question.id}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                min={0}
                                max={200}
                                value={item.score}
                                onChange={e => {
                                  const val = Number(e.target.value) || 0
                                  void updateActivePaperItems(list =>
                                    list.map((x, i) => (i === idx ? { ...x, score: val } : x)),
                                  )
                                }}
                                className="w-12 rounded border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-1.5 py-0.5 text-center font-mono-num text-xs"
                                title="分值"
                              />
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => void handleMoveItem(idx, -1)}
                                className="rounded p-1 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === activePaper.items.length - 1}
                                onClick={() => void handleMoveItem(idx, 1)}
                                className="rounded p-1 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void updateActivePaperItems(list => list.filter((_, i) => i !== idx))
                                }
                                className="rounded p-1 text-[var(--ink-muted)] hover:text-[var(--comment-red)] cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <input
                            value={item.comment_md ?? ''}
                            onChange={e => {
                              const val = e.target.value
                              void updateActivePaperItems(list =>
                                list.map((x, i) => (i === idx ? { ...x, comment_md: val || null } : x)),
                              )
                            }}
                            placeholder="红字易错点评（可选，导出 PDF/PPT 时高亮展示）"
                            className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-2.5 py-1 text-[11.5px] text-[var(--comment-red)] placeholder:text-[var(--ink-muted)]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[var(--ink-muted)] py-8 text-center">请先生成或选择一份试卷</div>
                )
              )}

              {railTab === 'history' && (
                <div className="space-y-2">
                  {papers.length === 0 ? (
                    <div className="text-xs text-[var(--ink-muted)] py-8 text-center">暂无历史试卷</div>
                  ) : (
                    papers.map(p => {
                      const active = p.paper_id === activePaper?.paper_id
                      return (
                        <div
                          key={p.paper_id}
                          className={`rounded-xl border p-3 flex items-center justify-between gap-2 transition-colors ${
                            active
                              ? 'border-[var(--accent)] bg-[var(--accent-soft)]/60'
                              : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActivePaperId(p.paper_id)
                              setHeaderOverride({})
                            }}
                            className="text-left min-w-0 flex-1 cursor-pointer"
                          >
                            <div className="text-xs font-semibold text-[var(--ink-primary)] truncate">{p.title}</div>
                            <div className="font-mono-num text-[11px] text-[var(--ink-muted)] mt-0.5">
                              {p.items.length} 题 · {p.updated_at.slice(0, 10)}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => void removePaper(p.paper_id)}
                            className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:text-[var(--comment-red)] cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Right Live Exam Paper Sheet Stage */}
        <section className={focusMode ? 'max-w-[920px] mx-auto w-full' : 'xl:col-span-8 space-y-4'}>
          {/* Floating Editorial Toolbar */}
          <div className="no-print paper-card rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-[var(--bg-subtle)] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTemplateId('ustc-exam')}
                  className={`rounded-lg px-2.5 py-1 font-medium cursor-pointer ${
                    templateId === 'ustc-exam'
                      ? 'bg-[var(--bg-paper)] text-[var(--ink-primary)] shadow-xs'
                      : 'text-[var(--ink-secondary)]'
                  }`}
                >
                  中科大版式
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateId('gaokao')}
                  className={`rounded-lg px-2.5 py-1 font-medium cursor-pointer ${
                    templateId === 'gaokao'
                      ? 'bg-[var(--bg-paper)] text-[var(--ink-primary)] shadow-xs'
                      : 'text-[var(--ink-secondary)]'
                  }`}
                >
                  高考版式
                </button>
              </div>

              <div className="inline-flex rounded-xl bg-[var(--bg-subtle)] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setExportMode('inline-solution')}
                  className={`rounded-lg px-2.5 py-1 font-medium cursor-pointer ${
                    exportMode === 'inline-solution'
                      ? 'bg-[var(--bg-paper)] text-[var(--ink-primary)] shadow-xs'
                      : 'text-[var(--ink-secondary)]'
                  }`}
                >
                  题后附解析
                </button>
                <button
                  type="button"
                  onClick={() => setExportMode('split')}
                  className={`rounded-lg px-2.5 py-1 font-medium cursor-pointer ${
                    exportMode === 'split'
                      ? 'bg-[var(--bg-paper)] text-[var(--ink-primary)] shadow-xs'
                      : 'text-[var(--ink-secondary)]'
                  }`}
                >
                  原题/答案分开
                </button>
              </div>

              {exportMode === 'split' && (
                <div className="inline-flex rounded-xl border border-[var(--border-hairline)] p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setSplitTab('paper')}
                    className={`rounded-lg px-2.5 py-1 cursor-pointer ${
                      splitTab === 'paper' ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium' : 'text-[var(--ink-secondary)]'
                    }`}
                  >
                    原题卷
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitTab('answers')}
                    className={`rounded-lg px-2.5 py-1 cursor-pointer ${
                      splitTab === 'answers' ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium' : 'text-[var(--ink-secondary)]'
                    }`}
                  >
                    答案卷
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={!activePaper}
                onClick={handlePrintPdf}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--ink-primary)] px-3 py-1.5 text-xs font-medium text-[var(--bg-paper)] disabled:opacity-40 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> 打印 / PDF
              </button>
              <button
                type="button"
                disabled={!activePaper}
                onClick={handleExportHtml}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-[var(--accent)]" /> HTML
              </button>
              <button
                type="button"
                disabled={!activePaper}
                onClick={handleExportTex}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 cursor-pointer"
              >
                <Code2 className="h-3.5 w-3.5 text-[var(--amber)]" /> .tex
              </button>
              <button
                type="button"
                disabled={!activePaper}
                onClick={handleOpenOverleaf}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 cursor-pointer"
                title="使用 Overleaf XeLaTeX 编译原版模板"
              >
                <ExternalLink className="h-3.5 w-3.5 text-[var(--mastered)]" /> Overleaf
              </button>
              <button
                type="button"
                disabled={!activePaper}
                onClick={() => setActiveTab('ppt')}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--accent)] disabled:opacity-40 cursor-pointer"
              >
                <Presentation className="h-3.5 w-3.5" /> 转讲评 PPT
              </button>
              <button
                type="button"
                onClick={() => setFocusMode(v => !v)}
                className="hidden xl:inline-flex items-center justify-center rounded-xl border border-[var(--border-hairline)] p-1.5 text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] cursor-pointer"
                title={focusMode ? '退出专注阅读' : '专注阅读模式'}
              >
                {focusMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Pixel-Faithful dsh-study A4 Paper Preview Sheet */}
          {activePaper && effectiveFields ? (
            <motion.div
              key={`${activePaper.paper_id}-${templateId}-${exportMode}-${splitTab}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              className={`print-only-sheet paper-sheet exam-paper-render relative rounded-sm overflow-hidden min-h-[1040px] flex flex-col ${
                templateId === 'ustc-exam' && effectiveFields.showBindingLine && !answerOnly
                  ? 'pl-[68px] sm:pl-[104px] pr-5 sm:pr-[68px] py-10 sm:py-[72px]'
                  : 'px-6 sm:px-[68px] py-10 sm:py-[72px]'
              }`}
            >
              {/* Exact TikZ 4-Hole USTC Left Binding Line */}
              {templateId === 'ustc-exam' && effectiveFields.showBindingLine && !answerOnly && (
                <UstcBindingLine className="pointer-events-none select-none absolute left-0 top-0 h-[1060px] w-[62px] sm:w-[94px]" />
              )}

              <div className="flex-1">
                {/* Exam Header */}
                {templateId === 'gaokao' ? (
                  answerOnly ? (
                    <header className="text-center mb-6">
                      <div className="exam-heiti-bold text-[18px] sm:text-[19px] text-black">
                        {effectiveFields.courseTitle}——参考答案与解析
                      </div>
                    </header>
                  ) : (
                    <>
                      <div className="exam-heiti-bold text-[14.5px] tracking-[0.14em] text-black mb-3">
                        绝密 ★ 启用前
                      </div>
                      <header className="text-center mb-5">
                        <div className="text-[18px] sm:text-[19.5px] text-black leading-snug">
                          {effectiveFields.courseTitle}
                        </div>
                        <div className="exam-heiti-bold text-[26px] sm:text-[29px] tracking-[0.22em] text-black mt-1">
                          {effectiveFields.subject}
                        </div>
                      </header>
                      <div className="mb-6 text-[13.5px] leading-[1.7] text-black">
                        <div className="exam-heiti-bold mb-0.5">注意事项：</div>
                        <ol className="list-decimal pl-5 space-y-0.5">
                          <li>答卷前，考生务必将自己的姓名、学号或准考证号填写清楚。</li>
                          <li>客观题请在括号内填涂正确选项；非选择题应写出必要的文字说明、证明过程或演算步骤。</li>
                          <li>本试卷共 {activePaper.items.length} 题，满分 {totalScore} 分。</li>
                        </ol>
                      </div>
                    </>
                  )
                ) : (
                  <header className="text-center mb-4">
                    {effectiveFields.schoolTerm && (
                      <div className="exam-heiti-bold text-[17.5px] sm:text-[19px] leading-[1.45] text-black">
                        {formatDisplayTerm(effectiveFields.schoolTerm)}
                      </div>
                    )}
                    <div className="exam-heiti-bold text-[17.5px] sm:text-[19px] leading-[1.45] text-black mt-1">
                      {effectiveFields.courseTitle}
                      {answerOnly ? ' ——参考答案与解析' : ''}
                    </div>
                    <div className="mt-3 text-[13.5px] sm:text-[14.5px] text-black">
                      考试时间{' '}
                      <span className="inline-block min-w-[106px] border-b border-black px-3 text-center leading-[1.3]">
                        {effectiveFields.examDate}
                      </span>
                      <span className="inline-block w-8 sm:w-12" />
                      考试形式{' '}
                      <span className="inline-block min-w-[106px] border-b border-black px-3 text-center leading-[1.3]">
                        {effectiveFields.examForm}
                      </span>
                    </div>
                  </header>
                )}

                {/* USTC Score Table */}
                {templateId === 'ustc-exam' && !answerOnly && groups.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="score-table">
                      <tbody>
                        <tr>
                          <td className="exam-heiti-bold">题号</td>
                          {groups.map((_, i) => <td key={i}>{chineseNumber(i + 1)}</td>)}
                          <td className="exam-heiti-bold">总分</td>
                        </tr>
                        <tr>
                          <td className="exam-heiti-bold">满分</td>
                          {groups.map((g, i) => <td key={i}>{g.score}</td>)}
                          <td>{totalScore}</td>
                        </tr>
                        <tr>
                          <td className="exam-heiti-bold">得分</td>
                          {groups.map((_, i) => <td key={i} className="min-w-[44px]">&nbsp;</td>)}
                          <td className="min-w-[50px]">&nbsp;</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Sections & Hanging-Indent Questions */}
                <div className="space-y-5">
                  {(() => {
                    let seq = 0
                    return groups.map((group, secIdx) => (
                      <section key={`${group.key}-${secIdx}`} className="space-y-3.5">
                        {templateId === 'gaokao' ? (
                          <h2 className="exam-heiti-bold text-[15px] text-black">
                            {chineseNumber(secIdx + 1)}、{group.title}：{formatSectionScore(group)}
                          </h2>
                        ) : (
                          <h2 className="text-[14.5px] font-normal text-black">
                            <span className="exam-heiti-bold">{chineseNumber(secIdx + 1)}.</span> ({formatSectionScore(group)}) {group.title}
                          </h2>
                        )}

                        <div className="space-y-4">
                          {group.items.map(item => {
                            seq++
                            const q = item.question
                            const solText = resolveSolutionText(q)
                            const comment = buildCommentText(item, q)
                            const label = q.type === 'proof' ? '证明' : '解'
                            const writeH =
                              effectiveFields.writeSpace === 'compact'
                                ? 'h-24'
                                : effectiveFields.writeSpace === 'spacious'
                                  ? 'h-56'
                                  : 'h-40'
                            const isGkChoice =
                              templateId === 'gaokao' &&
                              !answerOnly &&
                              (q.type === 'single' || q.type === 'multi')
                            const isGkScored =
                              templateId === 'gaokao' &&
                              !answerOnly &&
                              (q.type === 'solve' || q.type === 'proof')

                            return (
                              <article
                                key={`${item.source_id}-${item.question_id}-${seq}`}
                                className="exam-q-item grid grid-cols-[2.35em_minmax(0,1fr)] items-baseline text-[14.5px] text-black"
                              >
                                <div className="select-none font-normal">
                                  {templateId === 'gaokao' ? `${seq}.` : `(${seq})`}
                                </div>

                                <div className="min-w-0">
                                  {!answerOnly && (
                                    <>
                                      <div>
                                        {isGkScored && <span className="mr-1">({item.score}分)</span>}
                                        <RichMath text={q.stem.md} displayMathInline inlineFirstParagraph />
                                        {isGkChoice && (
                                          <span className="float-right ml-3">
                                            (&nbsp;{showSolutions ? extractChoiceKey(q.answer.md) : '\u00A0\u00A0\u00A0\u00A0'}&nbsp;)
                                          </span>
                                        )}
                                      </div>
                                      <QuestionFigures
                                        figures={q.stem.figures}
                                        source={sourceMap[item.source_id]}
                                        sourceId={item.source_id}
                                        courseCode={q.course_code}
                                      />
                                      {q.options?.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5 mt-2">
                                          {q.options.map(opt => (
                                            <div key={opt.key} className="flex items-baseline gap-1.5">
                                              <span className="shrink-0">{opt.key}.</span>
                                              <RichMath text={opt.md} displayMathInline inlineFirstParagraph />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}

                                  {showSolutions ? (
                                    <div className="mt-1.5 space-y-1.5 text-[14.5px]">
                                      {shouldShowAnswerLine(q) && (
                                        <div>
                                          <span className="exam-heiti-bold mr-[0.55em]">
                                            {templateId === 'gaokao' ? '【答案】' : '答案：'}
                                          </span>
                                          <RichMath text={q.answer.md} displayMathInline inlineFirstParagraph />
                                        </div>
                                      )}
                                      {solText && (
                                        <div>
                                          <span className="exam-heiti-bold mr-[1em]">
                                            {templateId === 'gaokao' ? `【${label}】` : label}
                                          </span>
                                          <RichMath text={solText} displayMathInline inlineFirstParagraph />
                                          <QuestionFigures
                                            figures={q.solution?.figures}
                                            source={sourceMap[item.source_id]}
                                            sourceId={item.source_id}
                                            courseCode={q.course_code}
                                          />
                                        </div>
                                      )}
                                      {comment && (
                                        <div className="text-[#C01C28] pt-0.5">
                                          <span className="exam-heiti-bold">点评：</span>
                                          <RichMath text={comment} displayMathInline inlineFirstParagraph />
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    (q.type === 'solve' || q.type === 'proof') && <div className={writeH} />
                                  )}
                                </div>
                              </article>
                            )
                          })}
                        </div>
                      </section>
                    ))
                  })()}
                </div>
              </div>

              <footer className="mt-12 pt-4 text-center text-[12.5px] text-[#666666]">
                {templateId === 'gaokao'
                  ? `${effectiveFields.subject}试题第 1 页（共 1 页）`
                  : `${effectiveFields.footerTerm ? `${formatDisplayTerm(effectiveFields.footerTerm)}　` : ''}第 1 页（共 1 页）`}
              </footer>
            </motion.div>
          ) : (
            <div className="paper-card rounded-2xl p-12 text-center space-y-3">
              <FileText className="mx-auto h-9 w-9 text-[var(--ink-muted)]" strokeWidth={1.4} />
              <div className="font-editorial text-lg font-medium">选择条件并生成试卷</div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
