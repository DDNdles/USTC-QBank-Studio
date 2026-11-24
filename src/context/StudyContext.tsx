import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  deletePaper,
  deleteSource,
  exportWorkspaceBackup,
  importWorkspaceBackup,
  listAllQuestions,
  listAllTaxonomies,
  listFeedback,
  listPapers,
  listSources,
  removeCourseData,
  savePaper,
  saveSource,
} from '../db/storage'
import {
  importLocalBankFiles,
  refreshSourceManifest,
  syncCoursesFromSource,
  type SyncProgress,
} from '../services/sourceSync'
import { submitQuestionFeedback } from '../services/feedbackService'
import type {
  FeedbackRecord,
  NavTab,
  QuestionRecord,
  SavedPaper,
  SourceConfig,
  StoredQuestion,
  StoredTaxonomy,
} from '../types/study'

interface ToastMessage {
  id: number
  text: string
  tone: 'info' | 'success' | 'error'
}

interface StudyContextValue {
  ready: boolean
  activeTab: NavTab
  setActiveTab: (tab: NavTab) => void
  theme: 'light' | 'dark'
  toggleTheme: () => void

  sources: SourceConfig[]
  sourceMap: Record<string, SourceConfig>
  courseNameMap: Record<string, string>
  questions: StoredQuestion[]
  taxonomies: StoredTaxonomy[]
  papers: SavedPaper[]
  feedbackList: FeedbackRecord[]

  activePaperId: string | null
  activePaper: SavedPaper | null
  setActivePaperId: (id: string | null) => void

  cartKeys: string[]
  toggleCartKey: (key: string) => void
  clearCart: () => void

  syncing: boolean
  syncProgress: SyncProgress | null
  toast: ToastMessage | null
  showToast: (text: string, tone?: ToastMessage['tone']) => void

  syncCourses: (sourceId: string, courseCodes: string[]) => Promise<void>
  refreshManifest: (sourceId: string) => Promise<void>
  uninstallCourse: (sourceId: string, courseCode: string) => Promise<void>
  addCustomSource: (input: {
    name: string
    transport: 'github-raw' | 'http-manifest'
    location: string
    ref?: string
    mirror_url?: string
  }) => Promise<void>
  updateSourceMirror: (sourceId: string, mirrorUrl: string) => Promise<void>
  removeCustomSource: (sourceId: string) => Promise<void>
  importLocalBank: (files: FileList, name?: string) => Promise<void>

  persistPaper: (paper: SavedPaper, select?: boolean) => Promise<void>
  removePaper: (paperId: string) => Promise<void>

  sendFeedback: (params: {
    source_id: string
    question: QuestionRecord
    category_ids: string[]
    detail: string
  }) => Promise<FeedbackRecord & { delivery_error?: string | null }>

  downloadBackup: () => Promise<void>
  restoreBackup: (jsonText: string) => Promise<void>

  bankCourseFilter: string[]
  setBankCourseFilter: (codes: string[]) => void
}

const StudyContext = createContext<StudyContextValue | null>(null)
const VALID_TABS: NavTab[] = ['home', 'bank', 'paper', 'ppt', 'sources']

