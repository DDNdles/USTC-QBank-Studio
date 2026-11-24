import { motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  Download,
  FileText,
  Layers,
  Presentation,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { useStudy } from '../context/StudyContext'

const SUBJECT_SHELVES = [
  {
    id: 'math',
    title: '数学科学',
    subtitle: '数学分析 · 线性代数 · 复变函数 · 概率统计',
    image: './images/subject-math.jpg',
    match: (code: string, dept: string) =>
      dept.includes('数学') || code.startsWith('MATH') || code.startsWith('STAT') || code === '001548',
  },
  {
    id: 'physics',
    title: '物理科学',
    subtitle: '力学 · 热学 · 电磁学 · 光学 · 原子物理',
    image: './images/subject-physics.svg',
    match: (code: string, dept: string) => dept.includes('物理') || code.startsWith('PHYS'),
  },
  {
    id: 'cs-ee',
    title: '信息与工程',
    subtitle: '程序设计 · 计算机原理与嵌入式 · 信号与电路',
    image: './images/subject-cs.svg',
    match: (code: string, dept: string) =>
      !dept.includes('数学') &&
      !dept.includes('物理') &&
      !code.startsWith('MATH') &&
      !code.startsWith('STAT') &&
      !code.startsWith('PHYS') &&
      code !== '001548',
  },
]

const CAPABILITIES = [
  {
    id: 'paper' as const,
    icon: FileText,
    eyebrow: '01 · 试卷排版',
    title: '中科大 & 高考标准版式',
    desc: '支持奇数页密封装订线、动态得分表、黑体解/证明与红字易错点评。原生打印高清 PDF，同时提供离线 HTML 与 XeLaTeX (.tex) 源码直出。',
  },
  {
    id: 'ppt' as const,
    icon: Presentation,
    eyebrow: '02 · 讲评课件',
    title: '16:9 讲评 PPTX 与在线放映厅',
    desc: '沿袭经典流线型题目进度轨道与素雅棉纸底纹，内置 MathJax 矢量公式混排、长解析自动分页与完整演讲者备注，一键导出 .pptx。',
  },
  {
    id: 'mistakes' as const,
    icon: RotateCcw,
    eyebrow: '03 · 间隔重复',
    title: 'SM-2 错题本与闪卡复盘',
    desc: '按艾宾浩斯 / SM-2 算法调度每日待复习卡片，记录错因标签与反思，一键将高频错题与同知识点举一反三题组合成巩固卷。',
  },
  {
    id: 'sources' as const,
    icon: ShieldCheck,
    eyebrow: '04 · 开放协议',
    title: '按需同步 · SHA-256 完整性校验',
    desc: '直连 DDNdles/USTC-Question-Bank 公开题库与 CDN 加速镜像，按课程按需缓存至浏览器 IndexedDB，亦支持导入私有 v1.0 题库目录。',
  },
]

export function HomeView() {
  const {
    sources,
    questions,
    papers,
    mistakes,
    setActiveTab,
    setBankCourseFilter,
    syncCourses,
    syncing,
  } = useStudy()

  const official = sources.find(s => s.source_id === 'ustc-official')
  const manifestCourses = official?.manifest?.courses ?? []
  const totalCatalogQuestions = official?.manifest?.stats?.questions ?? 8283
  const installedCount = Object.keys(official?.installed_courses ?? {}).length

  const handleOpenShelf = async (codes: string[]) => {
    const installedSet = new Set(Object.keys(official?.installed_courses ?? {}))
    const already = codes.filter(c => installedSet.has(c))
    if (already.length > 0) {
      setBankCourseFilter(already)
      setActiveTab('bank')
    } else if (codes.length > 0 && !syncing) {
      await syncCourses('ustc-official', [codes[0]])
      setBankCourseFilter([codes[0]])
      setActiveTab('bank')
    } else {
      setActiveTab('sources')
    }
  }

  return (
    <div className="mx-auto max-w-[1220px] px-4 sm:px-6 pb-28 md:pb-16">
      {/* Typora-Inspired Editorial Hero */}
      <section className="pt-8 sm:pt-14 pb-12 sm:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6 space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-paper)] px-3 py-1 text-xs text-[var(--ink-secondary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <span>零模型依赖 · 纯浏览器离线引擎 · v{official?.data_version ?? '0.11.0'}</span>
            </div>

            <h1 className="font-editorial text-4xl sm:text-[50px] font-semibold tracking-tight leading-[1.14] text-[var(--ink-primary)]">
              安静排一卷好题，
              <br />
              <span className="text-[var(--accent)]">所见即所得</span> 的科大题库工坊。
            </h1>

            <p className="text-[15px] sm:text-base leading-relaxed text-[var(--ink-secondary)] max-w-xl">
              把{' '}
              <code className="font-mono-num text-[13px] px-1.5 py-0.5 rounded bg-[var(--bg-subtle)]">
                USTC-Question-Bank
              </code>{' '}
              的真题资产与{' '}
              <code className="font-mono-num text-[13px] px-1.5 py-0.5 rounded bg-[var(--bg-subtle)]">
                dsh-study
              </code>{' '}
              的非模型排版能力带入浏览器：点选课程与知识点，即刻生成中科大标准试卷、XeLaTeX 源码、16:9 讲评 PPTX 与 SM-2 错题复习计划。
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setActiveTab(questions.length ? 'paper' : 'sources')}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--ink-primary)] px-6 py-2.5 text-sm font-medium text-[var(--bg-paper)] shadow-sm hover:opacity-92 transition-opacity cursor-pointer"
              >
                <span>{questions.length ? '进入试卷工坊' : '同步首门课程开始'}</span>
                <ArrowRight className="h-4 w-4" />
              </motion.button>

              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setActiveTab('bank')}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-paper)] px-5 py-2.5 text-sm font-medium text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
              >
                <BookOpen className="h-4 w-4 text-[var(--ink-secondary)]" />
                <span>浏览题库</span>
              </motion.button>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t border-[var(--border-hairline)] pt-5 max-w-md">
              <div>
                <div className="font-mono-num text-xl sm:text-2xl font-semibold text-[var(--ink-primary)]">
                  {manifestCourses.length}
                </div>
                <div className="text-xs text-[var(--ink-muted)] mt-0.5">收录公开课程</div>
              </div>
              <div>
                <div className="font-mono-num text-xl sm:text-2xl font-semibold text-[var(--ink-primary)]">
                  {totalCatalogQuestions.toLocaleString()}
                </div>
                <div className="text-xs text-[var(--ink-muted)] mt-0.5">结构化真题与解析</div>
              </div>
              <div>
                <div className="font-mono-num text-xl sm:text-2xl font-semibold text-[var(--accent)]">
                  {questions.length.toLocaleString()}
                </div>
                <div className="text-xs text-[var(--ink-muted)] mt-0.5">本机已离线缓存</div>
              </div>
            </div>
          </motion.div>

          {/* Editorial Framed Hero Artwork */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6"
          >
            <div className="paper-card rounded-2xl overflow-hidden p-2 sm:p-2.5">
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[var(--bg-subtle)]">
                <img
                  src="./images/hero-atelier.jpg"
                  alt="USTC QBank Studio 纸韵桌面静物插画"
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-white/85 dark:bg-[#1a1c21]/85 backdrop-blur-md border border-white/60 dark:border-white/10 px-3.5 py-2 text-xs text-[#1c1e21] dark:text-[#edece6]">
                  <span className="flex items-center gap-2 font-medium truncate">
                    <Layers className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                    <span className="truncate">
                      已同步 {installedCount} 门课程 · {papers.length} 份试卷 · {mistakes.length} 条错题
                    </span>
                  </span>
                  <span className="font-mono-num text-[11px] opacity-75 shrink-0">IndexedDB</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="h-px w-full bg-[var(--border-hairline)]" />

      {/* Discipline Gallery with AI-Generated Fine-Art Covers */}
      <section className="py-12 sm:py-16 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="font-mono-num text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              ACADEMIC ARCHIVE
            </div>
            <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[var(--ink-primary)] mt-1">
              三大学科书架
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('sources')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer self-start sm:self-auto"
          >
            <span>查看全部 {manifestCourses.length} 门课程与同步状态</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SUBJECT_SHELVES.map((shelf, idx) => {
            const matched = manifestCourses.filter(c => shelf.match(c.code, c.department))
            const qSum = matched.reduce((s, c) => s + c.total, 0)
            const synced = matched.filter(c => Boolean(official?.installed_courses[c.code])).length

            return (
              <motion.article
                key={shelf.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.48, delay: idx * 0.08 }}
                whileHover={{ y: -4 }}
                className="paper-card group rounded-2xl overflow-hidden flex flex-col"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[var(--bg-subtle)] border-b border-[var(--border-hairline)]">
                  <img
                    src={shelf.image}
                    alt={shelf.title}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute top-3 right-3 rounded-full bg-white/85 dark:bg-[#1a1c21]/85 backdrop-blur-md px-2.5 py-1 text-[11px] font-mono-num text-[#1c1e21] dark:text-[#edece6] border border-white/60 dark:border-white/10">
                    {matched.length} 门 · {qSum.toLocaleString()} 题
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="font-editorial text-xl font-semibold text-[var(--ink-primary)]">
                      {shelf.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--ink-secondary)]">
                      {shelf.subtitle}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {matched.slice(0, 4).map(c => {
                        const isSynced = Boolean(official?.installed_courses[c.code])
                        return (
                          <span
                            key={c.code}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] border ${
                              isSynced
                                ? 'border-[var(--mastered)]/30 bg-[var(--mastered-soft)] text-[var(--mastered)]'
                                : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--ink-secondary)]'
                            }`}
                          >
                            {isSynced && <CheckCircle2 className="h-2.5 w-2.5" />}
                            {c.name}
                          </span>
                        )
                      })}
                      {matched.length > 4 && (
                        <span className="rounded-md px-1.5 py-0.5 text-[11px] text-[var(--ink-muted)]">
                          +{matched.length - 4}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={syncing}
                    onClick={() => void handleOpenShelf(matched.map(c => c.code))}
                    className="inline-flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2 text-xs font-medium text-[var(--ink-primary)] hover:border-[var(--accent-border)] hover:text-[var(--accent)] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span>
                      {synced > 0
                        ? `浏览已同步课程（${synced}/${matched.length}）`
                        : `一键体验同步「${matched[0]?.name ?? shelf.title}」`}
                    </span>
                    {synced > 0 ? <ArrowRight className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </motion.article>
            )
          })}
        </div>
      </section>

      <div className="h-px w-full bg-[var(--border-hairline)]" />

      {/* Editorial Capability Grid */}
      <section className="py-12 sm:py-16 space-y-8">
        <div className="max-w-xl">
          <div className="font-mono-num text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            WORKFLOW ATELIER
          </div>
          <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-[var(--ink-primary)] mt-1">
            无需大模型，专注极致学习排版
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-secondary)] leading-relaxed">
            所有题库检索、组卷算法、KaTeX/MathJax 渲染、PPTX 打包与 SM-2 记忆调度均在本地浏览器完成，零等待、零 API 成本、完全离线可用。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {CAPABILITIES.map((cap, idx) => {
            const Icon = cap.icon
            return (
              <motion.button
                key={cap.id}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.42, delay: idx * 0.06 }}
                whileHover={{ y: -2 }}
                onClick={() => setActiveTab(cap.id)}
                className="paper-card group text-left rounded-2xl p-6 transition-colors hover:border-[var(--border-strong)] cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-num text-[11px] tracking-wider text-[var(--ink-muted)]">
                    {cap.eyebrow}
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--ink-secondary)] group-hover:bg-[var(--accent-soft)] group-hover:text-[var(--accent)] transition-colors">
                    <Icon className="h-4 w-4" strokeWidth={1.85} />
                  </div>
                </div>
                <h3 className="font-editorial text-lg font-semibold text-[var(--ink-primary)] mt-3">
                  {cap.title}
                </h3>
                <p className="mt-2 text-xs sm:text-[13px] leading-relaxed text-[var(--ink-secondary)]">
                  {cap.desc}
                </p>
                <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] opacity-85 group-hover:opacity-100">
                  <span>打开工作台</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </motion.button>
            )
          })}
        </div>
      </section>

      <footer className="border-t border-[var(--border-hairline)] pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[var(--ink-muted)]">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5" />
          <span>
            数据来源：
            <a
              href="https://github.com/DDNdles/USTC-Question-Bank"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--ink-secondary)] hover:text-[var(--accent)] underline-offset-2 hover:underline"
            >
              DDNdles/USTC-Question-Bank
            </a>
            {' · '}本站点不内置题目版权内容，由浏览器运行时按需拉取
          </span>
        </div>
        <div className="font-mono-num">MIT License · Static GitHub Pages</div>
      </footer>
    </div>
  )
}
