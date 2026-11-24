import katex from 'katex'
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
    .replace(/^(?:[（(]\s*[一二三四五六七八九十\d]+\s*[)）]\s*[：:、.．\s]*)/u, '')
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
    parts.push('本题含 AI 推导参考答案，请注意核验。')
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
  // Keep multi-line $$...$$ blocks intact before paragraph splitting
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
// Standalone Printable HTML Export (USTC & Gaokao Templates)
// ============================================================================

export function buildStandaloneExamHtml(
  paper: SavedPaper,
  templateId: PdfTemplateId,
  mode: PdfExportMode,
  fields: PaperHeaderMeta,
  sourceMap: Record<string, SourceConfig>,
): string {
  const isGaokao = templateId === 'gaokao'
  const writeHeight = { compact: '30mm', standard: '52mm', spacious: '72mm' }[fields.writeSpace] ?? '52mm'
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
      const sectionsHtml = groups
        .map((group, secIdx) => {
          const itemsHtml = group.items
            .map(item => {
              seq++
              const q = item.question
              const stemHtml = output.answerOnly
                ? ''
                : `<div class="stem rich-math">${renderMarkdownToHtml(q.stem.md)}</div>${renderFigs(item, q.stem.figures)}`
              const optsHtml =
                output.answerOnly || !q.options?.length
                  ? ''
                  : `<div class="options">${q.options
                      .map(o => `<div class="opt"><strong>${escapeHtml(o.key)}.</strong> ${renderMarkdownToHtml(o.md)}</div>`)
                      .join('')}</div>`
              const solText = resolveSolutionText(q)
              const comment = buildCommentText(item, q)
              const solHtml = output.showSolutions
                ? `<section class="solution">
                    ${shouldShowAnswerLine(q) ? `<div class="ans-line"><strong>答案：</strong><span class="rich-math">${renderMarkdownToHtml(q.answer.md)}</span></div>` : ''}
                    ${solText ? `<div class="sol-body"><strong>${q.type === 'proof' ? '证明' : '解'}</strong>　<div class="rich-math">${renderMarkdownToHtml(solText)}</div>${renderFigs(item, q.solution.figures)}</div>` : ''}
                    ${comment ? `<p class="comment"><strong>点评：</strong>${renderMarkdownToHtml(comment)}</p>` : ''}
                  </section>`
                : q.type === 'solve' || q.type === 'proof'
                  ? `<div class="answer-space"></div>`
                  : ''
              return `<article class="q-item"><div class="q-no">${isGaokao ? `${seq}.` : `(${seq})`} ${output.answerOnly ? '' : `<span class="q-score">（${item.score} 分）</span>`}</div>${stemHtml}${optsHtml}${solHtml}</article>`
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
          ? `<div class="gaokao-notice">
              <div class="secret-mark">绝密 ★ 启用前</div>
              <ol>
                <li>答卷前，考生务必将自己的姓名、学号或准考证号填写清楚。</li>
                <li>客观题请在括号内填涂正确选项；非选择题应写出必要的文字说明、证明过程或演算步骤。</li>
                <li>本试卷共 ${paper.items.length} 题，满分 ${totalScore} 分。</li>
              </ol>
            </div>`
          : ''

      const bindingRail =
        !isGaokao && fields.showBindingLine && !output.answerOnly
          ? `<aside class="binding-rail">
              <div class="binding-student">学生所在院系：____________　姓名：__________　学号：____________</div>
              <div class="binding-line">装订线　　答题时不要超过此线</div>
            </aside>`
          : ''

      return `<section class="page ${!isGaokao && fields.showBindingLine && !output.answerOnly ? 'with-binding' : ''}">
        ${bindingRail}
        <header class="exam-header">
          ${!isGaokao && fields.schoolTerm ? `<div class="school-term">${escapeHtml(fields.schoolTerm)}</div>` : ''}
          <div class="course-title">${escapeHtml(fields.courseTitle)}${output.answerOnly ? '——参考答案与解析' : ''}</div>
          ${!isGaokao ? `<div class="meta-line">考试时间 <u>${escapeHtml(fields.examDate)}</u>　　考试形式 <u>${escapeHtml(fields.examForm)}</u></div>` : `<div class="meta-line">科目：${escapeHtml(fields.subject)}　·　日期：${escapeHtml(fields.examDate)}</div>`}
        </header>
        ${gaokaoNotice}
        ${scoreTableHtml}
        ${sectionsHtml}
        <footer class="exam-footer">${escapeHtml(fields.footerTerm)} · 由 USTC QBank Studio 排版生成</footer>
      </section>`
    })
    .join('')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(fields.courseTitle)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Noto Serif SC", "Songti SC", "SimSun", Georgia, serif; color: #14161a; background: #f2f0ea; margin: 0; padding: 24px 16px; line-height: 1.85; font-size: 15px; }
    .toolbar { max-width: 820px; margin: 0 auto 14px; display: flex; justify-content: flex-end; gap: 8px; }
    .toolbar button { font-family: system-ui, sans-serif; border: 1px solid #d4d0c7; background: #fff; color: #1c1e21; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; }
    .toolbar button.primary { background: #1c1e21; color: #fff; border-color: #1c1e21; }
    .page { position: relative; background: #fff; max-width: 820px; margin: 0 auto 24px; padding: 42px 50px; box-shadow: 0 2px 16px rgba(0,0,0,.07); }
    .page.with-binding { padding-left: 88px; }
    .binding-rail { position: absolute; left: 0; top: 0; bottom: 0; width: 64px; border-right: 1.2px dashed #555; display: flex; align-items: center; justify-content: center; gap: 8px; color: #333; font-size: 11px; }
    .binding-student, .binding-line { writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing: 0.08em; white-space: nowrap; }
    .binding-line { color: #555; }
    .exam-header { text-align: center; margin-bottom: 18px; }
    .school-term, .course-title { font-family: "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif; font-size: 20px; font-weight: 700; line-height: 1.5; }
    .meta-line { margin-top: 6px; font-size: 13.5px; color: #374151; }
    .meta-line u { text-decoration: none; border-bottom: 1px solid #374151; padding: 0 16px; }
    .gaokao-notice { border: 1px solid #d1d5db; padding: 10px 18px; margin-bottom: 18px; font-size: 13.5px; border-radius: 4px; }
    .secret-mark { font-weight: 700; letter-spacing: 0.16em; margin-bottom: 4px; }
    .gaokao-notice ol { margin: 4px 0 0; padding-left: 18px; }
    table.score-table { border-collapse: collapse; margin: 14px auto 22px; font-size: 13.5px; }
    table.score-table td { border: 1px solid #374151; padding: 5px 15px; text-align: center; min-width: 34px; }
    h2 { font-family: "Noto Sans SC", "Microsoft YaHei", "SimHei", sans-serif; font-size: 15.5px; font-weight: 700; margin: 22px 0 12px; }
    .q-item { margin-bottom: 16px; }
    .q-no { font-weight: 600; margin-bottom: 4px; }
    .q-score { font-weight: 400; color: #6b7280; font-size: 13px; }
    .options { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin: 8px 0 8px 18px; }
    .q-fig { text-align: center; margin: 10px 0; }
    .q-fig img { max-width: 72%; max-height: 220px; object-fit: contain; }
    .solution { margin-top: 10px; padding: 10px 14px; background: #faf9f6; border-left: 2.5px solid #2558b8; }
    .ans-line { margin-bottom: 6px; }
    .comment { color: #c01c28; margin: 8px 0 0; }
    .answer-space { height: ${writeHeight}; }
    .exam-footer { text-align: center; color: #71717a; font-size: 12px; margin-top: 28px; padding-top: 12px; border-top: 1px solid #eceae4; }
    .rich-math p { margin: 0.35em 0; }
    .rich-math table { border-collapse: collapse; margin: 8px auto; }
    .rich-math th, .rich-math td { border: 1px solid #4b5563; padding: 4px 10px; }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none; }
      .page { box-shadow: none; margin: 0; padding: 10mm 14mm; break-after: page; max-width: none; }
      .page.with-binding { padding-left: 26mm; }
      .page:last-child { break-after: auto; }
      .q-item { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="primary" onclick="window.print()">打印 / 另存 PDF</button>
  </div>
  ${pagesHtml}
</body>
</html>`
}

// ============================================================================
// LaTeX Source Generator (.tex export compatible with dsh-study ustc-exam & gaokao)
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
      const parts = token.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g)
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
    })
    .join('')
}

function renderMarkdownToLatex(markdown: string): string {
  const raw = String(markdown ?? '').trim()
  if (!raw) return ''
  return raw
    .split(/\r?\n\s*\r?\n/)
    .map(para => para.split(/\r?\n/).map(line => convertInlineLatex(line)).join('\\\\\n'))
    .join('\n\\par\\smallskip\n')
}

function ustcPreamble(fields: PaperHeaderMeta, showSolutions: boolean, answerOnly: boolean): string {
  return `% Generated by USTC QBank Studio (compatible with XeLaTeX)
\\documentclass[a4paper,11pt]{ctexart}
\\newif\\ifShowInlineSolution\\ShowInlineSolution${showSolutions ? 'true' : 'false'}
\\newif\\ifAnswerSheetOnly\\AnswerSheetOnly${answerOnly ? 'true' : 'false'}
\\newif\\ifShowBindingLine\\ShowBindingLine${fields.showBindingLine && !answerOnly ? 'true' : 'false'}

\\newcommand{\\ExamSchoolTerm}{${latexText(fields.schoolTerm)}}
\\newcommand{\\ExamCourseTitle}{${latexText(fields.courseTitle)}}
\\newcommand{\\ExamDate}{${latexText(fields.examDate)}}
\\newcommand{\\ExamForm}{${latexText(fields.examForm)}}
\\newcommand{\\ExamFooterTerm}{${latexText(fields.footerTerm)}}

\\usepackage{geometry}
\\geometry{a4paper,top=23mm,bottom=22mm,left=30mm,right=20mm,footskip=11mm}
\\usepackage{amsmath,amssymb,amsthm,bm,enumitem,graphicx,xcolor,array,booktabs,environ,fancyhdr,lastpage,tikz,eso-pic,needspace}
\\allowdisplaybreaks[3]
\\setlength{\\emergencystretch}{3.5em}
\\sloppy
\\definecolor{UstcCommentRed}{HTML}{C01C28}
\\definecolor{UstcFooterGray}{HTML}{666666}
\\everymath{\\displaystyle}
\\newcommand{\\dd}{\\,\\mathrm{d}}
\\newcommand{\\ee}{\\mathrm{e}}
\\newcommand{\\ii}{\\mathrm{i}}

\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\fancyfoot[C]{\\small\\color{UstcFooterGray}\\ExamFooterTerm\\quad 第~\\thepage~页（共~\\pageref{LastPage}~页）}

\\newcommand{\\DrawUstcBindingLine}{%
  \\ifShowBindingLine\\ifodd\\value{page}%
    \\begin{tikzpicture}[remember picture, overlay]
      \\draw[dashed, line width=0.55pt, dash pattern=on 4pt off 4pt]
        ([xshift=19mm, yshift=-14mm]current page.north west) -- ([xshift=19mm, yshift=14mm]current page.south west);
      \\foreach \\y in {-46mm, -118mm, -186mm, -254mm} {
        \\filldraw[fill=white, draw=black!75, line width=0.45pt] ([xshift=19mm, yshift=\\y]current page.north west) circle (2.8mm);
      }
      \\node[rotate=90, anchor=center, font=\\small] at ([xshift=11.5mm, yshift=-152mm]current page.north west)
        {学生所在院系：\\underline{\\hspace{24mm}}\\hspace{10mm}姓名：\\underline{\\hspace{18mm}}\\hspace{10mm}学号：\\underline{\\hspace{20mm}}};
      \\node[rotate=90, anchor=center, font=\\small] at ([xshift=22.5mm, yshift=-150mm]current page.north west)
        {装订线\\hspace{8mm}答题时不要超过此线};
    \\end{tikzpicture}%
  \\fi\\fi
}
\\AddToShipoutPictureBG{\\DrawUstcBindingLine}

\\newcommand{\\UstcHeader}{%
  \\begin{center}
    {\\Large\\bfseries\\heiti \\ExamSchoolTerm\\par}\\vspace{2.2mm}
    {\\Large\\bfseries\\heiti \\ExamCourseTitle\\ifAnswerSheetOnly\\ ——参考答案与解析\\fi\\par}\\vspace{3.2mm}
    {\\normalsize 考试时间\\ \\underline{\\makebox[32mm][c]{\\ExamDate}}\\hspace{12mm}考试形式\\ \\underline{\\makebox[32mm][c]{\\ExamForm}}}
  \\end{center}\\vspace{2.5mm}
}
\\newcommand{\\UstcSection}[3]{\\vspace{3.5mm}\\noindent{\\bfseries\\heiti #1.（#2）#3}\\par\\vspace{1.5mm}}
\\newcommand{\\UstcComment}[1]{\\par\\smallskip\\noindent{\\color{UstcCommentRed}\\textbf{点评：}#1}\\par}
`
}

function gaokaoPreamble(fields: PaperHeaderMeta, showSolutions: boolean): string {
  return `% Generated by USTC QBank Studio (Gaokao exam-zh template)
\\documentclass{exam-zh}
\\usepackage{amsmath,amsthm,graphicx,enumitem,xcolor,array,booktabs,needspace}
\\examsetup{
  page/size=a4paper,
  paren/show-paren=true,
  paren/show-answer=${showSolutions ? 'true' : 'false'},
  fillin/show-answer=false,
  solution/show-solution=${showSolutions ? 'show-stay' : 'hide'},
  solution/label-indentation=false
}
\\allowdisplaybreaks[3]
\\setlength{\\emergencystretch}{3.5em}
\\sloppy
\\everymath{\\displaystyle}
\\definecolor{ExamCommentRed}{HTML}{C01C28}
\\title{${latexText(fields.courseTitle)}}
\\subject{${latexText(fields.subject)}}
`
}

export function buildExamLatex(
  paper: SavedPaper,
  templateId: PdfTemplateId,
  mode: PdfExportMode,
  fields: PaperHeaderMeta,
): string {
  const isGaokao = templateId === 'gaokao'
  const writeSpaceTex = { compact: '3cm', standard: '5.5cm', spacious: '7cm' }[fields.writeSpace] ?? '5.5cm'
  const totalScore = paper.items.reduce((s, it) => s + Number(it.score || 0), 0)

  const renderSectionBlock = (showSolutions: boolean, answerOnly: boolean) => {
    const lines: string[] = []
    const groups = groupItems(paper.items)

    if (isGaokao) {
      if (!answerOnly) {
        lines.push('\\secret\n\\maketitle\n\\begin{notice}')
        lines.push('  \\item 答卷前，考生务必将自己的姓名、学号或准考证号填写清楚。')
        lines.push('  \\item 客观题请在括号内填涂正确选项；非选择题应写出必要的文字说明、证明过程或演算步骤。')
        lines.push(`  \\item 本试卷共 ${paper.items.length} 题，满分 ${totalScore} 分。`)
        lines.push('\\end{notice}\\vspace{0.8em}')
      } else {
        lines.push(`\\begin{center}{\\Large\\bfseries ${latexText(fields.courseTitle)}——参考答案与解析}\\end{center}\\vspace{0.6em}`)
      }
    } else {
      lines.push('\\UstcHeader')
      if (!answerOnly && groups.length) {
        const cols = `|c|${'c|'.repeat(groups.length + 1)}`
        const top = ['\\textbf{题号}', ...groups.map((_, i) => chineseNumber(i + 1)), '\\textbf{总分}']
        const scores = groups.map(g => g.score)
        lines.push(
          `\\begin{center}\\renewcommand{\\arraystretch}{1.5}\\begin{tabular}{${cols}}\\hline\n${top.join(' & ')} \\\\ \\hline\n\\textbf{满分} & ${scores.join(' & ')} & ${totalScore} \\\\ \\hline\n\\textbf{得分} & ${groups.map(() => '\\hspace{11mm}').join(' & ')} & \\hspace{13mm} \\\\ \\hline\n\\end{tabular}\\end{center}\\vspace{2mm}`,
        )
      }
    }

    let seq = 0
    for (const [secIdx, group] of groups.entries()) {
      const scoreDetail = formatSectionScore(group)
      if (isGaokao) {
        lines.push(`\\section{${latexText(group.title)}：${scoreDetail}}`)
        lines.push(`\\begin{enumerate}[label=\\arabic*., start=${seq + 1}, itemsep=4mm]`)
      } else {
        lines.push(`\\UstcSection{${chineseNumber(secIdx + 1)}}{${scoreDetail}}{${latexText(group.title)}}`)
        lines.push('\\begin{enumerate}[label=(\\arabic*), leftmargin=2.2em, itemsep=3.5mm]')
      }

      for (const item of group.items) {
        seq++
        const q = item.question
        const scoreTag = !answerOnly && (q.type === 'solve' || q.type === 'proof') ? `(${item.score}分)\\ ` : ''
        lines.push(`\\item ${scoreTag}`)
        if (!answerOnly) {
          lines.push(renderMarkdownToLatex(q.stem.md))
          if (q.options?.length) {
            lines.push('\\begin{enumerate}[label=\\Alph*., leftmargin=2em, itemsep=1.5mm]')
            for (const opt of q.options) {
              lines.push(`  \\item ${renderMarkdownToLatex(opt.md)}`)
            }
            lines.push('\\end{enumerate}')
          }
        }
        if (showSolutions) {
          const label = q.type === 'proof' ? '证明' : '解'
          const solText = resolveSolutionText(q)
          if (shouldShowAnswerLine(q)) {
            lines.push(`\\par\\vspace{1mm}\\noindent{\\bfseries\\heiti 答案：}\\ ${renderMarkdownToLatex(q.answer.md)}`)
          }
          if (solText) {
            lines.push(`\\par\\vspace{1mm}\\noindent{\\bfseries\\heiti ${label}：}\\ ${renderMarkdownToLatex(solText)}`)
          }
          const comment = buildCommentText(item, q)
          if (comment) {
            lines.push(
              isGaokao
                ? `\\par\\smallskip\\noindent{\\color{ExamCommentRed}\\textbf{点评：}${renderMarkdownToLatex(comment)}}`
                : `\\UstcComment{${renderMarkdownToLatex(comment)}}`,
            )
          }
        } else if (q.type === 'solve' || q.type === 'proof') {
          lines.push(`\\par\\vspace{${writeSpaceTex}}`)
        }
      }
      lines.push('\\end{enumerate}')
    }
    return lines.join('\n')
  }

  if (mode === 'split') {
    const preamble = isGaokao ? gaokaoPreamble(fields, true) : ustcPreamble(fields, true, false)
    const qBody = renderSectionBlock(false, false)
    const aBody = renderSectionBlock(true, true)
    return `${preamble}\n\\begin{document}\n${qBody}\n\\clearpage\n${isGaokao ? '' : '\\ShowBindingLinefalse\\AnswerSheetOnlytrue\\ShowInlineSolutiontrue\n'}${aBody}\n\\end{document}\n`
  }

  const preamble = isGaokao ? gaokaoPreamble(fields, true) : ustcPreamble(fields, true, false)
  const body = renderSectionBlock(true, false)
  return `${preamble}\n\\begin{document}\n${body}\n\\end{document}\n`
}
