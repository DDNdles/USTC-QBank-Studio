import { motion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, CheckCircle2, Download } from 'lucide-react'
import { useStudy } from '../context/StudyContext'
import { BrandLogo } from '../components/BrandLogo'
import { RichMath } from '../components/RichMath'
import { UstcBindingLine } from '../components/UstcBindingLine'

const DISCIPLINES = [
  {
    id: 'math',
    label: '数学科学',
    image: './images/subject-math.jpg',
    match: (code: string, dept: string) =>
      dept.includes('数学') || code.startsWith('MATH') || code.startsWith('STAT') || code === '001548',
  },
  {
    id: 'physics',
    label: '物理科学',
    image: './images/subject-physics.svg',
    match: (code: string, dept: string) => dept.includes('物理') || code.startsWith('PHYS'),
  },
  {
    id: 'cs-ee',
    label: '信息与工程',
    image: './images/subject-cs.jpg',
    match: (code: string, dept: string) =>
      dept.includes('计算机') ||
      dept.includes('信息') ||
      dept.includes('工程') ||
      dept.includes('电子') ||
      code.startsWith('CS') ||
      code.startsWith('EE') ||
      code === '210070' ||
      code === '210050' ||
      code === '023181',
  },
  {
    id: 'chemistry',
    label: '化学科学',
    image: './images/subject-chemistry.jpg',
    match: (code: string, dept: string) =>
      dept.includes('化学') || code.startsWith('CHEM') || code.startsWith('019'),
  },
  {
    id: 'politics',
    label: '思想政治',
    image: './images/subject-politics.jpg',
    match: (code: string, dept: string) =>
      dept.includes('马克思') ||
      dept.includes('思政') ||
      dept.includes('政治') ||
      code.startsWith('MARX') ||
      code.startsWith('POLI'),
  },
] as const

