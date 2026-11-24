import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
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
    image: './images/subject-cs.svg',
    match: (code: string, dept: string) =>
      !dept.includes('数学') &&
      !dept.includes('物理') &&
      !code.startsWith('MATH') &&
      !code.startsWith('STAT') &&
      !code.startsWith('PHYS') &&
      code !== '001548',
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

  const [activeDisciplineId, setActiveDisciplineId] = useState<string>('math')

  const official = sources.find(s => s.source_id === 'ustc-official')
  const manifestCourses = official?.manifest?.courses ?? []
  const totalCatalogQuestions = official?.manifest?.stats?.questions ?? 8283
  const installedMap = official?.installed_courses ?? {}

  const activeDiscipline =
    DISCIPLINES.find(d => d.id === activeDisciplineId) ?? DISCIPLINES[0]

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
            <span>USTC-Question-Bank · v{official?.data_version ?? '0.11.0'}</span>
            <span>
              {manifestCourses.length} 门课程 · {totalCatalogQuestions.toLocaleString()} 题
            </span>
          </figcaption>
        </motion.figure>
      </section>

      <hr className="border-0 border-t border-[var(--border-hairline)]" />

      {/* Section 1: Asymmetric Swiss Discipline Index */}
      <section className="py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-5">
          <h2 className="font-editorial text-2xl sm:text-[30px] font-medium tracking-tight text-[var(--ink-primary)]">
            学科与课程
          </h2>

          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)]">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeDiscipline.id}
                src={activeDiscipline.image}
                alt={activeDiscipline.label}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="h-full w-full object-cover"
              />
            </AnimatePresence>
          </div>
        </div>

        <div className="lg:col-span-7 divide-y divide-[var(--border-hairline)] border-t border-b border-[var(--border-hairline)]">
          {DISCIPLINES.map(disc => {
            const matched = manifestCourses.filter(c => disc.match(c.code, c.department))
            const qSum = matched.reduce((sum, c) => sum + c.total, 0)
            const isActive = activeDisciplineId === disc.id

            return (
              <div
                key={disc.id}
                onMouseEnter={() => setActiveDisciplineId(disc.id)}
                onClick={() => setActiveDisciplineId(disc.id)}
                className={`py-7 transition-opacity ${isActive ? 'opacity-100' : 'opacity-75 hover:opacity-100'}`}
              >
                <div className="flex items-baseline justify-between gap-4 mb-4">
                  <h3 className="font-editorial text-xl font-medium text-[var(--ink-primary)]">
                    {disc.label}
                  </h3>
                  <span className="font-mono-num text-xs text-[var(--ink-muted)]">
                    {matched.length} · {qSum.toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                  {matched.map(course => {
                    const cached = Boolean(installedMap[course.code])
                    return (
                      <button
                        key={course.code}
                        type="button"
                        disabled={syncing}
                        onClick={e => {
                          e.stopPropagation()
                          void handleOpenCourse(course.code)
                        }}
                        className="group inline-flex items-baseline gap-1.5 text-left text-[13.5px] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] transition-colors cursor-pointer disabled:opacity-45"
                      >
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full self-center ${
                            cached ? 'bg-[var(--mastered)]' : 'bg-[var(--border-strong)] group-hover:bg-[var(--accent)]'
                          }`}
                        />
                        <span className="group-hover:underline underline-offset-4">
                          {course.name}
                        </span>
                        <span className="font-mono-num text-[11px] text-[var(--ink-muted)]">
                          {course.total}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <div className="py-5 flex items-center justify-end text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('sources')}
              className="inline-flex items-center gap-1 text-[var(--ink-primary)] hover:text-[var(--accent)] cursor-pointer"
            >
              管理题库源 <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
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
              <div className="relative h-full p-5 sm:p-7 flex flex-col justify-between text-[#15181E]">
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

                <div className="text-xs sm:text-[14px] leading-relaxed text-[#2B2F36] pb-3">
                  <RichMath text="设 $f$ 在闭区间 $[a,b]$ 上有界。用 $\varepsilon$-$\delta$ 语言写出「$f$ 在 $[a,b]$ 上黎曼可积」的定义，并说明等分分割极限存在不足以保证可积性。" />
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
