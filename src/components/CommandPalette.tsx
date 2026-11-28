import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Database, FileText, Presentation, Search, ArrowRight } from 'lucide-react'
import { useStudy } from '../context/StudyContext'

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { sources, papers, setActiveTab, setActivePaperId, setBankCourseFilter } = useStudy()
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) onClose()
      } else if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const courses = useMemo(() => {
    const all = sources.flatMap(s =>
      (s.manifest?.courses ?? []).map(c => ({
        ...c,
        sourceId: s.source_id,
        installed: Boolean(s.installed_courses[c.code]),
      })),
    )
    const q = query.trim().toLowerCase()
    if (!q) return all.slice(0, 8)
    return all
      .filter(
        c =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q),
      )
      .slice(0, 10)
  }, [sources, query])

  const quickActions = [
    { label: '前往快速出卷工坊（中科大 / 高考版式）', icon: FileText, run: () => setActiveTab('paper') },
    { label: '前往讲评 PPT 放映与导出', icon: Presentation, run: () => setActiveTab('ppt') },
    { label: '管理题库源与同步课程', icon: Database, run: () => setActiveTab('sources') },
  ]

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-scrim absolute inset-0"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
            onClick={e => e.stopPropagation()}
            className="glass-sheet relative z-10 w-full max-w-xl rounded-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-[var(--border-hairline)] px-4 py-3">
              <Search className="h-4 w-4 text-[var(--ink-muted)]" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="搜索课程代码、课程名、试卷或快捷操作..."
                className="w-full bg-transparent text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:outline-none"
              />
              <kbd className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono-num text-[10px] text-[var(--ink-muted)]">
                ESC
              </kbd>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
              <div>
                <div className="px-2.5 py-1 text-[11px] font-medium text-[var(--ink-muted)]">快捷工作台</div>
                {quickActions.map(act => {
                  const Icon = act.icon
                  return (
                    <button
                      key={act.label}
                      type="button"
                      onClick={() => {
                        act.run()
                        onClose()
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="h-3.5 w-3.5 text-[var(--accent)]" />
                        {act.label}
                      </span>
                      <ArrowRight className="h-3 w-3 text-[var(--ink-muted)]" />
                    </button>
                  )
                })}
              </div>

              {papers.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 text-[11px] font-medium text-[var(--ink-muted)]">最近试卷</div>
                  {papers.slice(0, 4).map(p => (
                    <button
                      key={p.paper_id}
                      type="button"
                      onClick={() => {
                        setActivePaperId(p.paper_id)
                        setActiveTab('paper')
                        onClose()
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs hover:bg-[var(--bg-subtle)] cursor-pointer"
                    >
                      <span className="truncate font-medium text-[var(--ink-primary)]">{p.title}</span>
                      <span className="font-mono-num text-[11px] text-[var(--ink-muted)] shrink-0">
                        {p.items.length} 题
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div>
                <div className="px-2.5 py-1 text-[11px] font-medium text-[var(--ink-muted)]">课程目录</div>
                {courses.map(c => (
                  <button
                    key={`${c.sourceId}-${c.code}`}
                    type="button"
                    onClick={() => {
                      if (c.installed) {
                        setBankCourseFilter([c.code])
                        setActiveTab('bank')
                      } else {
                        setActiveTab('sources')
                      }
                      onClose()
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <BookOpen className="h-3.5 w-3.5 text-[var(--ink-muted)] shrink-0" />
                      <span className="font-mono-num text-[var(--accent)]">{c.code}</span>
                      <span className="truncate text-[var(--ink-primary)]">{c.name}</span>
                    </span>
                    <span className="text-[11px] text-[var(--ink-muted)] shrink-0">
                      {c.installed ? '已同步 · 浏览' : `${c.total} 题 · 去同步`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
