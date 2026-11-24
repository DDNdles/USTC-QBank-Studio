import katex from 'katex'
import ustcTemplateTex from '../templates/pdf/ustc-exam/template.tex?raw'
import gaokaoTemplateTex from '../templates/pdf/gaokao/template.tex?raw'
import type {
  PaperHeaderMeta,
  PaperItem,
  PdfExportMode,
  PdfTemplateId,
  QuestionRecord,
  SavedPaper,
  SourceConfig,
} from '../types/study'
import { chineseNumber, sectionTitleForType } from './paperAssembler'
import { resolveFigureUrl } from '../services/sourceSync'

export const MATH_SPLIT_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g

export interface GroupedSection {
  key: string
  title: string
  items: PaperItem[]
  score: number
}

export function currentAcademicTerm(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (month >= 8) return `${year}--${year + 1}学年第一学期`
  if (month <= 1) return `${year - 1}--${year}学年第一学期`
  return `${year - 1}--${year}学年第二学期`
}

export function formatDateDots(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}.${m}.${d}`
}

export function buildPdfFields(
  paper: SavedPaper,
  overrides: Partial<PaperHeaderMeta> = {},
): PaperHeaderMeta {
  const term = currentAcademicTerm()
  return {
    schoolTerm: overrides.schoolTerm ?? paper.header_meta?.schoolTerm ?? `中国科学技术大学${term}`,
    courseTitle: overrides.courseTitle ?? paper.header_meta?.courseTitle ?? paper.title,
    examDate: overrides.examDate ?? paper.header_meta?.examDate ?? formatDateDots(),
    examForm: overrides.examForm ?? paper.header_meta?.examForm ?? '闭卷',
    footerTerm: overrides.footerTerm ?? paper.header_meta?.footerTerm ?? term,
    subject: overrides.subject ?? paper.header_meta?.subject ?? paper.course_names?.[0] ?? '数学',
    showBindingLine: overrides.showBindingLine ?? paper.header_meta?.showBindingLine ?? true,
    writeSpace: overrides.writeSpace ?? paper.header_meta?.writeSpace ?? 'standard',
  }
}

export function cleanSectionTitle(raw: string | undefined, fallbackType?: string): string {
  let text = String(raw ?? '').trim()
  if (!text || text === '题目') return sectionTitleForType(fallbackType ?? 'solve')
  text = text
    .replace(/^(?:第\s*[一二三四五六七八九十百\d]+\s*(?:部分|大题|节)\s*[：:、.．\s]*)/u, '')
    .replace(/^(?:[（(]\s*[一二三四五六七八九十百\d]+\s*[)）]\s*[：:、.．\s]*)/u, '')
    .replace(/^(?:[一二三四五六七八九十]+(?:\s*[、.．:：]\s*|\s+))/u, '')
    .replace(/^(?:\d+\s*[、.．:：]\s*)/u, '')
    .trim()
  const scoreParenRe = /\s*[（(][^）)]*(?:每\s*(?:小)?题|共\s*\d+|本大题|\d+(?:\.\d+)?\s*分|\d+\s*(?:小)?题)[^）)]*[)）]\s*$/u
  while (scoreParenRe.test(text)) {
    text = text.replace(scoreParenRe, '').trim()
  }
  text = text
    .replace(/[\s，,、;；]*(?:本大题)?(?:共\s*\d+\s*(?:小)?题[\s，,]*)?(?:每\s*(?:小)?题\s*\d+(?:\.\d+)?\s*分[\s，,]*)?(?:共\s*\d+(?:\.\d+)?\s*分)\s*$/u, '')
    .trim()
  return text || sectionTitleForType(fallbackType ?? 'solve')
}

export function groupItems(items: PaperItem[]): GroupedSection[] {
  const groups: GroupedSection[] = []
  for (const item of items) {
    const key = cleanSectionTitle(item.section_title, item.question?.type)
    let group = groups[groups.length - 1]
    if (!group || group.key !== key) {
      group = { key, title: key, items: [], score: 0 }
      groups.push(group)
    }
    group.items.push(item)
    group.score += Number(item.score) || 0
  }
  return groups
}

export function formatSectionScore(group: GroupedSection): string {
  const n = group.items.length
  const uniform = n > 1 && group.items.every(it => Number(it.score) === Number(group.items[0].score))
  if (uniform) return `共${group.score}分，每小题${group.items[0].score}分`
  return `共${group.score}分`
}

export function shouldShowAnswerLine(question: QuestionRecord): boolean {
  const ans = String(question.answer?.md ?? '').trim()
  const sol = String(question.solution?.md ?? '').trim()
  if (!ans) return false
  if (question.type === 'proof' && sol && ans.length > 80) return false
  if (sol && ans.replace(/\s+/g, '').toLowerCase() === sol.replace(/\s+/g, '').toLowerCase()) return false
  return true
}

export function resolveSolutionText(question: QuestionRecord): string {
  const md = String(question.solution?.md ?? '').trim()
  if (md) return md
  const steps = question.solution?.steps ?? []
  if (steps.length) return steps.map((s, i) => `(${i + 1}) ${s}`).join('\n')
  return ''
}

export function buildCommentText(item: PaperItem, question: QuestionRecord): string {
  const parts: string[] = []
  if (item.comment_md) parts.push(item.comment_md)
  if (question.quality?.note && question.quality.note !== item.comment_md) {
    parts.push(question.quality.note)
  }
  if (question.answer?.origin === 'ai') {
    parts.push('本题含 AI 推导或变式，请注意核验。')
  }
  return parts.join('；')
}

export function stripMathDelimiters(token: string): string {
  if (token.startsWith('$$') && token.endsWith('$$')) return token.slice(2, -2).trim()
  if (token.startsWith('\\[') && token.endsWith('\\]')) return token.slice(2, -2).trim()
  if (token.startsWith('\\(') && token.endsWith('\\)')) return token.slice(2, -2).trim()
  if (token.startsWith('$') && token.endsWith('$')) return token.slice(1, -1).trim()
  return token
}

export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function extractChoiceKey(answerMd: string | undefined): string {
  const match = String(answerMd ?? '').match(/[A-D]{1,4}/)
  return match ? match[0] : ''
}

function renderInlineMarkdownHtml(line: string): string {
  return String(line ?? '')
    .split(MATH_SPLIT_RE)
    .map(part => {
      if ((part.startsWith('$') && part.endsWith('$')) || part.startsWith('\\[') || part.startsWith('\\(')) {
        const display = part.startsWith('$$') || part.startsWith('\\[')
        const math = stripMathDelimiters(part)
        try {
          return katex.renderToString(math, { displayMode: display, throwOnError: false, trust: false })
        } catch {
          return `<code>${escapeHtml(math)}</code>`
        }
      }
      return escapeHtml(part)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
    })
    .join('')
}

export function renderMarkdownToHtml(markdown: string): string {
  const raw = String(markdown ?? '').trim()
  if (!raw) return ''
  const blocks: string[] = []
  const placeholdered = raw.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g, match => {
    const idx = blocks.length
    blocks.push(match)
    return `@@MATHBLOCK_${idx}@@`
  })

  const paragraphs = placeholdered.split(/\r?\n\s*\r?\n/)
  const html = paragraphs
    .map(para => {
      const lines = para.split(/\r?\n/)
      if (lines.length >= 2 && lines[0].includes('|') && /^\s*\|?[\s:-]+\|/.test(lines[1])) {
        const rows = lines
          .filter((_, idx) => idx !== 1)
          .map(l =>
            l
              .replace(/^\s*\||\|\s*$/g, '')
              .split('|')
              .map(c => renderInlineMarkdownHtml(c.trim())),
          )
        if (rows.length) {
          const head = `<thead><tr>${rows[0].map(c => `<th>${c}</th>`).join('')}</tr></thead>`
          const body = rows
            .slice(1)
            .map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`)
            .join('')
          return `<table>${head}<tbody>${body}</tbody></table>`
        }
      }
      return `<p>${lines.map(l => renderInlineMarkdownHtml(l)).join('<br />')}</p>`
    })
    .join('')

  return html.replace(/@@MATHBLOCK_(\d+)@@/g, (_, idxStr) => {
    const token = blocks[Number(idxStr)] ?? ''
    const math = stripMathDelimiters(token)
    try {
      return katex.renderToString(math, { displayMode: true, throwOnError: false, trust: false })
    } catch {
      return `<pre>${escapeHtml(math)}</pre>`
    }
  })
}

