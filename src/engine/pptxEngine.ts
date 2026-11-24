import PptxGenJS from 'pptxgenjs'
import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import type { SavedPaper } from '../types/study'
import { originLabel, typeLabel } from './paperAssembler'
import {
  MATH_SPLIT_RE,
  escapeHtml,
  resolveSolutionText,
  shouldShowAnswerLine,
  stripMathDelimiters,
} from './examRenderer'

// Initialize browser MathJax TeX -> SVG compiler once
const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)
const mathDocument = mathjax.document('', {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: 'none' }),
})

export interface PptTheme {
  id: string
  name: string
  background: string
  text: string
  body: string
  accent: string
  highlight: string
  muted: string
  border: string
  railMuted: string
}

export const PPT_THEMES: PptTheme[] = [
  {
    id: 'review-classic',
    name: '典雅纸韵 · 经典讲评',
    background: 'FAF9F5',
    text: '15181E',
    body: '2B2F36',
    accent: '2558B8',
    highlight: 'B46519',
    muted: '6B6F76',
    border: 'DAD7CE',
    railMuted: 'B9B6AC',
  },
  {
    id: 'typora-ink',
    name: '墨韵极简 · 深夜讲堂',
    background: '181A1F',
    text: 'F3F1EC',
    body: 'D6D9E0',
    accent: '6C9EFF',
    highlight: 'E5A44E',
    muted: '8B919E',
    border: '2F3440',
    railMuted: '4A5161',
  },
  {
    id: 'botanical-sage',
    name: '青瓷书院 · 温润护眼',
    background: 'F6F8F5',
    text: '18241F',
    body: '2C3B34',
    accent: '236B52',
    highlight: 'B0621B',
    muted: '66776F',
    border: 'D4DDD6',
    railMuted: 'A9B8AE',
  },
]

const SLIDE_W = 1280
const SLIDE_H = 720
const PX_PER_IN = 96
const BODY_X = 56
const BODY_W = 1168

const CJK_BOLD = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
const CJK_REG = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'

interface FormulaMetrics {
  viewBox: string
  widthPx: number
  heightPx: number
  ascentPx: number
  descentPx: number
  inner: string
}

interface RichPage {
  width: number
  height: number
  svg: string
}

type SceneItem =
  | { type: 'bg-image'; data: string }
  | { type: 'poly'; points: [number, number][]; fill?: string; stroke?: string; strokeWidth?: number }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number; dash?: string }
  | { type: 'dot'; cx: number; cy: number; r: number; fill?: string; stroke?: string; strokeWidth?: number }
  | {
      type: 'text'
      x: number
      y: number
      w: number
      h: number
      text?: string
      lines?: string[]
      lineHeight?: number
      size: number
      bold?: boolean
      role?: string
      color: string
      align?: 'left' | 'center' | 'right'
      valign?: 'top' | 'middle'
      spacing?: number
    }
  | { type: 'image'; x: number; y: number; page: RichPage }

export interface GeneratedSlide {
  index: number
  title: string
  type: 'cover' | 'question' | 'solution'
  questionNumber?: number
  totalQuestions?: number
  questionId?: string | null
  notes?: string | null
  svg: string
  items: SceneItem[]
}

