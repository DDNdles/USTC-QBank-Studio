import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Compass,
  Database,
  FileText,
  Layers,
  Moon,
  Presentation,
  RotateCcw,
  Search,
  ShoppingBag,
  Sun,
} from 'lucide-react'
import { useStudy } from '../context/StudyContext'
import type { NavTab } from '../types/study'

interface NavItem {
  id: NavTab
  label: string
  shortLabel: string
  icon: typeof Compass
}

const DESKTOP_TABS: NavItem[] = [
  { id: 'home', label: '总览', shortLabel: '总览', icon: Compass },
  { id: 'bank', label: '题库浏览', shortLabel: '题库', icon: BookOpen },
  { id: 'paper', label: '试卷工坊', shortLabel: '出卷', icon: FileText },
  { id: 'ppt', label: '讲评 PPT', shortLabel: 'PPT', icon: Presentation },
  { id: 'mistakes', label: '错题复盘', shortLabel: '错题', icon: RotateCcw },
  { id: 'sources', label: '题库源', shortLabel: '同步', icon: Database },
]

// 5 sleek tabs in the mobile frosted-glass dock (Sources accessible via top header icon as well)
const MOBILE_DOCK_TABS: NavItem[] = [
  { id: 'home', label: '总览', shortLabel: '总览', icon: Compass },
  { id: 'bank', label: '题库', shortLabel: '题库', icon: BookOpen },
  { id: 'paper', label: '出卷', shortLabel: '出卷', icon: FileText },
  { id: 'ppt', label: 'PPT', shortLabel: 'PPT', icon: Presentation },
  { id: 'mistakes', label: '错题', shortLabel: '错题', icon: RotateCcw },
]

