import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Compass,
  Database,
  FileText,
  Moon,
  Presentation,
  Search,
  ShoppingBag,
  Sun,
} from 'lucide-react'
import { useStudy } from '../context/StudyContext'
import { BrandLogo } from './BrandLogo'
import type { NavTab } from '../types/study'

interface NavItem {
  id: NavTab
  label: string
  shortLabel: string
  icon: typeof Compass
}

const DESKTOP_TABS: NavItem[] = [
  { id: 'home', label: '总览', shortLabel: '总览', icon: Compass },
  { id: 'bank', label: '题库', shortLabel: '题库', icon: BookOpen },
  { id: 'paper', label: '出卷', shortLabel: '出卷', icon: FileText },
  { id: 'ppt', label: 'PPT', shortLabel: 'PPT', icon: Presentation },
  { id: 'sources', label: '题库源', shortLabel: '同步', icon: Database },
]

const MOBILE_DOCK_TABS: NavItem[] = [
  { id: 'home', label: '总览', shortLabel: '总览', icon: Compass },
  { id: 'bank', label: '题库', shortLabel: '题库', icon: BookOpen },
  { id: 'paper', label: '出卷', shortLabel: '出卷', icon: FileText },
  { id: 'ppt', label: 'PPT', shortLabel: 'PPT', icon: Presentation },
  { id: 'sources', label: '题库源', shortLabel: '同步', icon: Database },
]

export function NavigationShell({
  onOpenCommand,
}: {
  onOpenCommand: () => void
}) {
  const {
    activeTab,
    setActiveTab,
    toggleTheme,
    cartKeys,
    syncing,
    syncProgress,
  } = useStudy()

  return (
    <>
      {/* Whisper-Quiet Typora-Style Header with 3-Tier Progressive Blur Mask & Optical Lip */}
      <header className="no-print sticky top-0 z-40 glass-header">
        <div aria-hidden="true" className="glass-header-backdrop">
          <div className="glass-header-blur glass-header-blur-1" />
          <div className="glass-header-blur glass-header-blur-2" />
          <div className="glass-header-blur glass-header-blur-3" />
          <div className="glass-header-tint" />
          <div className="glass-header-hairline" />
        </div>
        <div className="relative z-10 mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-6">
          {/* Bespoke Logo + Understated Editorial Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="group flex items-center gap-2.5 text-left focus:outline-none cursor-pointer shrink-0"
          >
            <BrandLogo
              size={28}
              className="transition-transform duration-300 group-hover:scale-[1.04]"
            />
            <span className="font-editorial text-[17px] font-semibold tracking-tight text-[var(--ink-primary)] whitespace-nowrap">
              USTC QBank
            </span>
          </button>

          {/* Desktop Plain-Text Editorial Navigation (Typora / iA style — no heavy pill box) */}
          <nav
            aria-label="主导航"
            className="hidden md:flex items-center gap-7 lg:gap-8 h-full"
          >
            {DESKTOP_TABS.map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex h-full items-center gap-1.5 text-[13.5px] whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'text-[var(--ink-primary)] font-medium'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {active && (
                    <motion.span
                      layoutId="desktop-nav-underline"
                      transition={{ type: 'spring', stiffness: 460, damping: 38 }}
                      className="absolute inset-x-0 bottom-0 h-[1.5px] bg-[var(--ink-primary)]"
                    />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Quiet Right Utility Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {cartKeys.length > 0 && (
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                type="button"
                onClick={() => setActiveTab('bank')}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors cursor-pointer"
                title="自选组卷篮"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span className="font-mono-num">{cartKeys.length}</span>
              </motion.button>
            )}

            <button
              type="button"
              onClick={onOpenCommand}
              className="hidden sm:flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[var(--ink-muted)] hover:text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
              title="快速检索与跳转 (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5" />
              <kbd className="font-mono-num text-[11px] opacity-75">⌘K</kbd>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="切换明暗主题"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            >
              <span className="theme-btn-ic">
                <span className="glyph glyph-sun">
                  <Sun className="h-[15px] w-[15px]" strokeWidth={1.75} />
                </span>
                <span className="glyph glyph-moon">
                  <Moon className="h-[15px] w-[15px]" strokeWidth={1.75} />
                </span>
              </span>
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
              className="relative z-10 border-t border-[var(--border-hairline)] bg-[var(--bg-paper)]/85 px-4 py-1.5"
            >
              <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 text-xs text-[var(--ink-secondary)]">
                <span className="truncate">
                  正在同步 <strong className="text-[var(--ink-primary)]">{syncProgress.courseName}</strong>（{syncProgress.courseCode}）·{' '}
                  {syncProgress.phase === 'fetching'
                    ? '拉取题库'
                    : syncProgress.phase === 'verifying'
                      ? 'SHA-256 校验'
                      : '写入本地索引'}
                </span>
                <span className="font-mono-num shrink-0 text-[var(--accent)]">
                  {syncProgress.index} / {syncProgress.total}
                </span>
              </div>
              <div className="mx-auto mt-1 h-0.5 max-w-[1280px] overflow-hidden bg-[var(--bg-subtle)]">
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
      <div className="no-print fixed inset-x-0 bottom-0 z-50 md:hidden pointer-events-none px-3.5 pb-[max(12px,env(safe-area-inset-bottom))]">
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
                    className="glass-active-pill absolute inset-0 rounded-[20px]"
                  />
                )}
                <motion.span
                  animate={{ scale: active ? 1.06 : 1, y: active ? -1 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  className={`relative z-10 flex items-center justify-center ${
                    active ? 'text-[var(--accent)]' : 'text-[var(--ink-secondary)]'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.1 : 1.7} />
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
