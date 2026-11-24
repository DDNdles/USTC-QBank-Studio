import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  CheckCircle2,
  CloudDownload,
  Download,
  FolderUp,
  Globe,
  HardDriveDownload,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { useStudy } from '../context/StudyContext'

export function SourcesView() {
  const {
    sources,
    syncing,
    syncCourses,
    refreshManifest,
    uninstallCourse,
    addCustomSource,
    updateSourceMirror,
    removeCustomSource,
    importLocalBank,
    downloadBackup,
    restoreBackup,
    setBankCourseFilter,
    setActiveTab,
    showToast,
  } = useStudy()

  const [activeSourceId, setActiveSourceId] = useState('ustc-official')
  const [search, setSearch] = useState('')
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [mirrorInput, setMirrorInput] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTransport, setNewTransport] = useState<'github-raw' | 'http-manifest'>('github-raw')
  const [newLocation, setNewLocation] = useState('')
  const [adding, setAdding] = useState(false)

  const dirInputRef = useRef<HTMLInputElement>(null)
  const backupInputRef = useRef<HTMLInputElement>(null)

  const activeSource = useMemo(
    () => sources.find(s => s.source_id === activeSourceId) ?? sources[0],
    [sources, activeSourceId],
  )

  const courses = useMemo(() => {
    const list = activeSource?.manifest?.courses ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      c =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.name_en.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q),
    )
  }, [activeSource, search])

  const toggleSelect = (code: string) => {
    setSelectedCodes(prev => (prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]))
  }

  const handleBatchSync = async () => {
    if (!activeSource || !selectedCodes.length) return
    await syncCourses(activeSource.source_id, selectedCodes)
    setSelectedCodes([])
  }

  const handleAddSource = async () => {
    if (!newLocation.trim()) return
    setAdding(true)
    try {
      await addCustomSource({
        name: newName,
        transport: newTransport,
        location: newLocation,
      })
      setNewName('')
      setNewLocation('')
      setShowAddForm(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1220px] px-4 sm:px-6 py-8 pb-28 md:pb-16 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[var(--ink-primary)]">
            题库源与同步
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={dirInputRef}
            type="file"
            multiple
            // @ts-expect-error webkitdirectory is standard in modern browsers
            webkitdirectory=""
            className="hidden"
            onChange={e => {
              if (e.target.files?.length) {
                void importLocalBank(e.target.files)
                e.target.value = ''
              }
            }}
          />
          <button
            type="button"
            onClick={() => dirInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-3.5 py-2 text-xs font-medium text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <FolderUp className="h-3.5 w-3.5 text-[var(--accent)]" />
            导入本地题库目录
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm(v => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--ink-primary)] px-3.5 py-2 text-xs font-medium text-[var(--bg-paper)] hover:opacity-90 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            添加远程题库源
          </button>
        </div>
      </div>

      {/* Add Remote Source Drawer */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="paper-card rounded-2xl p-5 space-y-4"
        >
          <div className="text-sm font-semibold">接入新的 v1.0 协议题库源</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="显示名称（如：我的考研题库）"
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
            />
            <select
              value={newTransport}
              onChange={e => setNewTransport(e.target.value as 'github-raw' | 'http-manifest')}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
            >
              <option value="github-raw">GitHub 仓库（owner/repo）</option>
              <option value="http-manifest">HTTP Manifest 地址</option>
            </select>
            <input
              value={newLocation}
              onChange={e => setNewLocation(e.target.value)}
              placeholder={newTransport === 'github-raw' ? '如：DDNdles/USTC-Question-Bank' : '如：https://example.com/bank/'}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs font-mono-num"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              disabled={adding || !newLocation.trim()}
              onClick={() => void handleAddSource()}
              className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50 cursor-pointer"
            >
              {adding ? '校验中…' : '校验并添加'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Source Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {sources
          .filter(s => s.transport !== 'personal')
          .map(src => {
            const active = src.source_id === activeSource?.source_id
            const installedNum = Object.keys(src.installed_courses ?? {}).length
            return (
              <button
                key={src.source_id}
                type="button"
                onClick={() => {
                  setActiveSourceId(src.source_id)
                  setSelectedCodes([])
                  setMirrorInput(src.mirror_url ?? '')
                }}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-paper)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>{src.name}</span>
                <span className="font-mono-num text-[11px] opacity-80">({installedNum} 已同步)</span>
              </button>
            )
          })}
      </div>

      {/* Active Source Card & Course Table */}
      {activeSource && (
        <div className="paper-card rounded-2xl overflow-hidden">
          <div className="border-b border-[var(--border-hairline)] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-editorial text-lg font-semibold text-[var(--ink-primary)]">
                  {activeSource.name}
                </h2>
                <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 font-mono-num text-[11px] text-[var(--ink-secondary)]">
                  v{activeSource.data_version ?? 'local'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mastered-soft)] px-2.5 py-0.5 text-[11px] text-[var(--mastered)]">
                  <ShieldCheck className="h-3 w-3" /> SHA-256 校验开启
                </span>
              </div>
              <div className="font-mono-num text-[11px] text-[var(--ink-muted)]">
                {activeSource.transport} · {activeSource.location}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeSource.transport === 'github-raw' && (
                <div className="flex items-center gap-1.5">
                  <input
                    value={mirrorInput || activeSource.mirror_url || ''}
                    onChange={e => setMirrorInput(e.target.value)}
                    placeholder="CDN/镜像前缀"
                    className="w-48 sm:w-64 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-[11px] font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={() => void updateSourceMirror(activeSource.source_id, mirrorInput)}
                    className="rounded-lg border border-[var(--border-hairline)] px-2.5 py-1.5 text-[11px] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    保存镜像
                  </button>
                </div>
              )}

              {activeSource.transport !== 'local-import' && (
                <button
                  type="button"
                  onClick={() => void refreshManifest(activeSource.source_id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> 刷新目录
                </button>
              )}

              {!activeSource.builtin && (
                <button
                  type="button"
                  onClick={() => void removeCustomSource(activeSource.source_id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--comment-red)]/30 px-2.5 py-1.5 text-xs text-[var(--comment-red)] hover:bg-[var(--comment-red-soft)] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> 删除源
                </button>
              )}
            </div>
          </div>

          {/* Search + Batch Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)]/40 px-4 sm:px-5 py-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--ink-muted)]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="筛选课程代码、名称或院系..."
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-paper)] pl-8 pr-3 py-1.5 text-xs focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedCodes(
                    selectedCodes.length === courses.length ? [] : courses.map(c => c.code),
                  )
                }
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] cursor-pointer"
              >
                {selectedCodes.length === courses.length && courses.length > 0 ? '取消全选' : '全选课程'}
              </button>
              <button
                type="button"
                disabled={syncing || !selectedCodes.length || activeSource.transport === 'local-import'}
                onClick={() => void handleBatchSync()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-45 hover:opacity-95 cursor-pointer"
              >
                <CloudDownload className="h-3.5 w-3.5" />
                {syncing ? '正在同步…' : `同步选中课程 (${selectedCodes.length})`}
              </button>
            </div>
          </div>

          {/* Course Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 sm:p-5">
            {courses.map(course => {
              const inst = activeSource.installed_courses[course.code]
              const isSelected = selectedCodes.includes(course.code)
              const hasUpdate = Boolean(inst && course.sha256?.questions && inst.questions_sha256 && inst.questions_sha256 !== course.sha256.questions)

              return (
                <div
                  key={course.code}
                  className={`rounded-xl border p-4 transition-colors flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]/50'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]/50 hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSelect(course.code)}
                      className="flex items-start gap-2.5 text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                            : 'border-[var(--border-strong)] bg-[var(--bg-paper)]'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono-num text-[11px] font-semibold text-[var(--accent)]">
                            {course.code}
                          </span>
                          <span className="text-[11px] text-[var(--ink-muted)] truncate">
                            {course.department}
                          </span>
                        </div>
                        <div className="font-medium text-sm text-[var(--ink-primary)] mt-0.5 truncate">
                          {course.name}
                        </div>
                        <div className="text-[11px] text-[var(--ink-muted)] truncate">
                          {course.name_en}
                        </div>
                      </div>
                    </button>

                    {inst && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mastered-soft)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--mastered)] shrink-0">
                        <CheckCircle2 className="h-3 w-3" />
                        {hasUpdate ? '可更新' : '已缓存'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--border-hairline)] pt-2.5 text-[11px]">
                    <span className="font-mono-num text-[var(--ink-secondary)]">
                      {course.total} 题 · 官方 {course.by_origin?.official ?? 0}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {inst ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setBankCourseFilter([course.code])
                              setActiveTab('bank')
                            }}
                            className="rounded-md bg-[var(--bg-paper)] border border-[var(--border-hairline)] px-2 py-1 text-[11px] text-[var(--ink-primary)] hover:border-[var(--accent)] cursor-pointer"
                          >
                            浏览
                          </button>
                          <button
                            type="button"
                            onClick={() => void uninstallCourse(activeSource.source_id, course.code)}
                            className="rounded-md p-1 text-[var(--ink-muted)] hover:text-[var(--comment-red)] cursor-pointer"
                            title="清除此课程本地缓存"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={syncing || activeSource.transport === 'local-import'}
                          onClick={() => void syncCourses(activeSource.source_id, [course.code])}
                          className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-paper)] border border-[var(--border-hairline)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent)] hover:border-[var(--accent)] disabled:opacity-40 cursor-pointer"
                        >
                          <Download className="h-3 w-3" /> 同步
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Local Data Backup / Restore Card */}
      <div className="paper-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-editorial text-base font-medium text-[var(--ink-primary)]">
            本地数据备份
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async e => {
              const file = e.target.files?.[0]
              if (file) {
                try {
                  await restoreBackup(await file.text())
                } catch (err) {
                  showToast(err instanceof Error ? err.message : String(err), 'error')
                }
                e.target.value = ''
              }
            }}
          />
          <button
            type="button"
            onClick={() => void downloadBackup()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2 text-xs font-medium text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <HardDriveDownload className="h-3.5 w-3.5 text-[var(--accent)]" /> 导出备份 JSON
          </button>
          <button
            type="button"
            onClick={() => backupInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2 text-xs font-medium text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5 text-[var(--amber)]" /> 恢复备份
          </button>
        </div>
      </div>
    </div>
  )
}
