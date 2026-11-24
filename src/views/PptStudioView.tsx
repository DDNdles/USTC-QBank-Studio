import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Presentation,
  StickyNote,
} from 'lucide-react'
import { useStudy } from '../context/StudyContext'
import type { GeneratedSlide, PptTheme } from '../engine/pptxEngine'

export function PptStudioView() {
  const { papers, activePaper, setActivePaperId, setActiveTab, showToast } = useStudy()

  const [slides, setSlides] = useState<GeneratedSlide[]>([])
  const [activeTheme, setActiveTheme] = useState<PptTheme | null>(null)
  const [activeAssets, setActiveAssets] = useState<{
    bgContent: string | null
    iconQuestion: string | null
    iconSolution: string | null
  }>({ bgContent: null, iconQuestion: null, iconSolution: null })
  const [currentIdx, setCurrentIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [building, setBuilding] = useState(false)
  const [exporting, setExporting] = useState<{ current: number; total: number } | null>(null)
  const [showNotes, setShowNotes] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!activePaper) {
      setSlides([])
      return
    }
    let cancelled = false
    setBuilding(true)

    import('../engine/pptxEngine')
      .then(async mod => {
        const res = await mod.generateSlidesForPaper(activePaper)
        if (!cancelled) {
          setSlides(res.slides)
          setActiveTheme(res.theme)
          setActiveAssets(res.assets)
          setCurrentIdx(0)
        }
      })
      .catch(err => {
        if (!cancelled) showToast(`课件排版失败：${err instanceof Error ? err.message : String(err)}`, 'error')
      })
      .finally(() => {
        if (!cancelled) setBuilding(false)
      })

    return () => {
      cancelled = true
    }
  }, [activePaper, showToast])

  const goTo = useCallback(
    (next: number) => {
      if (!slides.length) return
      const clamped = Math.max(0, Math.min(slides.length - 1, next))
      setDirection(clamped >= currentIdx ? 1 : -1)
      setCurrentIdx(clamped)
    },
    [slides.length, currentIdx],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return
      }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        if (fullscreen) e.preventDefault()
        goTo(currentIdx + 1)
      } else if (e.key === 'ArrowLeft') {
        if (fullscreen) e.preventDefault()
        goTo(currentIdx - 1)
      } else if (e.key === 'Escape' && fullscreen) {
        setFullscreen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentIdx, fullscreen, goTo])

  const handleExportPptx = async () => {
    if (!activePaper || !slides.length || !activeTheme) return
    setExporting({ current: 0, total: slides.length })
    try {
      const mod = await import('../engine/pptxEngine')
      await mod.exportSlidesToPptx(activePaper, slides, activeTheme, activeAssets, (current, total) => {
        setExporting({ current, total })
      })
      showToast(`已导出经典讲评 PPT（共 ${slides.length} 页，含演讲者备注）`, 'success')
    } catch (err) {
      showToast(`PPTX 导出失败：${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setExporting(null)
    }
  }

  if (!papers.length) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center space-y-5 pb-28">
        <div className="mx-auto w-52 overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] p-1.5">
          <img src="./images/study-vignette.svg" alt="讲评课件" className="aspect-[4/3] w-full rounded object-cover" />
        </div>
        <h2 className="font-editorial text-2xl font-medium">先在试卷工坊组卷</h2>
        <p className="text-sm text-[var(--ink-secondary)] leading-relaxed">
          沿用 dsh-study 原版 review-classic 模板，自动生成封面、作答页与分页解析页，并写入演讲者备注。
        </p>
        <button
          type="button"
          onClick={() => setActiveTab('paper')}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--ink-primary)] px-5 py-2 text-xs font-medium text-[var(--bg-paper)] cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5" /> 前往出卷
        </button>
      </div>
    )
  }

  const currentSlide = slides[currentIdx]

  return (
    <div className="mx-auto max-w-[1240px] px-4 sm:px-6 py-6 pb-28 md:pb-16 space-y-5">
      {/* Quiet Top Control Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Presentation className="h-4 w-4 text-[var(--ink-secondary)]" />
            <select
              value={activePaper?.paper_id ?? ''}
              onChange={e => setActivePaperId(e.target.value)}
              className="max-w-[260px] sm:max-w-sm rounded-md border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-3 py-1.5 text-xs font-medium text-[var(--ink-primary)]"
            >
              {papers.map(p => (
                <option key={p.paper_id} value={p.paper_id}>
                  {p.title}（{p.items.length} 题）
                </option>
              ))}
            </select>
          </div>

          <span className="font-mono-num text-[11.5px] text-[var(--ink-muted)]">
            模板：review-classic（dsh-study 原版）
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNotes(v => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
              showNotes
                ? 'border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--ink-primary)]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-paper)] text-[var(--ink-secondary)]'
            }`}
          >
            <StickyNote className="h-3.5 w-3.5" /> 备注
          </button>

          <button
            type="button"
            disabled={!slides.length}
            onClick={() => setFullscreen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-3 py-1.5 text-xs text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" /> 全屏放映
          </button>

          <button
            type="button"
            disabled={!slides.length || Boolean(exporting) || building}
            onClick={() => void handleExportPptx()}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--ink-primary)] px-4 py-1.5 text-xs font-medium text-[var(--bg-paper)] disabled:opacity-45 hover:opacity-90 cursor-pointer"
          >
            {exporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                打包中 ({exporting.current}/{exporting.total})
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" /> 导出 .pptx
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main 16:9 Verbatim Slide Stage */}
      <div className="space-y-4">
        <div className="group relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[#FAF9F5] shadow-[var(--shadow-sheet)]">
          {building ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-[var(--ink-secondary)]">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
              <span>正在排版讲评幻灯片…</span>
            </div>
          ) : currentSlide ? (
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`slide-${currentSlide.index}`}
                custom={direction}
                initial={{ opacity: 0, x: direction > 0 ? 24 : -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction > 0 ? -24 : 24 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: currentSlide.svg }}
              />
            </AnimatePresence>
          ) : null}

          {slides.length > 1 && (
            <>
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => goTo(currentIdx - 1)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 backdrop-blur-md border border-black/10 text-neutral-800 shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0 transition-opacity cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={currentIdx === slides.length - 1}
                onClick={() => goTo(currentIdx + 1)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 backdrop-blur-md border border-black/10 text-neutral-800 shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0 transition-opacity cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Dedicated Controls + Filmstrip */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-secondary)]">
          <span className="font-medium text-[var(--ink-primary)]">
            {currentSlide?.title ?? '—'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentIdx === 0}
              onClick={() => goTo(currentIdx - 1)}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-2.5 py-1 text-xs disabled:opacity-35 hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> 上一页
            </button>
            <span className="font-mono-num px-1">
              {slides.length ? currentIdx + 1 : 0} / {slides.length}
            </span>
            <button
              type="button"
              disabled={currentIdx === slides.length - 1}
              onClick={() => goTo(currentIdx + 1)}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-2.5 py-1 text-xs disabled:opacity-35 hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              下一页 <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {slides.length > 0 && (
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {slides.map((s, idx) => {
              const active = idx === currentIdx
              return (
                <button
                  key={s.index}
                  type="button"
                  onClick={() => goTo(idx)}
                  className={`shrink-0 w-36 text-left rounded-md border p-1 transition-all cursor-pointer ${
                    active
                      ? 'border-[var(--ink-primary)] bg-[var(--bg-paper)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-paper)]/60 hover:border-[var(--border-strong)] opacity-80 hover:opacity-100'
                  }`}
                >
                  <div
                    className="aspect-[16/9] w-full overflow-hidden rounded-xs bg-[#FAF9F5] [&>svg]:h-full [&>svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: s.svg }}
                  />
                  <div className="mt-1 truncate text-[10.5px] text-[var(--ink-secondary)]">
                    {idx + 1}. {s.title}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Speaker Notes */}
      <AnimatePresence>
        {showNotes && currentSlide?.notes && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="border-t border-[var(--border-hairline)] pt-4 space-y-2"
          >
            <div className="text-xs font-medium text-[var(--ink-muted)]">演讲者备注（Speaker Notes）</div>
            <pre className="whitespace-pre-wrap font-sans text-xs sm:text-[13px] leading-relaxed text-[var(--ink-secondary)]">
              {currentSlide.notes}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Presenter */}
      <AnimatePresence>
        {fullscreen && currentSlide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0F1013] flex flex-col items-center justify-center p-4 sm:p-8"
          >
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              <span className="rounded-full bg-white/10 backdrop-blur-md px-3 py-1 font-mono-num text-xs text-white/85">
                {currentIdx + 1} / {slides.length}
              </span>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md px-3 py-1.5 text-xs text-white hover:bg-white/20 cursor-pointer"
              >
                <Minimize2 className="h-3.5 w-3.5" /> 退出放映 (ESC)
              </button>
            </div>

            <div className="relative w-full max-w-6xl aspect-[16/9] overflow-hidden rounded-lg shadow-2xl">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={`fs-${currentSlide.index}`}
                  custom={direction}
                  initial={{ opacity: 0, x: direction > 0 ? 36 : -36 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction > 0 ? -36 : 36 }}
                  transition={{ duration: 0.24 }}
                  className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: currentSlide.svg }}
                />
              </AnimatePresence>
            </div>

            <div className="mt-5 flex items-center gap-4">
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => goTo(currentIdx - 1)}
                className="rounded-full bg-white/10 px-4 py-2 text-xs text-white disabled:opacity-30 hover:bg-white/20 cursor-pointer"
              >
                ← 上一页
              </button>
              <button
                type="button"
                disabled={currentIdx === slides.length - 1}
                onClick={() => goTo(currentIdx + 1)}
                className="rounded-full bg-white/10 px-4 py-2 text-xs text-white disabled:opacity-30 hover:bg-white/20 cursor-pointer"
              >
                下一页 →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
