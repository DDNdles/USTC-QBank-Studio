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

export function formatDisplayTerm(term: string | undefined): string {
  return String(term ?? '').replace(/--/g, '–')
}

export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function extractChoiceKey(answerMd: string | undefined): string {
  const match = String(answerMd ?? '').match(/[A-D]{1,4}/)
  return match ? match[0] : ''
}

const KATEX_EXAM_MACROS: Record<string, string> = {
  '\\dd': '\\,\\mathrm{d}',
  '\\ee': '\\mathrm{e}',
  '\\ii': '\\mathrm{i}',
}

export interface RenderMarkdownOptions {
  /** Mirrors XeLaTeX \everymath{\displaystyle} in ustc-exam & gaokao templates */
  displayMathInline?: boolean
}

function renderInlineMarkdownHtml(line: string, options: RenderMarkdownOptions = {}): string {
  return String(line ?? '')
    .split(MATH_SPLIT_RE)
    .map(part => {
      if ((part.startsWith('$') && part.endsWith('$')) || part.startsWith('\\[') || part.startsWith('\\(')) {
        const display = part.startsWith('$$') || part.startsWith('\\[')
        let math = stripMathDelimiters(part)
        if (!display && options.displayMathInline && !/^\\(?:display|text|script)style\b/.test(math)) {
          math = `\\displaystyle ${math}`
        }
        try {
          return katex.renderToString(math, {
            displayMode: display,
            throwOnError: false,
            trust: false,
            macros: KATEX_EXAM_MACROS,
          })
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

export function renderMarkdownToHtml(markdown: string, options: RenderMarkdownOptions = {}): string {
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
              .map(c => renderInlineMarkdownHtml(c.trim(), options)),
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
      return `<p>${lines.map(l => renderInlineMarkdownHtml(l, options)).join('<br />')}</p>`
    })
    .join('')

  return html.replace(/@@MATHBLOCK_(\d+)@@/g, (_, idxStr) => {
    const token = blocks[Number(idxStr)] ?? ''
    const math = stripMathDelimiters(token)
    try {
      return katex.renderToString(math, {
        displayMode: true,
        throwOnError: false,
        trust: false,
        macros: KATEX_EXAM_MACROS,
      })
    } catch {
      return `<pre>${escapeHtml(math)}</pre>`
    }
  })
}

export function buildUstcBindingLineSvg(): string {
  return `<svg class="ustc-binding-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 297" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
    <line x1="19" y1="14" x2="19" y2="283" stroke="#111111" stroke-width="0.22" stroke-dasharray="1.45 1.45" />
    <circle cx="19" cy="46" r="2.8" fill="#FFFFFF" stroke="#404040" stroke-width="0.18" />
    <circle cx="19" cy="118" r="2.8" fill="#FFFFFF" stroke="#404040" stroke-width="0.18" />
    <circle cx="19" cy="186" r="2.8" fill="#FFFFFF" stroke="#404040" stroke-width="0.18" />
    <circle cx="19" cy="254" r="2.8" fill="#FFFFFF" stroke="#404040" stroke-width="0.18" />
    <g transform="translate(11.5, 152) rotate(-90)" fill="#111111" font-size="3.35" font-family='"SimSun","Songti SC","Noto Serif CJK SC","STSong",serif'>
      <text x="-63" y="0.9">学生所在院系：</text>
      <line x1="-39.5" y1="1.6" x2="-15.5" y2="1.6" stroke="#111111" stroke-width="0.18" />
      <text x="-5.5" y="0.9">姓名：</text>
      <line x1="4.5" y1="1.6" x2="22.5" y2="1.6" stroke="#111111" stroke-width="0.18" />
      <text x="32.5" y="0.9">学号：</text>
      <line x1="42.5" y1="1.6" x2="62.5" y2="1.6" stroke="#111111" stroke-width="0.18" />
    </g>
    <text transform="translate(23.1, 150) rotate(-90)" text-anchor="middle" dominant-baseline="central" fill="#111111" font-size="3.2" font-family='"SimSun","Songti SC","Noto Serif CJK SC","STSong",serif'>装订线　　　答题时不要超过此线</text>
  </svg>`
}

// ============================================================================
// Pixel-Faithful dsh-study Printable HTML (mirrors XeLaTeX ustc-exam & gaokao)
// ============================================================================

export function buildStandaloneExamHtml(
  paper: SavedPaper,
  templateId: PdfTemplateId,
  mode: PdfExportMode,
  fields: PaperHeaderMeta,
  sourceMap: Record<string, SourceConfig>,
): string {
  const isGaokao = templateId === 'gaokao'
  const writeSpace = { compact: '30mm', standard: '55mm', spacious: '70mm' }[fields.writeSpace] ?? '55mm'
  const totalScore = paper.items.reduce((s, it) => s + Number(it.score || 0), 0)
  const mathOpts: RenderMarkdownOptions = { displayMathInline: true }

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
      const showBinding = !isGaokao && fields.showBindingLine && !output.answerOnly
      let seq = 0

      const sectionHtml = groups
        .map((group, secIdx) => {
          const scoreDetail = formatSectionScore(group)
          const itemsHtml = group.items
            .map(item => {
              seq++
              const q = item.question
              const scoreTag =
                isGaokao && !output.answerOnly && (q.type === 'solve' || q.type === 'proof')
                  ? `<span class="gk-score">(${item.score}分) </span>`
                  : ''
              const choiceParen =
                isGaokao && !output.answerOnly && (q.type === 'single' || q.type === 'multi')
                  ? `<span class="gk-paren">(&nbsp;${output.showSolutions ? escapeHtml(extractChoiceKey(q.answer.md)) : '&nbsp;&nbsp;&nbsp;&nbsp;'}&nbsp;)</span>`
                  : ''
              const prompt = output.answerOnly
                ? ''
                : `<div class="stem rich-math rich-math-inline-lead">${scoreTag}${renderMarkdownToHtml(q.stem.md, mathOpts)}${choiceParen}</div>${renderFigs(item, q.stem.figures)}`
              const options =
                output.answerOnly || !q.options?.length
                  ? ''
                  : `<div class="options">${q.options
                      .map(
                        opt =>
                          `<div class="opt-cell"><span class="opt-key">${escapeHtml(opt.key)}.</span><div class="rich-math rich-math-inline-lead">${renderMarkdownToHtml(opt.md, mathOpts)}</div></div>`,
                      )
                      .join('')}</div>`

              const solText = resolveSolutionText(q)
              const comment = buildCommentText(item, q)
              const label = q.type === 'proof' ? '证明' : '解'

              const solution = output.showSolutions
                ? isGaokao
                  ? `<section class="solution">
                      ${shouldShowAnswerLine(q) ? `<div class="sol-row"><span class="heiti-bold">【答案】</span><span class="gap-sm"></span><div class="rich-math rich-math-inline-lead">${renderMarkdownToHtml(q.answer.md, mathOpts)}</div></div>` : ''}
                      ${solText ? `<div class="sol-row"><span class="heiti-bold">【${label}】</span><span class="gap-sm"></span><div class="rich-math rich-math-inline-lead">${renderMarkdownToHtml(solText, mathOpts)}</div>${renderFigs(item, q.solution.figures)}</div>` : ''}
                      ${comment ? `<div class="comment"><span class="heiti-bold">点评：</span><div class="rich-math rich-math-inline-lead">${renderMarkdownToHtml(comment, mathOpts)}</div></div>` : ''}
                    </section>`
                  : `<section class="solution">
                      ${shouldShowAnswerLine(q) ? `<div class="sol-row"><span class="heiti-bold">答案：</span><span class="gap-sm"></span><div class="rich-math rich-math-inline-lead">${renderMarkdownToHtml(q.answer.md, mathOpts)}</div></div>` : ''}
                      ${solText ? `<div class="sol-row"><span class="heiti-bold">${label}</span><span class="gap-quad"></span><div class="rich-math rich-math-inline-lead">${renderMarkdownToHtml(solText, mathOpts)}</div>${renderFigs(item, q.solution.figures)}</div>` : ''}
                      ${comment ? `<div class="comment"><span class="heiti-bold">点评：</span><div class="rich-math rich-math-inline-lead">${renderMarkdownToHtml(comment, mathOpts)}</div></div>` : ''}
                    </section>`
                : q.type === 'solve' || q.type === 'proof'
                  ? '<div class="answer-space"></div>'
                  : ''

              return `<article class="q-item"><div class="q-num">${isGaokao ? `${seq}.` : `(${seq})`}</div><div class="q-body">${prompt}${options}${solution}</div></article>`
            })
            .join('')

          const headingHtml = isGaokao
            ? `<h2 class="gk-section">${chineseNumber(secIdx + 1)}、${escapeHtml(group.title)}：${scoreDetail}</h2>`
            : `<h2 class="ustc-section"><span class="heiti-bold">${chineseNumber(secIdx + 1)}.</span> (${scoreDetail}) ${escapeHtml(group.title)}</h2>`

          return `<section class="exam-section">${headingHtml}${itemsHtml}</section>`
        })
        .join('')

      const scoreTableHtml =
        !isGaokao && !output.answerOnly
          ? `<table class="score-table">
              <tr><td class="heiti-bold">题号</td>${groups.map((_, i) => `<td>${chineseNumber(i + 1)}</td>`).join('')}<td class="heiti-bold">总分</td></tr>
              <tr><td class="heiti-bold">满分</td>${groups.map(g => `<td>${g.score}</td>`).join('')}<td>${totalScore}</td></tr>
              <tr><td class="heiti-bold">得分</td>${groups.map(() => '<td class="score-blank">&nbsp;</td>').join('')}<td class="score-blank">&nbsp;</td></tr>
            </table>`
          : ''

      const headerHtml = isGaokao
        ? output.answerOnly
          ? `<header class="gk-answer-header">${escapeHtml(fields.courseTitle)}——参考答案与解析</header>`
          : `<div class="gk-secret">绝密 ★ 启用前</div>
            <header class="gk-header">
              <div class="gk-title">${escapeHtml(fields.courseTitle)}</div>
              <div class="gk-subject">${escapeHtml(fields.subject)}</div>
            </header>
            <div class="gk-notice">
              <div class="heiti-bold">注意事项：</div>
              <ol>
                <li>答卷前，考生务必将自己的姓名、学号或准考证号填写清楚。</li>
                <li>客观题请在括号内填涂正确选项；非选择题应写出必要的文字说明、证明过程或演算步骤。</li>
                <li>本试卷共 ${paper.items.length} 题，满分 ${totalScore} 分。</li>
              </ol>
            </div>`
        : `<header class="ustc-header">
            ${fields.schoolTerm ? `<div class="ustc-title">${escapeHtml(formatDisplayTerm(fields.schoolTerm))}</div>` : ''}
            <div class="ustc-title">${escapeHtml(fields.courseTitle)}${output.answerOnly ? ' ——参考答案与解析' : ''}</div>
            <div class="ustc-meta">
              考试时间 <span class="ustc-underline">${escapeHtml(fields.examDate)}</span>
              <span class="ustc-meta-gap"></span>
              考试形式 <span class="ustc-underline">${escapeHtml(fields.examForm)}</span>
            </div>
          </header>`

      const footerText = isGaokao
        ? `${escapeHtml(fields.subject)}试题第 1 页（共 1 页）`
        : `${fields.footerTerm ? `${escapeHtml(formatDisplayTerm(fields.footerTerm))}　` : ''}第 1 页（共 1 页）`

      return `<section class="sheet ${showBinding ? 'with-binding' : 'no-binding'}">
        ${showBinding ? buildUstcBindingLineSvg() : ''}
        <div class="sheet-inner">
          ${headerHtml}
          ${scoreTableHtml}
          ${sectionHtml}
          <footer class="screen-footer">${footerText}</footer>
        </div>
      </section>`
    })
    .join('')

  const printFooterPrefix = isGaokao
    ? `${fields.subject.replace(/"/g, '\\"')}试题第 `
    : `${fields.footerTerm ? `${formatDisplayTerm(fields.footerTerm).replace(/"/g, '\\"')}   ` : ''}第 `

  const pageLeftMargin = !isGaokao && fields.showBindingLine ? '30mm' : '20mm'

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css"><title>${escapeHtml(paper.title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"><style>
  *{box-sizing:border-box}
  body{font-family:"SimSun","Songti SC","Noto Serif CJK SC","STSong",serif;color:#000000;background:#eceae4;margin:0;padding:24px 16px;line-height:1.75;font-size:11pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .heiti-bold{font-family:"SimHei","Heiti SC","Noto Sans SC","Microsoft YaHei",sans-serif;font-weight:700}
  .sheet{position:relative;background:#ffffff;width:210mm;min-height:297mm;margin:0 auto 24px;box-shadow:0 2px 14px rgba(0,0,0,.12)}
  .sheet.with-binding{padding:23mm 20mm 22mm 30mm}
  .sheet.no-binding{padding:23mm 20mm 22mm 20mm}
  .ustc-binding-svg{position:absolute;left:0;top:0;width:28mm;height:297mm;pointer-events:none}
  .ustc-header{text-align:center;margin-bottom:4mm}
  .ustc-title{font-family:"SimHei","Heiti SC","Noto Sans SC","Microsoft YaHei",sans-serif;font-size:14.4pt;font-weight:700;line-height:1.45;margin-bottom:1.5mm;color:#000}
  .ustc-meta{margin-top:2.5mm;font-size:11pt;color:#000}
  .ustc-underline{display:inline-block;min-width:32mm;border-bottom:0.75pt solid #000;padding:0 3mm;text-align:center;line-height:1.3}
  .ustc-meta-gap{display:inline-block;width:12mm}
  table.score-table{border-collapse:collapse;margin:4mm auto 6mm;font-size:10.8pt;color:#000}
  table.score-table td{border:0.75pt solid #000;padding:5px 14px;text-align:center;min-width:11mm}
  table.score-table td.score-blank{min-width:13mm}
  .gk-secret{font-family:"SimHei","Heiti SC","Noto Sans SC","Microsoft YaHei",sans-serif;font-weight:700;font-size:11.5pt;letter-spacing:.12em;margin-bottom:3mm}
  .gk-header{text-align:center;margin-bottom:4mm}
  .gk-title{font-size:14.5pt;line-height:1.5;color:#000}
  .gk-subject{font-family:"SimHei","Heiti SC","Noto Sans SC","Microsoft YaHei",sans-serif;font-size:21pt;font-weight:700;letter-spacing:.18em;margin-top:1.5mm;color:#000}
  .gk-answer-header{text-align:center;font-family:"SimHei","Heiti SC","Noto Sans SC","Microsoft YaHei",sans-serif;font-size:14.5pt;font-weight:700;margin-bottom:5mm}
  .gk-notice{margin:3mm 0 6mm;font-size:10.5pt;line-height:1.7}
  .gk-notice ol{margin:1mm 0 0;padding-left:1.8em}
  .exam-section{margin-top:4mm}
  h2.ustc-section{font-size:11pt;font-weight:400;margin:4mm 0 2.5mm;color:#000;line-height:1.6}
  h2.gk-section{font-family:"SimHei","Heiti SC","Noto Sans SC","Microsoft YaHei",sans-serif;font-size:11.5pt;font-weight:700;margin:4.5mm 0 2.5mm;color:#000}
  .q-item{display:grid;grid-template-columns:2.35em minmax(0,1fr);align-items:baseline;margin-bottom:4mm}
  .q-num{font-weight:400;color:#000;user-select:none}
  .q-body{min-width:0}
  .stem{color:#000}
  .gk-score{margin-right:0.25em}
  .gk-paren{float:right;margin-left:1em}
  .options{display:grid;grid-template-columns:1fr 1fr;gap:1.8mm 5mm;margin:2mm 0}
  .opt-cell{display:flex;gap:0.35em;align-items:baseline}
  .opt-key{flex-shrink:0}
  .q-fig{text-align:center;margin:2.5mm 0}
  .q-fig img{max-width:72%;max-height:58mm;object-fit:contain}
  .solution{margin-top:1.8mm}
  .sol-row{margin:1.5mm 0}
  .gap-sm{display:inline-block;width:0.5em}
  .gap-quad{display:inline-block;width:1em}
  .comment{color:#C01C28;margin:1.8mm 0 0}
  .comment .heiti-bold{color:#C01C28}
  .rich-math p{margin:0.35em 0}
  .rich-math p:first-child{margin-top:0}
  .rich-math p:last-child{margin-bottom:0}
  .rich-math-inline-lead{display:inline}
  .rich-math-inline-lead > p:first-child{display:inline}
  .rich-math .katex-display{margin:0.55em 0;overflow-x:auto;overflow-y:hidden}
  .rich-math table{border-collapse:collapse;margin:0.6em auto}
  .rich-math th,.rich-math td{border:0.75pt solid #000;padding:4px 10px;text-align:center}
  .answer-space{height:${writeSpace}}
  .screen-footer{margin-top:10mm;text-align:center;font-size:9.5pt;color:#666666}
  @page{size:A4 portrait;margin:23mm 20mm 22mm ${pageLeftMargin};@bottom-center{content:"${printFooterPrefix}" counter(page) " 页（共 " counter(pages) " 页）";font-family:"SimSun","Songti SC","Noto Serif CJK SC",serif;font-size:9.5pt;color:#666666}}
  @media print{
    body{background:#fff;padding:0}
    .sheet{width:auto;min-height:auto;margin:0;box-shadow:none;padding:0 !important;break-after:page}
    .sheet:last-child{break-after:auto}
    .ustc-binding-svg{position:fixed;left:-${pageLeftMargin};top:-23mm;width:28mm;height:297mm}
    .screen-footer{display:none}
    .q-item{break-inside:avoid}
    h2{break-after:avoid}
  }
  </style></head><body>${pagesHtml}</body></html>`
}

/**
 * Prints the standalone A4 exam HTML via an isolated hidden iframe so web chrome
 * and dark theme never bleed into the saved PDF, while reusing already-loaded KaTeX CSS.
 */
export function printExamViaIframe(standaloneHtml: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.visibility = 'hidden'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) {
    iframe.remove()
    window.print()
    return
  }

  // Copy local Vite-bundled KaTeX stylesheets into the iframe so print works even offline
  let localKatexHead = ''
  for (const sheet of Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))) {
    if (sheet.tagName === 'LINK') {
      const href = (sheet as HTMLLinkElement).href
      if (href) localKatexHead += `<link rel="stylesheet" href="${escapeHtml(href)}">`
    } else if (sheet.textContent?.includes('.katex')) {
      localKatexHead += `<style>${sheet.textContent}</style>`
    }
  }

  const injectedHtml = localKatexHead
    ? standaloneHtml.replace(
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">',
        localKatexHead,
      )
    : standaloneHtml

  doc.open()
  doc.write(injectedHtml)
  doc.close()

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 800)
  }

  const triggerPrint = () => {
    win.addEventListener('afterprint', cleanup, { once: true })
    win.focus()
    win.print()
    window.setTimeout(cleanup, 60_000)
  }

  if (doc.fonts?.ready) {
    void doc.fonts.ready.then(() => window.setTimeout(triggerPrint, 120))
  } else {
    window.setTimeout(triggerPrint, 250)
  }
}

/**
 * Opens the verbatim dsh-study .tex source in Overleaf with XeLaTeX compiler pre-selected.
 */
export function openInOverleaf(texSource: string, title: string): void {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = 'https://www.overleaf.com/docs'
  form.target = '_blank'
  form.style.display = 'none'

  const fields: Record<string, string> = {
    snip: texSource,
    snip_name: `${title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 48)}.tex`,
    engine: 'xelatex',
  }
  for (const [k, v] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = k
    input.value = v
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
  form.remove()
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