// ============================================================================
// Verbatim dsh-study Printable HTML (mirroring dsh-study/src/host/render.js)
// ============================================================================

export function buildStandaloneExamHtml(
  paper: SavedPaper,
  templateId: PdfTemplateId,
  mode: PdfExportMode,
  fields: PaperHeaderMeta,
  sourceMap: Record<string, SourceConfig>,
): string {
  const isGaokao = templateId === 'gaokao'
  const writeSpace = { compact: '3cm', standard: '5.5cm', spacious: '7cm' }[fields.writeSpace] ?? '5.5cm'
  const totalScore = paper.items.reduce((s, it) => s + Number(it.score || 0), 0)

  const outputs =
    mode === 'split'
      ? [
          { name: 'paper', showSolutions: false, answerOnly: false },
          { name: 'answers', showSolutions: true, answerOnly: true },
        ]
      : [{ name: 'inline', showSolutions: true, answerOnly: false }]

  const renderFigs = (item: PaperItem, figs: { path: string; alt?: string | null }[] | undefined) => {
    if (!figs?.length) return ''
    const src = sourceMap[item.source_id]
    return figs
      .map(f => {
        const url = resolveFigureUrl(src, item.question.course_code, f.path)
        if (!url) return ''
        return `<figure class="q-fig"><img src="${escapeHtml(url)}" alt="${escapeHtml(f.alt || '题图')}" /></figure>`
      })
      .join('')
  }

  const pagesHtml = outputs
    .map(output => {
      const groups = groupItems(paper.items)
      let seq = 0
      const sectionHtml = groups
        .map((group, secIdx) => {
          const itemsHtml = group.items
            .map(item => {
              seq++
              const q = item.question
              const prompt = output.answerOnly
                ? ''
                : `<div class="stem rich-math">${renderMarkdownToHtml(q.stem.md)}</div>${renderFigs(item, q.stem.figures)}`
              const options =
                output.answerOnly || !q.options?.length
                  ? ''
                  : `<div class="options">${q.options
                      .map(opt => `<div><strong>${escapeHtml(opt.key)}.</strong> ${renderMarkdownToHtml(opt.md)}</div>`)
                      .join('')}</div>`
              const solText = resolveSolutionText(q)
              const comment = buildCommentText(item, q)
              const solution = output.showSolutions
                ? `<section class="solution">
                    ${shouldShowAnswerLine(q) ? `<div class="ans-line"><strong>答案：</strong>${renderMarkdownToHtml(q.answer.md)}</div>` : ''}
                    ${solText ? `<div class="sol-body"><strong>${q.type === 'proof' ? '证明' : '解'}</strong>　${renderMarkdownToHtml(solText)}${renderFigs(item, q.solution.figures)}</div>` : ''}
                    ${comment ? `<p class="comment"><strong>点评：</strong>${renderMarkdownToHtml(comment)}</p>` : ''}
                  </section>`
                : q.type === 'solve' || q.type === 'proof'
                  ? '<div class="answer-space"></div>'
                  : ''
              return `<article class="q-item"><div class="q-no">${isGaokao ? `${seq}.` : `(${seq})`} ${output.answerOnly ? '' : `<span class="q-score">（${item.score} 分）</span>`}</div>${prompt}${options}${solution}</article>`
            })
            .join('')

          return `<section class="exam-section"><h2>${chineseNumber(secIdx + 1)}.（${formatSectionScore(group)}）${escapeHtml(group.title)}</h2>${itemsHtml}</section>`
        })
        .join('')

      const scoreTableHtml =
        !isGaokao && !output.answerOnly
          ? `<table class="score-table">
              <tr><td><strong>题号</strong></td>${groups.map((_, i) => `<td>${chineseNumber(i + 1)}</td>`).join('')}<td><strong>总分</strong></td></tr>
              <tr><td><strong>满分</strong></td>${groups.map(g => `<td>${g.score}</td>`).join('')}<td>${totalScore}</td></tr>
              <tr><td><strong>得分</strong></td>${groups.map(() => '<td>&nbsp;</td>').join('')}<td>&nbsp;</td></tr>
            </table>`
          : ''

      const gaokaoNotice =
        isGaokao && !output.answerOnly
          ? `<div class="notice">
              <div class="secret">绝密 ★ 启用前</div>
              <ol>
                <li>答卷前，考生务必将自己的姓名、学号或准考证号填写清楚。</li>
                <li>客观题请在括号内填涂正确选项；非选择题应写出必要的文字说明、证明过程或演算步骤。</li>
                <li>本试卷共 ${paper.items.length} 题，满分 ${totalScore} 分。</li>
              </ol>
            </div>`
          : ''

      return `<section class="page">
        <header class="exam-header">
          ${!isGaokao ? `<div class="school-term">${escapeHtml(fields.schoolTerm)}</div>` : ''}
          <div class="course-title">${escapeHtml(fields.courseTitle)}${output.answerOnly ? '——参考答案与解析' : ''}</div>
          ${!isGaokao ? `<div class="meta-line">考试时间 <u>${escapeHtml(fields.examDate)}</u>　　考试形式 <u>${escapeHtml(fields.examForm)}</u></div>` : ''}
        </header>
        ${gaokaoNotice}
        ${scoreTableHtml}
        ${sectionHtml}
      </section>`
    })
    .join('')

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css"><title>${escapeHtml(paper.title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"><style>
  body{font-family:"Songti SC","Noto Serif CJK SC","SimSun","Microsoft YaHei",serif;color:#111827;background:#f3f4f6;margin:0;padding:20px;line-height:1.8;font-size:15px}
  .page{background:#fff;max-width:820px;margin:0 auto 24px;padding:40px 48px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .exam-header{text-align:center;margin-bottom:20px}
  .school-term,.course-title{font-family:"Microsoft YaHei","SimHei",sans-serif;font-size:20px;font-weight:700;line-height:1.5}
  .meta-line{margin-top:8px;font-size:14px;color:#374151}
  .meta-line u{text-decoration:none;border-bottom:1px solid #374151;padding:0 16px}
  .notice{border:1px solid #d1d5db;padding:10px 18px;margin-bottom:18px;font-size:13.5px}
  .secret{font-weight:700;letter-spacing:.18em;margin-bottom:4px}
  table.score-table{border-collapse:collapse;margin:16px auto 24px;font-size:14px}
  table.score-table td{border:1px solid #374151;padding:6px 16px;text-align:center;min-width:34px}
  h2{font-family:"Microsoft YaHei","SimHei",sans-serif;font-size:15.5px;font-weight:700;margin:22px 0 12px}
  .q-item{margin-bottom:16px}.q-no{font-weight:600;margin-bottom:4px}.q-score{font-weight:400;color:#6b7280;font-size:13px}
  .options{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:8px 0 8px 18px}
  .q-fig{text-align:center;margin:10px 0}.q-fig img{max-width:72%;max-height:220px;object-fit:contain}
  .solution{margin-top:10px;padding-left:4px}.ans-line{margin-bottom:6px}.comment{color:#c01c28;margin:8px 0 0}
  .answer-space{height:${writeSpace}}
  @media print{body{background:#fff;padding:0}.page{box-shadow:none;margin:0;padding:12mm 16mm;break-after:page}.page:last-child{break-after:auto}.q-item{break-inside:avoid}}
  </style></head><body>${pagesHtml}</body></html>`
}

// ============================================================================
// Verbatim dsh-study LaTeX Builder (uses unmodified template.tex files!)
// ============================================================================

function latexText(value: string): string {
  return String(value ?? '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([#$%&_{}])/g, '\\$1')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}')
}

function sanitizeMath(value: string): string {
  let out = String(value).replace(
    /\\(?:input|include|includeonly|openout|write|write18|read|readline|catcode|csname|usepackage|documentclass|newcommand|renewcommand|def|gdef|loop|special)\b/gi,
    '\\text{[blocked]}',
  )
  out = out.replace(/(?<!\\text\{)([\u4e00-\u9fff，。；：、！？（）【】《》“”‘’]+)/g, '\\text{$1}')
  return out
}

function convertTextFormatting(text: string): string {
  const parts = String(text ?? '').split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g)
  return parts
    .map(part => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return `\\textbf{${latexText(part.slice(2, -2))}}`
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return `\\emph{${latexText(part.slice(1, -1))}}`
      }
      return latexText(part)
    })
    .join('')
}

function convertInlineLatex(text: string): string {
  return String(text ?? '')
    .split(MATH_SPLIT_RE)
    .map(token => {
      if ((token.startsWith('$') && token.endsWith('$')) || token.startsWith('\\[') || token.startsWith('\\(')) {
        const display = token.startsWith('$$') || token.startsWith('\\[')
        const math = sanitizeMath(stripMathDelimiters(token))
        if (/\\begin\{(?:align|align\*|gather|gather\*|multline|multline\*|equation|equation\*)\}/.test(math)) {
          return `\n${math}\n`
        }
        return display ? `\n\\[${math}\\]\n` : `\\(${math}\\)`
      }
      return convertTextFormatting(token)
    })
    .join('')
}

function markdownTableToLatex(lines: string[]): string {
  const rows = lines
    .filter((_, idx) => idx !== 1)
    .map(line =>
      line
        .replace(/^\s*\||\|\s*$/g, '')
        .split('|')
        .map(cell => convertInlineLatex(cell.trim())),
    )
    .filter(cells => cells.length > 0)
  if (!rows.length) return ''
  const cols = Math.max(...rows.map(r => r.length))
  const colSpec = `|${'c|'.repeat(cols)}`
  const body = rows
    .map(r => {
      const padded = [...r, ...Array(Math.max(0, cols - r.length)).fill('')]
      return `${padded.join(' & ')} \\\\ \\hline`
    })
    .join('\n')
  const inner = `\\begin{tabular}{${colSpec}}\\hline\n${body}\n\\end{tabular}`
  return cols >= 5 ? `\\begin{center}\\resizebox{\\linewidth}{!}{${inner}}\\end{center}` : `\\begin{center}${inner}\\end{center}`
}

function renderMarkdownToLatex(markdown: string, breakInlineSubItems = false): string {
  let raw = String(markdown ?? '').trim()
  if (!raw) return ''
  if (breakInlineSubItems) {
    const heavyMathCount = (raw.match(/\\(?:int|sum|lim|frac|dfrac|prod|sqrt)\b/g) ?? []).length
    const hasSubItems = /[（(]2[）)]/.test(raw)
    if (heavyMathCount >= 2 && hasSubItems && !raw.includes('\n')) {
      raw = raw
        .replace(/\s*([：:;；。])\s*([（(][1-9][）)])/g, '$1\n$2 ')
        .replace(/^\s*([^（(\n]{2,20})\s*([（(]1[）)])/g, '$1\n$2 ')
    }
  }
  return raw
    .split(/\r?\n\s*\r?\n/)
    .map(para => {
      const lines = para.split(/\r?\n/)
      if (lines.length >= 2 && lines[0].includes('|') && /^\s*\|?[\s:-]+\|/.test(lines[1])) {
        return markdownTableToLatex(lines)
      }
      return lines.map(line => convertInlineLatex(line)).join('\\\\\n')
    })
    .join('\n\\par\\smallskip\n')
}

function buildPreamble(
  isGaokao: boolean,
  source: string,
  fields: PaperHeaderMeta,
  output: { showSolutions: boolean; answerOnly: boolean },
): string {
  if (isGaokao) {
    return source
      .replace('__DSH_SHOW_ANSWER__', output.showSolutions ? 'true' : 'false')
      .replace('__DSH_SOLUTION_MODE__', output.showSolutions ? 'show-stay' : 'hide')
      .replace('__DSH_TITLE__', latexText(fields.courseTitle))
      .replace('__DSH_SUBJECT__', latexText(fields.subject))
  }
  const marker = source.indexOf('% Dynamic question and answer content')
  const base = marker >= 0 ? source.slice(0, marker) : source
  return base
    .replace('__DSH_EXAM_SCHOOL_TERM__', latexText(fields.schoolTerm))
    .replace('__DSH_EXAM_COURSE_TITLE__', latexText(fields.courseTitle))
    .replace('__DSH_EXAM_DATE__', latexText(fields.examDate))
    .replace('__DSH_EXAM_FORM__', latexText(fields.examForm))
    .replace('__DSH_EXAM_FOOTER_TERM__', latexText(fields.footerTerm))
    .replace('\\ShowBindingLinetrue', `\\ShowBindingLine${fields.showBindingLine && !output.answerOnly ? 'true' : 'false'}`)
    .replace('\\ShowInlineSolutiontrue', `\\ShowInlineSolution${output.showSolutions ? 'true' : 'false'}`)
    .replace('\\AnswerSheetOnlyfalse', `\\AnswerSheetOnly${output.answerOnly ? 'true' : 'false'}`)
}

function scoreTableTex(items: PaperItem[], answerOnly: boolean): string {
  const groups = groupItems(items)
  if (!groups.length || answerOnly) return ''
  const columns = `|c|${'c|'.repeat(groups.length + 1)}`
  const top = ['\\textbf{题号}', ...groups.map((_, index) => chineseNumber(index + 1)), '\\textbf{总分}']
  const scores = groups.map(group => group.score)
  const total = scores.reduce((sum, score) => sum + score, 0)
  return `\\begin{UstcScoreTable}{${columns}}
  ${top.join(' & ')} \\\\ \\hline
  \\textbf{满分} & ${scores.join(' & ')} & ${total} \\\\ \\hline
  \\textbf{得分} & ${groups.map(() => '\\hspace{11mm}').join(' & ')} & \\hspace{13mm} \\\\
\\end{UstcScoreTable}`
}

function buildDocumentSection(
  isGaokao: boolean,
  paper: SavedPaper,
  output: { showSolutions: boolean; answerOnly: boolean },
  fields: PaperHeaderMeta,
  isCombined: boolean,
): string {
  const lines: string[] = []
  const totalScore = paper.items.reduce((sum, item) => sum + Number(item.score || 0), 0)
  const writeSpaceTex = { compact: '3cm', standard: '5.5cm', spacious: '7cm' }[fields.writeSpace] ?? '5.5cm'

  if (isGaokao) {
    if (!output.answerOnly) {
      lines.push('\\secret')
      lines.push('\\maketitle')
      lines.push('\\begin{notice}')
      lines.push('  \\item 答卷前，考生务必将自己的姓名、学号或准考证号填写清楚。')
      lines.push('  \\item 客观题请在括号内填涂正确选项；非选择题应写出必要的文字说明、证明过程或演算步骤。')
      lines.push(`  \\item 本试卷共 ${paper.items.length} 题，满分 ${totalScore} 分。`)
      lines.push('\\end{notice}')
      lines.push('\\vspace{0.8em}')
    } else {
      lines.push(`\\begin{center}{\\Large\\bfseries ${latexText(fields.courseTitle)}——参考答案与解析}\\end{center}`)
      lines.push('\\vspace{0.6em}')
    }
  } else {
    if (isCombined && !output.answerOnly) {
      lines.push('\\ShowBindingLine' + (fields.showBindingLine ? 'true' : 'false'))
      lines.push('\\AnswerSheetOnlyfalse')
      lines.push('\\ShowInlineSolutionfalse')
    }
    lines.push('\\UstcHeader')
    lines.push(scoreTableTex(paper.items, output.answerOnly))
  }

  let sequence = 0
  const groups = groupItems(paper.items)
  for (const [sectionIndex, group] of groups.entries()) {
    const scoreDetail = formatSectionScore(group)
    if (isGaokao) {
      lines.push(`\\section{${latexText(group.title)}：${scoreDetail}}`)
      lines.push(`\\begin{enumerate}[label=\\arabic*., start=${sequence + 1}, itemsep=4mm]`)
    } else {
      const sectionNumber = chineseNumber(sectionIndex + 1)
      lines.push(`\\UstcSection{${sectionNumber}}{${scoreDetail}}{${latexText(group.title)}}`)
      lines.push('\\begin{enumerate}[label=(\\arabic*), leftmargin=2.2em, itemsep=3.5mm]')
    }

    for (const item of group.items) {
      const question = item.question
      sequence++
      const scoreTag =
        isGaokao && (question.type === 'solve' || question.type === 'proof') ? `(${item.score}分)\\ ` : ''
      lines.push(`\\item ${output.answerOnly ? '' : scoreTag}`)

      if (!output.answerOnly) {
        const stemTex = renderMarkdownToLatex(question.stem.md, true)
        const choiceSuffix =
          isGaokao && (question.type === 'single' || question.type === 'multi')
            ? output.showSolutions
              ? ` \\paren[${extractChoiceKey(question.answer.md)}]`
              : ' \\paren'
            : ''
        lines.push(`${stemTex}${choiceSuffix}`)

        if (question.options?.length) {
          if (isGaokao) {
            lines.push('\\begin{choices}')
            for (const option of question.options) {
              lines.push(`  \\item ${renderMarkdownToLatex(option.md, false)}`)
            }
            lines.push('\\end{choices}')
          } else {
            const opts = [...question.options]
            while (opts.length < 4) opts.push({ key: '', md: '' })
            lines.push(`\\UstcOptions{${opts.slice(0, 4).map(o => renderMarkdownToLatex(o.md, false)).join('}{')}}`)
          }
        }
      }

      if (output.showSolutions) {
        const label = question.type === 'proof' ? '证明' : '解'
        const solText = resolveSolutionText(question)
        const showAns = shouldShowAnswerLine(question)

        if (isGaokao) {
          lines.push('\\begin{solution}')
          if (showAns) {
            lines.push(`\\noindent\\textbf{【答案】}\\ ${renderMarkdownToLatex(question.answer.md, false)}\\par\\smallskip`)
          }
          if (solText) {
            lines.push(`\\noindent\\textbf{【${label}】}\\ ${renderMarkdownToLatex(solText, false)}`)
          }
          const comment = buildCommentText(item, question)
          if (comment) {
            lines.push(`\\par\\smallskip\\noindent{\\color{ExamCommentRed}\\textbf{点评：}${renderMarkdownToLatex(comment, false)}}`)
          }
          lines.push('\\end{solution}')
        } else {
          if (showAns) {
            lines.push(`\\par\\vspace{1mm}\\noindent{\\bfseries\\heiti 答案：}\\ ${renderMarkdownToLatex(question.answer.md, false)}`)
          }
          if (solText) {
            lines.push(`\\begin{UstcSolution}[${label}]{${writeSpaceTex}}`)
            lines.push(renderMarkdownToLatex(solText, false))
            lines.push('\\end{UstcSolution}')
          }
          const comment = buildCommentText(item, question)
          if (comment) {
            lines.push(`\\UstcComment{${renderMarkdownToLatex(comment, false)}}`)
          }
        }
      } else if (question.type === 'solve' || question.type === 'proof') {
        lines.push(`\\par\\vspace{${writeSpaceTex}}`)
      }
    }
    lines.push('\\end{enumerate}')
  }
  return lines.join('\n')
}

export function buildExamLatex(
  paper: SavedPaper,
  templateId: PdfTemplateId,
  mode: PdfExportMode,
  fields: PaperHeaderMeta,
): string {
  const isGaokao = templateId === 'gaokao'
  const source = isGaokao ? gaokaoTemplateTex : ustcTemplateTex

  if (mode === 'split') {
    const preamble = buildPreamble(isGaokao, source, fields, { showSolutions: true, answerOnly: false })
    const qBody = buildDocumentSection(isGaokao, paper, { showSolutions: false, answerOnly: false }, fields, true)
    const aBody = buildDocumentSection(isGaokao, paper, { showSolutions: true, answerOnly: true }, fields, true)
    return `${preamble}\n\\begin{document}\n${qBody}\n\\clearpage\n${isGaokao ? '' : '\\ShowBindingLinefalse\\AnswerSheetOnlytrue\\ShowInlineSolutiontrue\n'}${aBody}\n\\end{document}\n`
  }

  const preamble = buildPreamble(isGaokao, source, fields, { showSolutions: true, answerOnly: false })
  const docBody = buildDocumentSection(isGaokao, paper, { showSolutions: true, answerOnly: false }, fields, false)
  return `${preamble}\n\\begin{document}\n${docBody}\n\\end{document}\n`
}