function stripHash(hex: string): string {
  return String(hex ?? '').replace(/^#/, '')
}

function mixHex(hex: string, t: number, base = 'FAF9F5'): string {
  const a = parseInt(stripHash(hex), 16)
  const b = parseInt(stripHash(base), 16)
  return [16, 8, 0]
    .map(shift =>
      Math.round(((a >> shift) & 255) * t + ((b >> shift) & 255) * (1 - t))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()
}

function truncateText(text: string, maxLen: number): string {
  const s = String(text ?? '').trim()
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s
}

function sanitizeFormula(value: string): string {
  return String(value).replace(/(?<!\\text\{)([\u4e00-\u9fff，。；：、！？（）【】《》“”‘’]+)/g, '\\text{$1}')
}

function convertFormulaToSvgMetrics(
  formula: string,
  display: boolean,
  fontSize: number,
  colorHex: string,
): FormulaMetrics | null {
  try {
    const cleaned = sanitizeFormula(formula)
    const node = mathDocument.convert(cleaned, { display })
    const outer = adaptor.outerHTML(node)
    if (outer.includes('data-mml-node="merror"')) return null
    const start = outer.indexOf('<svg')
    const end = outer.lastIndexOf('</svg>')
    if (start < 0 || end <= start) return null
    const svg = outer.slice(start, end + 6)
    const wMatch = svg.match(/\bwidth="([\d.]+)ex"/)
    const hMatch = svg.match(/\bheight="([\d.]+)ex"/)
    const vaMatch = svg.match(/vertical-align:\s*(-?[\d.]+)ex/)
    const vbMatch = svg.match(/\bviewBox="([^"]+)"/)
    const exPx = fontSize * (display ? 0.52 : 0.46)
    const widthPx = (Number(wMatch?.[1]) || 4) * exPx
    const heightPx = (Number(hMatch?.[1]) || 2) * exPx
    const valignEx = Number(vaMatch?.[1]) || 0
    const descentPx = Math.max(0, -valignEx * exPx)
    const ascentPx = Math.max(fontSize * 0.72, heightPx - descentPx)
    const inner = svg
      .slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'))
      .replace(/currentColor/g, `#${colorHex}`)
    return {
      viewBox: vbMatch?.[1] ?? `0 0 ${Math.round(widthPx * 100)} ${Math.round(heightPx * 100)}`,
      widthPx,
      heightPx,
      ascentPx,
      descentPx,
      inner,
    }
  } catch {
    return null
  }
}

function estimateCharWidth(ch: string, fontSize: number): number {
  if (/[\u3000-\u9fff\uff00-\uffef]/.test(ch)) return fontSize * 1.02
  if (ch === ' ') return fontSize * 0.32
  if (/[ilI1.,;:!'|]/.test(ch)) return fontSize * 0.3
  if (/[MWmw@#%&]/.test(ch)) return fontSize * 0.82
  if (/[A-Z]/.test(ch)) return fontSize * 0.66
  return fontSize * 0.54
}

function wrapByWidth(text: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  let width = 0
  for (const ch of String(text ?? '')) {
    const w = estimateCharWidth(ch, fontSize)
    if (line && width + w > maxWidth) {
      lines.push(line)
      line = ''
      width = 0
    }
    line += ch
    width += w
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, -1)}…`
  }
  return lines
}

interface TextAtom {
  kind: 'text'
  text: string
  width: number
  ascent: number
  descent: number
  fontSize: number
  color: string
  bold: boolean
}

interface InlineMathAtom {
  kind: 'inline-math'
  metrics: FormulaMetrics
  width: number
  ascent: number
  descent: number
  drawWidth: number
  drawHeight: number
}

interface DisplayMathAtom {
  kind: 'display-math'
  metrics: FormulaMetrics
}

type LayoutAtom = TextAtom | InlineMathAtom | DisplayMathAtom

interface LaidOutLine {
  items: ((TextAtom | InlineMathAtom) & { x: number })[]
  ascent: number
  descent: number
  gapAfter: number
}

function tokenizeTextForWrap(text: string, fontSize: number, colorHex: string, bold = false): TextAtom[] {
  const atoms: TextAtom[] = []
  let buffer = ''
  const flush = () => {
    if (!buffer) return
    let w = 0
    for (const ch of buffer) w += estimateCharWidth(ch, fontSize) * (bold ? 1.04 : 1)
    atoms.push({
      kind: 'text',
      text: buffer,
      width: w,
      ascent: fontSize * 0.86,
      descent: fontSize * 0.24,
      fontSize,
      color: colorHex,
      bold,
    })
    buffer = ''
  }
  for (const ch of String(text ?? '')) {
    if (/[\u3000-\u9fff\uff00-\uffef]/.test(ch)) {
      flush()
      atoms.push({
        kind: 'text',
        text: ch,
        width: estimateCharWidth(ch, fontSize) * (bold ? 1.04 : 1),
        ascent: fontSize * 0.86,
        descent: fontSize * 0.24,
        fontSize,
        color: colorHex,
        bold,
      })
    } else if (ch === ' ') {
      buffer += ch
      flush()
    } else {
      buffer += ch
    }
  }
  flush()
  return atoms
}

interface RichBlock {
  label?: string
  labelColor?: string
  text: string
  color?: string
  indent?: number
}

function layoutBlocksToLines(
  blocks: RichBlock[],
  maxWidth: number,
  fontSize: number,
  defaultColor: string,
): LaidOutLine[] {
  const lines: LaidOutLine[] = []
  const lineGap = Math.round(fontSize * 0.42)
  const paraGap = Math.round(fontSize * 0.5)

  for (const [blockIdx, block] of blocks.entries()) {
    const color = stripHash(block.color ?? defaultColor)
    const indent = block.indent ?? 0
    const normalized = String(block.text ?? '')
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => `$$${f.replace(/\s*\r?\n\s*/g, ' ').trim()}$$`)
      .replace(/\\\[([\s\S]+?)\\\]/g, (_, f) => `\\[${f.replace(/\s*\r?\n\s*/g, ' ').trim()}\\]`)
      .replace(/\\(?:textbf|textit|emph)\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_, inner) => inner)

    const paragraphs = normalized.split(/\r?\n/)
    for (const [pIdx, para] of paragraphs.entries()) {
      if (!para.trim() && !(pIdx === 0 && block.label)) continue
      const atoms: LayoutAtom[] = []
      if (pIdx === 0 && block.label) {
        atoms.push(...tokenizeTextForWrap(block.label, fontSize, stripHash(block.labelColor ?? color), true))
      }

      for (const seg of para.split(MATH_SPLIT_RE)) {
        if (!seg) continue
        if ((seg.startsWith('$') && seg.endsWith('$')) || seg.startsWith('\\[') || seg.startsWith('\\(')) {
          const display = seg.startsWith('$$') || seg.startsWith('\\[')
          const formula = stripMathDelimiters(seg)
          const metrics = convertFormulaToSvgMetrics(formula, display, fontSize, color)
          if (metrics) {
            if (display) {
              atoms.push({ kind: 'display-math', metrics })
            } else {
              const avail = maxWidth - indent - 12
              const scale = metrics.widthPx > avail ? avail / metrics.widthPx : 1
              atoms.push({
                kind: 'inline-math',
                metrics,
                width: metrics.widthPx * scale + 4,
                ascent: metrics.ascentPx * scale,
                descent: metrics.descentPx * scale,
                drawWidth: metrics.widthPx * scale,
                drawHeight: metrics.heightPx * scale,
              })
            }
          } else {
            atoms.push(...tokenizeTextForWrap(formula, fontSize, color, false))
          }
        } else {
          const cleanText = seg.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
          atoms.push(...tokenizeTextForWrap(cleanText, fontSize, color, false))
        }
      }

      let curItems: ((TextAtom | InlineMathAtom) & { x: number })[] = []
      let curX = indent
      let curAscent = fontSize * 0.9
      let curDescent = fontSize * 0.25

      const pushLine = (extraBottom = lineGap) => {
        if (!curItems.length) return
        lines.push({ items: curItems, ascent: curAscent, descent: curDescent, gapAfter: extraBottom })
        curItems = []
        curX = indent
        curAscent = fontSize * 0.9
        curDescent = fontSize * 0.25
      }

      for (const atom of atoms) {
        if (atom.kind === 'display-math') {
          pushLine(Math.round(fontSize * 0.35))
          const m = atom.metrics
          const avail = maxWidth - indent
          const scale = m.widthPx > avail ? avail / m.widthPx : 1
          const dw = m.widthPx * scale
          const dh = m.heightPx * scale
          const cx = indent + Math.max(0, (avail - dw) / 2)
          lines.push({
            items: [
              {
                kind: 'inline-math',
                x: cx,
                metrics: m,
                width: dw,
                drawWidth: dw,
                drawHeight: dh,
                ascent: dh,
                descent: 0,
              },
            ],
            ascent: dh,
            descent: 0,
            gapAfter: Math.round(fontSize * 0.45),
          })
          continue
        }
        if (curItems.length && curX + atom.width > maxWidth) {
          pushLine(lineGap)
        }
        curItems.push({ ...atom, x: curX })
        curX += atom.width
        curAscent = Math.max(curAscent, atom.ascent)
        curDescent = Math.max(curDescent, atom.descent)
      }
      pushLine(pIdx === paragraphs.length - 1 ? paraGap : lineGap)
    }

    if (blockIdx < blocks.length - 1 && lines.length) {
      lines[lines.length - 1].gapAfter = Math.max(lines[lines.length - 1].gapAfter, Math.round(fontSize * 0.65))
    }
  }
  return lines
}

function renderLinesToSvg(lines: LaidOutLine[], maxWidth: number): RichPage {
  let y = 4
  const chunks: string[] = []
  for (const line of lines) {
    const baseline = y + line.ascent
    let textBuf: { x: number; text: string; color: string; bold: boolean; fontSize: number } | null = null
    const flushText = () => {
      if (!textBuf) return
      const weight = textBuf.bold ? ' font-weight="600"' : ''
      chunks.push(
        `<text x="${textBuf.x.toFixed(1)}" y="${baseline.toFixed(1)}" font-family='${textBuf.bold ? CJK_BOLD : CJK_REG}'${weight} font-size="${textBuf.fontSize}" fill="#${textBuf.color}">${escapeHtml(textBuf.text)}</text>`,
      )
      textBuf = null
    }
    for (const item of line.items) {
      if (item.kind === 'text') {
        if (
          textBuf &&
          textBuf.color === item.color &&
          textBuf.bold === item.bold &&
          textBuf.fontSize === item.fontSize
        ) {
          textBuf.text += item.text
        } else {
          flushText()
          textBuf = {
            x: item.x,
            text: item.text,
            color: item.color,
            bold: item.bold,
            fontSize: item.fontSize,
          }
        }
      } else {
        flushText()
        const top = baseline - item.ascent
        chunks.push(
          `<svg x="${(item.x + 1).toFixed(1)}" y="${top.toFixed(1)}" width="${item.drawWidth.toFixed(1)}" height="${item.drawHeight.toFixed(1)}" viewBox="${item.metrics.viewBox}" overflow="visible">${item.metrics.inner}</svg>`,
        )
      }
    }
    flushText()
    y = baseline + line.descent + line.gapAfter
  }
  const height = Math.max(40, Math.ceil(y + 4))
  return {
    width: maxWidth,
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${maxWidth}" height="${height}" viewBox="0 0 ${maxWidth} ${height}">${chunks.join('')}</svg>`,
  }
}

function composeRichPages(
  blocks: RichBlock[],
  opts: { maxWidth: number; maxHeight: number; preferredFontSize: number; minFontSize: number; defaultColor: string },
): RichPage[] {
  const candidates: number[] = []
  for (let fs = opts.preferredFontSize; fs >= opts.minFontSize; fs -= 2) candidates.push(fs)
  if (candidates[candidates.length - 1] !== opts.minFontSize) candidates.push(opts.minFontSize)

  let chosenLines: LaidOutLine[] = []
  for (const fs of candidates) {
    const lines = layoutBlocksToLines(blocks, opts.maxWidth, fs, opts.defaultColor)
    const totalH = lines.reduce((sum, l) => sum + l.ascent + l.descent + l.gapAfter, 8)
    chosenLines = lines
    if (totalH <= opts.maxHeight) {
      return [renderLinesToSvg(lines, opts.maxWidth)]
    }
  }

  const pages: RichPage[] = []
  let bucket: LaidOutLine[] = []
  let bucketH = 8
  for (const line of chosenLines) {
    const lineH = line.ascent + line.descent + line.gapAfter
    if (bucket.length && bucketH + lineH > opts.maxHeight) {
      pages.push(renderLinesToSvg(bucket, opts.maxWidth))
      bucket = []
      bucketH = 8
    }
    bucket.push(line)
    bucketH += lineH
  }
  if (bucket.length) pages.push(renderLinesToSvg(bucket, opts.maxWidth))
  return pages.length ? pages : [renderLinesToSvg([], opts.maxWidth)]
}

function buildRouteRail(theme: PptTheme, mark: string, number: number, total: number, y = 92): SceneItem[] {
  const items: SceneItem[] = []
  const n = Math.max(1, total)
  const cur = Math.max(0, Math.min(n - 1, number - 1))
  const stations = Math.min(n, 12)
  const active = n <= 12 ? cur : Math.min(stations - 1, Math.round((cur / Math.max(1, n - 1)) * (stations - 1)))

  if (stations === 1) {
    const cx = 104
    items.push(
      { type: 'line', x1: BODY_X, y1: y, x2: cx - 11, y2: y, color: mark, width: 1.8 },
      { type: 'line', x1: cx + 11, y1: y, x2: 1214, y2: y, color: theme.railMuted, width: 1.2, dash: 'dash' },
      { type: 'dot', cx, cy: y, r: 8.5, fill: theme.background, stroke: mark, strokeWidth: 1.8 },
      { type: 'dot', cx, cy: y, r: 3.8, fill: mark },
      { type: 'dot', cx: 1220, cy: y, r: 3.8, fill: theme.background, stroke: theme.railMuted, strokeWidth: 1.4 },
    )
    return items
  }

  const x0 = 96
  const xEnd = 1216
  const step = (xEnd - x0) / (stations - 1)
  const xs = Array.from({ length: stations }, (_, i) => Math.round(x0 + i * step))

  items.push({ type: 'line', x1: BODY_X, y1: y, x2: xs[0] - (active === 0 ? 11 : 6), y2: y, color: mark, width: 1.8 })
  for (let i = 0; i < stations - 1; i++) {
    const a = xs[i] + (i === active ? 11 : 6)
    const b = xs[i + 1] - (i + 1 === active ? 11 : 6)
    if (b <= a) continue
    items.push(
      i < active
        ? { type: 'line', x1: a, y1: y, x2: b, y2: y, color: mark, width: 1.8 }
        : { type: 'line', x1: a, y1: y, x2: b, y2: y, color: theme.railMuted, width: 1.2, dash: 'dash' },
    )
  }
  for (let i = 0; i < stations; i++) {
    if (i < active) {
      items.push({ type: 'dot', cx: xs[i], cy: y, r: 3.6, fill: mark })
    } else if (i === active) {
      items.push(
        { type: 'dot', cx: xs[i], cy: y, r: 8.5, fill: theme.background, stroke: mark, strokeWidth: 1.8 },
        { type: 'dot', cx: xs[i], cy: y, r: 3.8, fill: mark },
      )
    } else {
      items.push({ type: 'dot', cx: xs[i], cy: y, r: 3.8, fill: theme.background, stroke: theme.railMuted, strokeWidth: 1.4 })
    }
  }
  return items
}

function coverScene(theme: PptTheme, kicker: string, title: string, subtitle: string): SceneItem[] {
  const tint = (t: number) => mixHex(theme.accent, t, theme.background)
  const p: Record<string, [number, number]> = {
    A: [1280, 0], B: [1010, 0], C: [1150, 150], D: [1280, 260], E: [960, 250], F: [1080, 380],
    G: [1280, 470], H: [900, 470], I: [1010, 600], J: [1280, 720], K: [880, 720], L: [1160, 560],
  }
  const facets: [string, number][] = [
    ['BCA', 0.1], ['ACD', 0.22], ['BEC', 0.05], ['CEF', 0.34], ['CFD', 0.14], ['DFG', 0.07], ['EHF', 0.18],
    ['FHI', 0.06], ['FIL', 0.88], ['FLG', 0.26], ['GLJ', 0.12], ['LIJ', 0.2], ['IKJ', 0.09], ['HKI', 0.05],
  ]
  const items: SceneItem[] = facets.map(([keys, t]) => ({
    type: 'poly',
    points: [...keys].map(k => p[k]),
    fill: tint(t),
    stroke: theme.background,
    strokeWidth: 1.5,
  }))
  items.push(
    { type: 'poly', points: [[860, 96], [960, 250], [830, 236]], stroke: theme.accent, strokeWidth: 1.2 },
    { type: 'poly', points: [[900, 470], [852, 506], [895, 530]], fill: theme.highlight },
    ...([[860, 96], [830, 236], [960, 250], [900, 470]] as [number, number][]).map(([cx, cy]) => ({
      type: 'dot' as const, cx, cy, r: 3.5, fill: theme.accent,
    })),
  )

  const titleLines = wrapByWidth(title, 46, 700, 3)
  const lineHeight = 62
  const blockH = 44 + 22 + titleLines.length * lineHeight + 56
  const startY = Math.round((SLIDE_H - blockH) / 2) - 10
  const titleY = startY + 50
  const railY = titleY + titleLines.length * lineHeight + 28

  items.push(
    { type: 'poly', points: [[96, startY + 10], [108, startY + 10], [108, startY + 22], [96, startY + 22]], fill: theme.accent },
    { type: 'text', x: 124, y: startY, w: 560, h: 32, text: kicker, size: 16, bold: true, role: 'kicker', color: theme.accent, spacing: 3.2 },
    { type: 'text', x: 96, y: titleY, w: 740, h: titleLines.length * lineHeight, lines: titleLines, lineHeight, size: 46, bold: true, role: 'display', color: theme.text, valign: 'top' },
    { type: 'line', x1: 96, y1: railY, x2: 162, y2: railY, color: theme.accent, width: 2 },
    { type: 'line', x1: 184, y1: railY, x2: 344, y2: railY, color: theme.railMuted, width: 1.2, dash: 'dash' },
    { type: 'dot', cx: 173, cy: railY, r: 8, fill: theme.background, stroke: theme.accent, strokeWidth: 1.8 },
    { type: 'dot', cx: 173, cy: railY, r: 3.5, fill: theme.accent },
    { type: 'dot', cx: 350, cy: railY, r: 3.8, fill: theme.background, stroke: theme.railMuted, strokeWidth: 1.4 },
    { type: 'text', x: 96, y: railY + 26, w: 680, h: 28, text: subtitle, size: 15, color: theme.muted },
  )
  return items
}

function contentScene(
  theme: PptTheme,
  opts: {
    number: number
    total: number
    tone: 'question' | 'solution'
    heading: string
    aside: string
    page: RichPage
    bgDataUri?: string | null
  },
): SceneItem[] {
  const isSol = opts.tone === 'solution'
  const mark = isSol ? theme.highlight : theme.accent
  const items: SceneItem[] = []
  if (opts.bgDataUri && theme.id === 'review-classic') {
    items.push({ type: 'bg-image', data: opts.bgDataUri })
  }
  items.push(
    { type: 'text', x: BODY_X, y: 30, w: 56, h: 42, text: String(opts.number).padStart(2, '0'), size: 32, bold: true, role: 'numeral', color: mark },
    { type: 'line', x1: BODY_X + 60, y1: 40, x2: BODY_X + 60, y2: 63, color: theme.border, width: 1.2 },
    { type: 'text', x: BODY_X + 76, y: 32, w: 580, h: 38, text: opts.heading, size: 22, bold: true, role: 'display', color: theme.text },
  )
  if (opts.aside) {
    items.push({ type: 'text', x: 740, y: 34, w: 484, h: 34, text: opts.aside, size: 13.5, color: theme.muted, align: 'right' })
  }
  items.push(...buildRouteRail(theme, mark, opts.number, opts.total, 92))
  items.push({ type: 'image', x: BODY_X, y: 124, page: opts.page })
  return items
}

function textItemToSvg(item: Extract<SceneItem, { type: 'text' }>): string[] {
  const lines = item.lines ?? [item.text ?? '']
  const lh = item.lineHeight ?? item.size * 1.25
  const blockH = lines.length * lh
  const top = item.valign === 'top' ? item.y : item.y + (item.h - blockH) / 2
  const anchor = item.align === 'right' ? 'end' : item.align === 'center' ? 'middle' : 'start'
  const x = item.align === 'right' ? item.x + item.w : item.align === 'center' ? item.x + item.w / 2 : item.x
  const spacing = item.spacing ? ` letter-spacing="${item.spacing}"` : ''
  const weight = item.bold ? ' font-weight="700"' : ''
  const fontFam = item.role === 'numeral' ? '"JetBrains Mono", Inter, sans-serif' : CJK_REG
  return lines.map((line, i) => {
    const baseline = top + i * lh + lh / 2 + item.size * 0.35
    return `<text x="${x.toFixed(1)}" y="${baseline.toFixed(1)}" text-anchor="${anchor}" font-family='${fontFam}'${weight} font-size="${item.size}"${spacing} fill="#${item.color}">${escapeHtml(line)}</text>`
  })
}

function sceneToSvg(items: SceneItem[], theme: PptTheme): string {
  const parts: string[] = [`<rect width="${SLIDE_W}" height="${SLIDE_H}" fill="#${theme.background}"/>`]
  for (const item of items) {
    if (item.type === 'bg-image') {
      parts.push(`<image href="${item.data}" x="0" y="0" width="${SLIDE_W}" height="${SLIDE_H}" preserveAspectRatio="xMidYMid slice" opacity="0.65"/>`)
    } else if (item.type === 'poly') {
      const fill = item.fill ? `#${item.fill}` : 'none'
      const stroke = item.stroke ? ` stroke="#${item.stroke}" stroke-width="${item.strokeWidth ?? 1}" stroke-linejoin="round"` : ''
      parts.push(`<polygon points="${item.points.map(pt => pt.join(',')).join(' ')}" fill="${fill}"${stroke}/>`)
    } else if (item.type === 'line') {
      const dash = item.dash === 'dash' ? ' stroke-dasharray="3 5"' : ''
      parts.push(`<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="#${item.color}" stroke-width="${item.width}"${dash}/>`)
    } else if (item.type === 'dot') {
      const fill = item.fill ? `#${item.fill}` : 'none'
      const stroke = item.stroke ? ` stroke="#${item.stroke}" stroke-width="${item.strokeWidth ?? 1.5}"` : ''
      parts.push(`<circle cx="${item.cx}" cy="${item.cy}" r="${item.r}" fill="${fill}"${stroke}/>`)
    } else if (item.type === 'text') {
      parts.push(...textItemToSvg(item))
    } else if (item.type === 'image') {
      const inner = item.page.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
      parts.push(`<g transform="translate(${item.x}, ${item.y})">${inner}</g>`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_W}" height="${SLIDE_H}" viewBox="0 0 ${SLIDE_W} ${SLIDE_H}">${parts.join('')}</svg>`
}

let cachedBgUri: string | null = null
async function loadPaperBgDataUri(): Promise<string | null> {
  if (cachedBgUri) return cachedBgUri
  try {
    const res = await fetch('./images/ppt-paper-bg.jpg')
    if (!res.ok) return null
    const blob = await res.blob()
    cachedBgUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    return cachedBgUri
  } catch {
    return null
  }
}

export async function generateSlidesForPaper(
  paper: SavedPaper,
  themeId = 'review-classic',
): Promise<{ slides: GeneratedSlide[]; theme: PptTheme }> {
  const theme = PPT_THEMES.find(t => t.id === themeId) ?? PPT_THEMES[0]
  const bgDataUri = await loadPaperBgDataUri()
  const modeLabel = ({ mistake: '错题巩固', exam: '模拟测试', topic: '专题练习' } as Record<string, string>)[paper.mode] ?? '练习讲评'
  const totalQuestions = paper.items.length
  const totalScore = paper.items.reduce((s, it) => s + Number(it.score || 0), 0)
  const slides: GeneratedSlide[] = []

  const pushSlide = (
    items: SceneItem[],
    meta: Omit<GeneratedSlide, 'index' | 'svg' | 'items'>,
  ) => {
    slides.push({
      ...meta,
      index: slides.length,
      svg: sceneToSvg(items, theme),
      items,
    })
  }

  pushSlide(
    coverScene(
      theme,
      modeLabel,
      paper.title,
      `共 ${totalQuestions} 题 · 总分 ${totalScore} 分 · USTC QBank Studio`,
    ),
    { title: paper.title, type: 'cover', questionId: null, notes: null },
  )

  for (const [index, item] of paper.items.entries()) {
    const q = item.question
    const refShort = truncateText(q.source?.ref ?? '', 36)
    const badge = item.is_original_redo ? '错题重做' : ''
    const qType = typeLabel(q.type)

    // Question slide(s)
    const qBlocks: RichBlock[] = [{ text: q.stem.md, color: theme.body }]
    if (q.options?.length) {
      for (const opt of q.options) {
        qBlocks.push({ label: `${opt.key}. `, labelColor: theme.accent, text: opt.md, color: theme.body, indent: 18 })
      }
    }
    const qPages = composeRichPages(qBlocks, {
      maxWidth: BODY_W,
      maxHeight: 540,
      preferredFontSize: 25,
      minFontSize: 18,
      defaultColor: theme.body,
    })

    for (const [pageIdx, page] of qPages.entries()) {
      const suffix = qPages.length > 1 ? `（${pageIdx + 1}/${qPages.length}）` : ''
      const items = contentScene(theme, {
        number: index + 1,
        total: totalQuestions,
        tone: 'question',
        heading: `${qType} · ${item.score} 分${suffix}`,
        aside: [badge, refShort].filter(Boolean).join('　·　'),
        page,
        bgDataUri,
      })
      pushSlide(items, {
        title: `第 ${index + 1} 题 · 作答${suffix}`,
        type: 'question',
        questionNumber: index + 1,
        totalQuestions,
        questionId: q.id,
        notes: `题目出处：${q.source?.ref || '未标注'}\n知识点：${(q.tags?.kp_ids ?? []).join('、')}`,
      })
    }

    // Solution slide(s)
    const solBlocks: RichBlock[] = []
    if (shouldShowAnswerLine(q)) {
      solBlocks.push({ label: '【答案】', labelColor: theme.highlight, text: q.answer.md, color: theme.body })
    }
    const solBody = resolveSolutionText(q)
    if (solBody) {
      solBlocks.push({
        label: q.type === 'proof' ? '【证明】' : '【详解】',
        labelColor: theme.highlight,
        text: solBody,
        color: theme.body,
      })
    }
    const reviewNote = [item.comment_md, q.quality?.note].filter(Boolean).join('；')
    if (reviewNote) {
      solBlocks.push({ label: '【点评与易错】', labelColor: 'C01C28', text: reviewNote, color: 'C01C28' })
    }

    const solPages = composeRichPages(solBlocks, {
      maxWidth: BODY_W,
      maxHeight: 545,
      preferredFontSize: 22,
      minFontSize: 16,
      defaultColor: theme.body,
    })

    const notesText = [
      `题目出处：${q.source?.ref || '未标注'}`,
      `知识点：${(q.tags?.kp_ids ?? []).join('、')}`,
      `难度：${q.tags?.difficulty ?? 3} / 5`,
      `答案来源：${originLabel(q.answer.origin)}（${q.answer.origin_detail || '无'}）`,
      `完整解析：\n${q.solution.md || q.answer.md}`,
    ].join('\n')

    for (const [pageIdx, page] of solPages.entries()) {
      const suffix = pageIdx > 0 ? `（续 ${pageIdx + 1}/${solPages.length}）` : ''
      const items = contentScene(theme, {
        number: index + 1,
        total: totalQuestions,
        tone: 'solution',
        heading: `解析 · ${qType}${suffix}`,
        aside: refShort,
        page,
        bgDataUri,
      })
      pushSlide(items, {
        title: `第 ${index + 1} 题 · 解析${pageIdx > 0 ? ` (${pageIdx + 1})` : ''}`,
        type: 'solution',
        questionNumber: index + 1,
        totalQuestions,
        questionId: q.id,
        notes: pageIdx === 0 ? notesText : null,
      })
    }
  }

  return { slides, theme }
}

async function svgStringToPngDataUrl(svgString: string, widthPx: number, heightPx: number, scale = 2): Promise<string> {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(widthPx * scale)
    canvas.height = Math.round(heightPx * scale)
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, widthPx, heightPx)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function exportSlidesToPptx(
  paper: SavedPaper,
  slides: GeneratedSlide[],
  theme: PptTheme,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'USTC QBank Studio'
  pptx.subject = '课程讲评与错题复盘'
  pptx.title = paper.title
  const inch = (px: number) => px / PX_PER_IN

  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i + 1, slides.length)
    const s = slides[i]
    const slide = pptx.addSlide()
    slide.background = { color: theme.background }
    // Render crisp 2x retina PNG from the unified scene SVG (contains vector MathJax equations & paper texture)
    const pngData = await svgStringToPngDataUrl(s.svg, SLIDE_W, SLIDE_H, 2)
    slide.addImage({ data: pngData, x: 0, y: 0, w: inch(SLIDE_W), h: inch(SLIDE_H) })
    if (s.notes) slide.addNotes(s.notes)
  }

  const safeTitle = paper.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'review-slides'
  await pptx.writeFile({ fileName: `${safeTitle}.pptx` })
}