export function NavigationShell({
  onOpenCommand,
}: {
  onOpenCommand: () => void
}) {
  const {
    activeTab,
    setActiveTab,
    theme,
    toggleTheme,
    cartKeys,
    dueMistakeCount,
    syncing,
    syncProgress,
  } = useStudy()

  return (
    <>
      {/* Desktop & Mobile Top Editorial Header */}
      <header className="no-print sticky top-0 z-40 glass-header">
        <div className="mx-auto flex h-14 max-w-[1380px] items-center justify-between px-4 md:px-6">
          {/* Brand Mark */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="group flex items-center gap-2.5 text-left focus:outline-none cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] shadow-xs transition-transform duration-300 group-hover:scale-105">
              <Layers className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.9} />
            </div>
            <div className="leading-tight">
              <div className="font-editorial text-[16px] font-semibold tracking-tight text-[var(--ink-primary)] whitespace-nowrap">
                USTC QBank Studio
              </div>
              <div className="hidden xl:block text-[10.5px] tracking-wide text-[var(--ink-muted)] whitespace-nowrap">
                科大题卷工坊 · 零模型排版台
              </div>
            </div>
          </button>

          {/* Desktop Center Floating Editorial Pill Navigation */}
          <nav
            aria-label="主导航"
            className="hidden md:flex items-center gap-0.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/80 p-1 shrink-0"
          >
            {DESKTOP_TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 rounded-full px-3 lg:px-3.5 py-1.5 text-[12.5px] lg:text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'text-[var(--ink-primary)]'
                      : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="desktop-nav-pill"
                      transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                      className="absolute inset-0 rounded-full bg-[var(--bg-paper)] shadow-xs border border-[var(--border-hairline)]"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" strokeWidth={active ? 2.1 : 1.75} />
                    <span>{tab.label}</span>
                    {tab.id === 'mistakes' && dueMistakeCount > 0 && (
                      <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--amber)] px-1 text-[10px] font-semibold text-white font-mono-num">
                        {dueMistakeCount}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {cartKeys.length > 0 && (
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                type="button"
                onClick={() => setActiveTab('bank')}
                className="flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)] cursor-pointer"
                title="自选出卷篮"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span className="font-mono-num">{cartKeys.length}</span>
              </motion.button>
            )}

            <button
              type="button"
              onClick={onOpenCommand}
              className="hidden sm:flex items-center gap-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-3 py-1.5 text-xs text-[var(--ink-muted)] hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)] transition-colors cursor-pointer"
              title="快速跳转与检索 (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span>快速检索</span>
              <kbd className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono-num text-[10px] text-[var(--ink-secondary)]">
                ⌘K
              </kbd>
            </button>

            {/* Mobile Sources quick trigger */}
            <button
              type="button"
              onClick={() => setActiveTab('sources')}
              aria-label="题库源与同步"
              className={`md:hidden flex h-8 w-8 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                activeTab === 'sources'
                  ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-paper)] text-[var(--ink-secondary)]'
              }`}
            >
              <Database className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="切换明暗主题"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-paper)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
            >
              <AnimatePresence mode="wait" initial={false}>
                {theme === 'light' ? (
                  <motion.span
                    key="moon"
                    initial={{ rotate: -25, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 25, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Moon className="h-3.5 w-3.5" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="sun"
                    initial={{ rotate: 25, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -25, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Sun className="h-3.5 w-3.5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* Live Sync Progress Hairline Bar */}
        <AnimatePresence>
          {syncing && syncProgress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-[var(--border-hairline)] bg-[var(--bg-paper)]/90 px-4 py-1.5"
            >
              <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 text-xs text-[var(--ink-secondary)]">
                <span className="truncate">
                  正在同步 <strong className="text-[var(--ink-primary)]">{syncProgress.courseName}</strong>（{syncProgress.courseCode}）·{' '}
                  {syncProgress.phase === 'fetching'
                    ? '拉取题库文件'
                    : syncProgress.phase === 'verifying'
                      ? 'SHA-256 完整性校验'
                      : '写入本地 IndexedDB 索引'}
                </span>
                <span className="font-mono-num shrink-0 text-[var(--accent)]">
                  {syncProgress.index} / {syncProgress.total}
                </span>
              </div>
              <div className="mx-auto mt-1 h-0.5 max-w-[1380px] overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                <motion.div
                  className="h-full bg-[var(--accent)]"
                  initial={{ width: '8%' }}
                  animate={{ width: `${Math.max(12, Math.round((syncProgress.index / syncProgress.total) * 100))}%` }}
                  transition={{ ease: 'easeOut', duration: 0.35 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile Floating Frosted-Glass Bottom Switcher Dock (毛玻璃底部切换栏) */}
      <div className="no-print fixed inset-x-0 bottom-0 z-50 md:hidden pointer-events-none px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <motion.nav
          aria-label="移动端底部毛玻璃导航"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 32 }}
          className="glass-dock pointer-events-auto mx-auto grid max-w-md grid-cols-5 items-center rounded-[26px] p-1.5"
        >
          {MOBILE_DOCK_TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="relative flex flex-col items-center justify-center gap-0.5 rounded-[20px] py-2 text-[11px] font-medium transition-colors cursor-pointer select-none"
              >
                {active && (
                  <motion.span
                    layoutId="mobile-glass-pill"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="absolute inset-0 rounded-[20px] bg-[var(--glass-pill)] shadow-inner border border-[var(--glass-border)]"
                  />
                )}
                <motion.span
                  animate={{ scale: active ? 1.06 : 1, y: active ? -1 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  className={`relative z-10 flex items-center justify-center ${
                    active ? 'text-[var(--accent)]' : 'text-[var(--ink-secondary)]'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.75} />
                  {tab.id === 'mistakes' && dueMistakeCount > 0 && (
                    <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--amber)] px-1 text-[9px] font-bold text-white font-mono-num">
                      {dueMistakeCount > 9 ? '9+' : dueMistakeCount}
                    </span>
                  )}
                  {tab.id === 'bank' && cartKeys.length > 0 && (
                    <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-white font-mono-num">
                      {cartKeys.length}
                    </span>
                  )}
                </motion.span>
                <span
                  className={`relative z-10 leading-none transition-colors ${
                    active ? 'text-[var(--ink-primary)] font-semibold' : 'text-[var(--ink-muted)]'
                  }`}
                >
                  {tab.shortLabel}
                </span>
              </button>
            )
          })}
        </motion.nav>
      </div>
    </>
  )
}