function readTabFromHash(): NavTab {
  const raw = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] as NavTab
  return VALID_TABS.includes(raw) ? raw : 'home'
}

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [activeTab, setActiveTabState] = useState<NavTab>(() => readTabFromHash())
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ustc-studio-theme')
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const [sources, setSources] = useState<SourceConfig[]>([])
  const [questions, setQuestions] = useState<StoredQuestion[]>([])
  const [taxonomies, setTaxonomies] = useState<StoredTaxonomy[]>([])
  const [papers, setPapers] = useState<SavedPaper[]>([])
  const [feedbackList, setFeedbackList] = useState<FeedbackRecord[]>([])
  const [activePaperId, setActivePaperId] = useState<string | null>(null)
  const [cartKeys, setCartKeys] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [bankCourseFilter, setBankCourseFilter] = useState<string[]>([])

  const showToast = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    const id = Date.now()
    setToast({ id, text, tone })
    window.setTimeout(() => {
      setToast(cur => (cur?.id === id ? null : cur))
    }, 3600)
  }, [])

  const setActiveTab = useCallback((tab: NavTab) => {
    setActiveTabState(tab)
    if (window.location.hash !== `#/${tab}`) {
      window.history.replaceState(null, '', `#/${tab}`)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onHash = () => setActiveTabState(readTabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('ustc-studio-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(cur => (cur === 'light' ? 'dark' : 'light'))
  }, [])

  const reloadAll = useCallback(async () => {
    const [srcs, qs, txs, pps, fbs] = await Promise.all([
      listSources(),
      listAllQuestions(),
      listAllTaxonomies(),
      listPapers(),
      listFeedback(),
    ])
    setSources(srcs)
    setQuestions(qs)
    setTaxonomies(txs)
    setPapers(pps)
    setFeedbackList(fbs)
    setActivePaperId(cur => cur ?? pps[0]?.paper_id ?? null)
    setReady(true)
  }, [])

  useEffect(() => {
    void reloadAll()
  }, [reloadAll])

  useEffect(() => {
    if (!ready) return
    const official = sources.find(s => s.source_id === 'ustc-official')
    if (!official) return
    const ctrl = new AbortController()
    refreshSourceManifest(official, ctrl.signal)
      .then(updated => {
        setSources(prev => prev.map(s => (s.source_id === updated.source_id ? updated : s)))
      })
      .catch(() => {})
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const sourceMap = useMemo(
    () => Object.fromEntries(sources.map(s => [s.source_id, s])),
    [sources],
  )

  const courseNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of sources) {
      for (const c of s.manifest?.courses ?? []) {
        map[c.code] = c.name
      }
    }
    return map
  }, [sources])

  const activePaper = useMemo(
    () => papers.find(p => p.paper_id === activePaperId) ?? papers[0] ?? null,
    [papers, activePaperId],
  )

  const toggleCartKey = useCallback((key: string) => {
    setCartKeys(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]))
  }, [])

  const clearCart = useCallback(() => setCartKeys([]), [])

  const syncCourses = useCallback(
    async (sourceId: string, courseCodes: string[]) => {
      const src = sources.find(s => s.source_id === sourceId)
      if (!src) throw new Error('未找到指定题库源')
      setSyncing(true)
      try {
        const res = await syncCoursesFromSource(src, courseCodes, p => setSyncProgress(p))
        await reloadAll()
        showToast(`同步完成：${courseCodes.length} 门课程，共 ${res.syncedCount} 道题`, 'success')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        showToast(`同步失败：${msg}`, 'error')
        throw err
      } finally {
        setSyncing(false)
        setSyncProgress(null)
      }
    },
    [sources, reloadAll, showToast],
  )

  const refreshManifest = useCallback(
    async (sourceId: string) => {
      const src = sources.find(s => s.source_id === sourceId)
      if (!src) return
      try {
        const updated = await refreshSourceManifest(src)
        setSources(prev => prev.map(s => (s.source_id === sourceId ? updated : s)))
        showToast(`已刷新 ${updated.name}（v${updated.data_version ?? 'latest'}）`, 'success')
      } catch (err) {
        showToast(`刷新失败：${err instanceof Error ? err.message : String(err)}`, 'error')
      }
    },
    [sources, showToast],
  )

  const uninstallCourse = useCallback(
    async (sourceId: string, courseCode: string) => {
      await removeCourseData(sourceId, courseCode)
      await reloadAll()
      showToast(`已移除缓存 ${courseCode}`, 'info')
    },
    [reloadAll, showToast],
  )

  const addCustomSource = useCallback(
    async (input: {
      name: string
      transport: 'github-raw' | 'http-manifest'
      location: string
      ref?: string
      mirror_url?: string
    }) => {
      const candidate: SourceConfig = {
        source_id: `src-${crypto.randomUUID().slice(0, 8)}`,
        name: input.name.trim() || input.location.trim(),
        transport: input.transport,
        location: input.location.trim(),
        ref: input.ref?.trim() || (input.transport === 'github-raw' ? 'main' : null),
        mirror_url: input.mirror_url?.trim() || null,
        installed_courses: {},
        builtin: false,
      }
      const verified = await refreshSourceManifest(candidate)
      await saveSource(verified)
      await reloadAll()
      showToast(`已接入「${verified.name}」`, 'success')
    },
    [reloadAll, showToast],
  )

  const updateSourceMirror = useCallback(
    async (sourceId: string, mirrorUrl: string) => {
      const src = sources.find(s => s.source_id === sourceId)
      if (!src) return
      const updated = { ...src, mirror_url: mirrorUrl.trim() || null }
      await saveSource(updated)
      setSources(prev => prev.map(s => (s.source_id === sourceId ? updated : s)))
      showToast('已更新镜像配置', 'success')
    },
    [sources, showToast],
  )

  const removeCustomSource = useCallback(
    async (sourceId: string) => {
      await deleteSource(sourceId)
      await reloadAll()
      showToast('已删除题库源', 'info')
    },
    [reloadAll, showToast],
  )

  const importLocalBank = useCallback(
    async (files: FileList, name?: string) => {
      try {
        const res = await importLocalBankFiles(files, name)
        await reloadAll()
        showToast(`已导入 ${res.coursesImported} 门课程，共 ${res.questionsImported} 题`, 'success')
      } catch (err) {
        showToast(`导入失败：${err instanceof Error ? err.message : String(err)}`, 'error')
        throw err
      }
    },
    [reloadAll, showToast],
  )

  const persistPaper = useCallback(async (paper: SavedPaper, select = true) => {
    const next = { ...paper, updated_at: new Date().toISOString() }
    await savePaper(next)
    const list = await listPapers()
    setPapers(list)
    if (select) setActivePaperId(next.paper_id)
  }, [])

  const removePaper = useCallback(
    async (paperId: string) => {
      await deletePaper(paperId)
      const list = await listPapers()
      setPapers(list)
      setActivePaperId(cur => (cur === paperId ? (list[0]?.paper_id ?? null) : cur))
      showToast('已删除试卷', 'info')
    },
    [showToast],
  )

  const sendFeedback = useCallback(
    async (params: {
      source_id: string
      question: QuestionRecord
      category_ids: string[]
      detail: string
    }) => {
      const res = await submitQuestionFeedback({
        source: sourceMap[params.source_id],
        source_id: params.source_id,
        course_name: courseNameMap[params.question.course_code] || params.question.course_code,
        question: params.question,
        category_ids: params.category_ids,
        detail: params.detail,
      })
      setFeedbackList(await listFeedback())
      showToast(res.delivery_status === 'delivered' ? '已提交纠错' : '已生成预填反馈', 'success')
      return res
    },
    [sourceMap, courseNameMap, showToast],
  )

  const downloadBackup = useCallback(async () => {
    const json = await exportWorkspaceBackup()
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ustc-qbank-studio-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('已导出备份 JSON', 'success')
  }, [showToast])

  const restoreBackup = useCallback(
    async (jsonText: string) => {
      const res = await importWorkspaceBackup(jsonText)
      await reloadAll()
      showToast(`已恢复 ${res.papers} 份试卷`, 'success')
    },
    [reloadAll, showToast],
  )

  const value: StudyContextValue = {
    ready,
    activeTab,
    setActiveTab,
    theme,
    toggleTheme,
    sources,
    sourceMap,
    courseNameMap,
    questions,
    taxonomies,
    papers,
    feedbackList,
    activePaperId,
    activePaper,
    setActivePaperId,
    cartKeys,
    toggleCartKey,
    clearCart,
    syncing,
    syncProgress,
    toast,
    showToast,
    syncCourses,
    refreshManifest,
    uninstallCourse,
    addCustomSource,
    updateSourceMirror,
    removeCustomSource,
    importLocalBank,
    persistPaper,
    removePaper,
    sendFeedback,
    downloadBackup,
    restoreBackup,
    bankCourseFilter,
    setBankCourseFilter,
  }

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}

export function useStudy(): StudyContextValue {
  const ctx = useContext(StudyContext)
  if (!ctx) throw new Error('useStudy must be used within StudyProvider')
  return ctx
}