export function HomeView() {
  const {
    sources,
    questions,
    papers,
    setActiveTab,
    setBankCourseFilter,
    syncCourses,
    syncing,
  } = useStudy()

  const official = sources.find(s => s.source_id === 'ustc-official')
  const manifestCourses = official?.manifest?.courses ?? []
  const totalCatalogQuestions = official?.manifest?.stats?.questions ?? 11710
  const installedMap = official?.installed_courses ?? {}

  const handleOpenCourse = async (code: string) => {
    if (installedMap[code]) {
      setBankCourseFilter([code])
      setActiveTab('bank')
    } else if (!syncing) {
      await syncCourses('ustc-official', [code])
      setBankCourseFilter([code])
      setActiveTab('bank')
    }
  }

  const handleOpenShelf = async (codes: string[]) => {
    const already = codes.filter(c => Boolean(installedMap[c]))
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
    <div className="mx-auto max-w-[1080px] px-5 sm:px-8 pb-32 md:pb-24">
      {/* Typora-Style Centered Opening — zero descriptive sub-copy */}
      <section className="pt-14 sm:pt-24 pb-12 sm:pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-[660px] space-y-6"
        >
          <div className="flex justify-center">
            <BrandLogo size={42} />
          </div>

          <h1 className="font-editorial text-4xl sm:text-[56px] font-medium tracking-[-0.025em] leading-[1.1] text-[var(--ink-primary)]">
            USTC QBank Studio
          </h1>

          <div className="flex items-center justify-center gap-6 pt-1">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setActiveTab(questions.length ? 'paper' : 'sources')}
              className="rounded-md bg-[var(--ink-primary)] px-6 py-2.5 text-[13.5px] font-medium text-[var(--bg-paper)] hover:opacity-88 transition-opacity cursor-pointer"
            >
              {questions.length ? '开始出卷' : '同步课程'}
            </motion.button>

            <button
              type="button"
              onClick={() => setActiveTab('bank')}
              className="text-[13.5px] text-[var(--ink-secondary)] underline decoration-[var(--border-strong)] underline-offset-[6px] hover:text-[var(--ink-primary)] hover:decoration-[var(--ink-primary)] transition-colors cursor-pointer"
            >
              浏览题库
            </button>
          </div>
        </motion.div>

        {/* Unobstructed Full-Width Print Plate */}
        <motion.figure
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.72, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 sm:mt-16"
        >
          <div className="overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-paper)] shadow-[var(--shadow-sheet)]">
            <img
              src="./images/hero-atelier.jpg"
              alt="USTC QBank Studio"
              className="w-full aspect-[16/9] object-cover block"
            />
          </div>
          <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px] font-mono-num text-[var(--ink-muted)]">
            <span>USTC-Question-Bank · v{official?.data_version ?? '0.14.0'}</span>
            <span>
              {manifestCourses.length} 门课程 · {totalCatalogQuestions.toLocaleString()} 题
            </span>
          </figcaption>
        </motion.figure>
      </section>

      <hr className="border-0 border-t border-[var(--border-hairline)]" />

      {/* Section 1: Five Illustrated Discipline Shelves (3 + 2 editorial grid, zero descriptive sub-copy) */}
      <section className="py-16 sm:py-24 space-y-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-editorial text-2xl sm:text-[30px] font-medium tracking-tight text-[var(--ink-primary)]">
            学科与课程
          </h2>
          <button
            type="button"
            onClick={() => setActiveTab('sources')}
            className="inline-flex items-center gap-1 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] cursor-pointer"
          >
            全部 {manifestCourses.length} 门课程 <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
          {DISCIPLINES.map((disc, idx) => {
            const matched = manifestCourses.filter(c => disc.match(c.code, c.department))
            const qSum = matched.reduce((sum, c) => sum + c.total, 0)
            const synced = matched.filter(c => Boolean(installedMap[c.code])).length
            const isSecondRow = idx >= 3

            return (
              <motion.article
                key={disc.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.48, delay: (idx % 3) * 0.08 }}
                whileHover={{ y: -4 }}
                className={`paper-card group rounded-2xl overflow-hidden flex flex-col ${
                  isSecondRow ? 'md:col-span-3' : 'md:col-span-2'
                }`}
              >
                <div
                  className={`relative aspect-[4/3] overflow-hidden bg-[var(--bg-subtle)] border-b border-[var(--border-hairline)] ${
                    isSecondRow ? 'md:aspect-auto md:h-[280px]' : 'md:aspect-auto md:h-[246px]'
                  }`}
                >
                  <img
                    src={disc.image}
                    alt={disc.label}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute top-3 right-3 rounded-full bg-white/85 dark:bg-[#1a1c21]/85 backdrop-blur-md px-2.5 py-1 text-[11px] font-mono-num text-[#1c1e21] dark:text-[#edece6] border border-white/60 dark:border-white/10">
                    {matched.length} 门 · {qSum.toLocaleString()} 题
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="font-editorial text-xl font-medium text-[var(--ink-primary)]">
                      {disc.label}
                    </h3>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {matched.map(course => {
                        const isSynced = Boolean(installedMap[course.code])
                        return (
                          <button
                            key={course.code}
                            type="button"
                            disabled={syncing}
                            onClick={() => void handleOpenCourse(course.code)}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] border transition-colors cursor-pointer disabled:opacity-45 ${
                              isSynced
                                ? 'border-[var(--mastered)]/30 bg-[var(--mastered-soft)] text-[var(--mastered)]'
                                : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--ink-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]'
                            }`}
                          >
                            {isSynced && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
                            <span>{course.name}</span>
                          </button>
                        )
                      })}
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
                        ? `浏览已同步（${synced}/${matched.length}）`
                        : `同步「${matched[0]?.name ?? disc.label}」`}
                    </span>
                    {synced > 0 ? <ArrowRight className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </motion.article>
            )
          })}
        </div>
      </section>

      <hr className="border-0 border-t border-[var(--border-hairline)]" />

      {/* Section 2: Live Verbatim Specimens — let the templates speak directly */}
      <section className="py-16 sm:py-24 space-y-20">
        {/* Specimen A: Verbatim ustc-exam Sheet */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.55 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
        >
          <div className="lg:col-span-4 space-y-3">
            <h2 className="font-editorial text-2xl sm:text-[28px] font-medium text-[var(--ink-primary)]">
              标准试卷
            </h2>
            <div className="font-mono-num text-xs text-[var(--ink-muted)]">
              ustc-exam · gaokao · PDF / HTML / TeX
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('paper')}
                className="inline-flex items-center gap-1 text-[13.5px] font-medium text-[var(--ink-primary)] underline decoration-[var(--border-strong)] underline-offset-[6px] hover:decoration-[var(--ink-primary)] cursor-pointer"
              >
                出卷 <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div
            onClick={() => setActiveTab('paper')}
            className="lg:col-span-8 cursor-pointer group"
          >
            <div className="paper-sheet exam-paper-render relative rounded-sm overflow-hidden pl-[64px] sm:pl-[86px] pr-5 sm:pr-10 py-7 sm:py-9 transition-transform duration-500 group-hover:-translate-y-1">
              <UstcBindingLine compact className="pointer-events-none select-none absolute left-0 top-0 h-full w-[58px] sm:w-[76px]" />
              <div className="text-center text-black">
                <div className="exam-heiti-bold text-[14.5px] sm:text-[16px]">
                  中国科学技术大学2026–2027学年第一学期
                </div>
                <div className="exam-heiti-bold text-[14.5px] sm:text-[16px] mt-0.5">
                  《数学分析(B1)》模拟试卷
                </div>
                <div className="mt-2 text-[11.5px] text-black">
                  考试时间 <span className="inline-block min-w-[74px] border-b border-black px-2">2026.11.24</span>
                  <span className="inline-block w-6" />
                  考试形式 <span className="inline-block min-w-[74px] border-b border-black px-2">闭卷</span>
                </div>
              </div>
              <table className="score-table !my-3.5 !text-[11px]">
                <tbody>
                  <tr>
                    <td className="exam-heiti-bold">题号</td><td>一</td><td>二</td><td>三</td><td className="exam-heiti-bold">总分</td>
                  </tr>
                  <tr>
                    <td className="exam-heiti-bold">满分</td><td>30</td><td>30</td><td>40</td><td>100</td>
                  </tr>
                  <tr>
                    <td className="exam-heiti-bold">得分</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                  </tr>
                </tbody>
              </table>
              <div className="text-[12.5px] sm:text-[13.5px] space-y-2.5 text-black">
                <div>
                  <span className="exam-heiti-bold">一.</span> (共30分，每小题10分) 计算与解答题
                </div>
                <div className="grid grid-cols-[2.2em_minmax(0,1fr)] items-baseline">
                  <div>(1)</div>
                  <div className="space-y-1.5">
                    <div>
                      <RichMath
                        text="求不定积分 $\int (1+\sqrt{x})^{100}\dd x$。"
                        displayMathInline
                        inlineFirstParagraph
                      />
                    </div>
                    <div>
                      <span className="exam-heiti-bold mr-[0.9em]">解</span>
                      <RichMath
                        text="令 $u = 1+\sqrt{x}$，则 $x=(u-1)^2$，$\dd x = 2(u-1)\dd u$，从而原式 $= \frac{2}{102}u^{102}-\frac{2}{101}u^{101}+C$。"
                        displayMathInline
                        inlineFirstParagraph
                      />
                    </div>
                    <div className="text-[#C01C28] text-[12px]">
                      <span className="exam-heiti-bold">点评：</span>
                      <RichMath text="作根式代换 $u = 1+\sqrt{x}$ 化为多项式积分最为简洁。" displayMathInline inlineFirstParagraph />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Specimen B: Verbatim review-classic PPT Slide */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.55 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
        >
          <div
            onClick={() => setActiveTab('ppt')}
            className="lg:col-span-8 order-2 lg:order-1 cursor-pointer group"
          >
            <div className="relative aspect-[16/9] overflow-hidden rounded-md border border-[#DAD7CE] bg-[#FAF9F5] shadow-[var(--shadow-sheet)] transition-transform duration-500 group-hover:-translate-y-1">
              <img
                src="./templates/ppt/review-classic/assets/bg-content.jpg"
                alt="review-classic"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="relative h-full p-5 sm:p-7 flex flex-col text-[#15181E]">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <img
                        src="./templates/ppt/review-classic/assets/icon-question.png"
                        alt=""
                        className="h-5 w-5 sm:h-6 sm:w-6"
                      />
                      <span className="font-mono-num text-lg sm:text-2xl font-bold text-[#1F5FC9]">01</span>
                      <span className="h-4 w-px bg-[#DAD7CE]" />
                      <span className="text-xs sm:text-sm font-bold">解答题 · 10 分</span>
                    </div>
                    <span className="text-[10px] sm:text-[11px] text-[#6B6F76]">2024 数学分析(B1) 期末</span>
                  </div>
                  <svg viewBox="0 0 600 18" className="w-full h-4 mt-2">
                    <line x1="0" y1="9" x2="36" y2="9" stroke="#1F5FC9" strokeWidth="1.6" />
                    <circle cx="46" cy="9" r="6" fill="#FAF9F5" stroke="#1F5FC9" strokeWidth="1.6" />
                    <circle cx="46" cy="9" r="2.6" fill="#1F5FC9" />
                    <line x1="56" y1="9" x2="592" y2="9" stroke="#B9B6AC" strokeWidth="1.1" strokeDasharray="3 4" />
                    {[150, 260, 370, 480, 592].map(cx => (
                      <circle key={cx} cx={cx} cy="9" r="3" fill="#FAF9F5" stroke="#B9B6AC" strokeWidth="1.2" />
                    ))}
                  </svg>
                </div>

                <div className="mt-5 sm:mt-8 space-y-2.5 text-xs sm:text-[14.5px] leading-[1.85] text-[#2B2F36]">
                  <RichMath
                    text="设 $f$ 在闭区间 $[a,b]$ 上有界。用 $\varepsilon$-$\delta$ 语言写出「$f$ 在 $[a,b]$ 上黎曼可积」的定义，并说明等分分割极限存在不足以保证可积性。"
                    displayMathInline
                  />
                  <RichMath
                    text="若进一步已知 $f$ 在 $[a,b]$ 上单调，证明 $f$ 必在 $[a,b]$ 上黎曼可积，并给出 Darboux 上下和之差 $\overline{S}(P)-\underline{S}(P)$ 的上界估计。"
                    displayMathInline
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 order-1 lg:order-2 space-y-3">
            <h2 className="font-editorial text-2xl sm:text-[28px] font-medium text-[var(--ink-primary)]">
              讲评课件
            </h2>
            <div className="font-mono-num text-xs text-[var(--ink-muted)]">
              review-classic · 16:9 · PPTX
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('ppt')}
                className="inline-flex items-center gap-1 text-[13.5px] font-medium text-[var(--ink-primary)] underline decoration-[var(--border-strong)] underline-offset-[6px] hover:decoration-[var(--ink-primary)] cursor-pointer"
              >
                PPT <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      <hr className="border-0 border-t border-[var(--border-hairline)]" />

      {/* Minimal Single-Line Footer */}
      <footer className="pt-10 flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--ink-muted)]">
        <div className="flex flex-wrap items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('paper')}
            className="hover:text-[var(--ink-primary)] cursor-pointer"
          >
            试卷 ({papers.length})
          </button>
          <a
            href="https://github.com/DDNdles/USTC-Question-Bank"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--ink-primary)] inline-flex items-center gap-1"
          >
            USTC-Question-Bank <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
        <span className="font-mono-num">MIT</span>
      </footer>
    </div>
  )
}
