import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { RichMath, QuestionFigures } from './RichMath'
import { UstcBindingLine } from './UstcBindingLine'
import { chineseNumber } from '../engine/paperAssembler'
import {
  buildCommentText,
  extractChoiceKey,
  formatDisplayTerm,
  formatSectionScore,
  groupItems,
  resolveSolutionText,
  shouldShowAnswerLine,
  splitSolutionParagraphs,
  type GroupedSection,
} from '../engine/examRenderer'
import type {
  PaperHeaderMeta,
  PaperItem,
  PdfExportMode,
  PdfTemplateId,
  SavedPaper,
  SourceConfig,
} from '../types/study'

// Exact 96 DPI A4 dimensions (210mm x 297mm) mirroring dsh-study ustc-exam & gaokao geometry
const A4_W = 794
const A4_H = 1123
const PAD_TOP = 87 // 23mm
const PAD_BOTTOM = 48 // footer inside bottom margin (~11mm footskip)
const FOOTER_H = 42
const PAD_LEFT_ODD = 113 // 30mm (binding line clearance)
const PAD_LEFT_EVEN = 76 // 20mm (no binding line on even pages)
const PAD_RIGHT = 76 // 20mm
const BINDING_W = 106 // 28mm
const MEASURE_W = A4_W - PAD_LEFT_ODD - PAD_RIGHT // 605px conservative content width
const USABLE_BODY_H = A4_H - PAD_TOP - PAD_BOTTOM - FOOTER_H - 14 // ~932px body height per A4 page

type ExamBlock =
  | { id: string; kind: 'header'; gapBefore: number; keepWithNext?: boolean }
  | { id: string; kind: 'section'; secIdx: number; group: GroupedSection; gapBefore: number; keepWithNext: true }
  | { id: string; kind: 'question-stem'; item: PaperItem; seq: number; gapBefore: number; keepWithNext?: boolean }
  | { id: string; kind: 'answer-line'; item: PaperItem; seq: number; gapBefore: number; keepWithNext?: boolean }
  | {
      id: string
      kind: 'solution-para'
      item: PaperItem
      seq: number
      paraIdx: number
      isFirst: boolean
      isLast: boolean
      text: string
      gapBefore: number
      keepWithNext?: boolean
    }
  | { id: string; kind: 'comment'; item: PaperItem; seq: number; text: string; gapBefore: number; keepWithNext?: boolean }
  | { id: string; kind: 'write-space'; item: PaperItem; seq: number; gapBefore: number; keepWithNext?: boolean }

export interface PaginatedExamPreviewProps {
  paper: SavedPaper
  templateId: PdfTemplateId
  exportMode: PdfExportMode
  splitTab: 'paper' | 'answers'
  fields: PaperHeaderMeta
  sourceMap: Record<string, SourceConfig>
  onPageCountChange?: (count: number) => void
}

export function PaginatedExamPreview({
  paper,
  templateId,
  exportMode,
  splitTab,
  fields,
  sourceMap,
  onPageCountChange,
}: PaginatedExamPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)

  const [containerWidth, setContainerWidth] = useState<number>(A4_W)
  const [measureVersion, setMeasureVersion] = useState(0)
  const [pages, setPages] = useState<number[][]>([])
  const [blockHeights, setBlockHeights] = useState<number[]>([])

  const showSolutions = exportMode === 'inline-solution' || splitTab === 'answers'
  const answerOnly = exportMode === 'split' && splitTab === 'answers'
  const groups = useMemo(() => groupItems(paper.items), [paper.items])
  const totalScore = useMemo(
    () => paper.items.reduce((sum, it) => sum + Number(it.score || 0), 0),
    [paper.items],
  )

  const blocks = useMemo<ExamBlock[]>(() => {
    const list: ExamBlock[] = [{ id: 'header', kind: 'header', gapBefore: 0 }]
    let seq = 0
    groups.forEach((group, secIdx) => {
      list.push({
        id: `sec-${secIdx}-${group.key}`,
        kind: 'section',
        secIdx,
        group,
        gapBefore: secIdx === 0 ? 10 : 18,
        keepWithNext: true,
      })

      for (const item of group.items) {
        seq++
        const q = item.question
        const solText = resolveSolutionText(q)
        const comment = buildCommentText(item, q)
        const hasAnswer = showSolutions && shouldShowAnswerLine(q)
        const solParas = showSolutions ? splitSolutionParagraphs(solText) : []
        const hasWriteSpace = !showSolutions && (q.type === 'solve' || q.type === 'proof')

        if (!answerOnly) {
          list.push({
            id: `q-stem-${seq}-${item.question_id}`,
            kind: 'question-stem',
            item,
            seq,
            gapBefore: 14,
            keepWithNext: hasWriteSpace,
          })
        }

        if (showSolutions) {
          if (hasAnswer) {
            list.push({
              id: `q-ans-${seq}-${item.question_id}`,
              kind: 'answer-line',
              item,
              seq,
              gapBefore: answerOnly ? 14 : 6,
            })
          }
          solParas.forEach((para, pIdx) => {
            list.push({
              id: `q-sol-${seq}-${pIdx}-${item.question_id}`,
              kind: 'solution-para',
              item,
              seq,
              paraIdx: pIdx,
              isFirst: pIdx === 0,
              isLast: pIdx === solParas.length - 1,
              text: para,
              gapBefore: pIdx === 0 ? (answerOnly && !hasAnswer ? 14 : 6) : 5,
            })
          })
          if (comment) {
            list.push({
              id: `q-cmt-${seq}-${item.question_id}`,
              kind: 'comment',
              item,
              seq,
              text: comment,
              gapBefore: 6,
            })
          }
        } else if (hasWriteSpace) {
          list.push({
            id: `q-ws-${seq}-${item.question_id}`,
            kind: 'write-space',
            item,
            seq,
            gapBefore: 0,
          })
        }
      }
    })
    return list
  }, [groups, showSolutions, answerOnly])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      if (w > 0) setContainerWidth(w)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (active) setMeasureVersion(v => v + 1)
      })
    }
    return () => {
      active = false
    }
  }, [])

  useLayoutEffect(() => {
    const stage = measureRef.current
    if (!stage) return

    const measure = () => {
      const nodes = stage.querySelectorAll<HTMLElement>('[data-block-idx]')
      const heights: number[] = new Array(blocks.length).fill(0)
      nodes.forEach(node => {
        const idx = Number(node.dataset.blockIdx)
        if (!Number.isNaN(idx)) {
          heights[idx] = Math.ceil(node.getBoundingClientRect().height)
        }
      })

      const packed: number[][] = []
      let current: number[] = []
      let usedH = 0

      for (let i = 0; i < blocks.length; i++) {
        const blk = blocks[i]
        const h = heights[i] ?? 0
        const gap = current.length > 0 ? blk.gapBefore : 0

        // Avoid breaking immediately after a keepWithNext block (e.g. section heading) so it is never orphaned
        const prevKeep = current.length > 0 && Boolean(blocks[current[current.length - 1]].keepWithNext)

        // When deciding if a keepWithNext block fits on the current page, include its immediate follower
        const nextBlk = i + 1 < blocks.length ? blocks[i + 1] : null
        const nextPairH = blk.keepWithNext && nextBlk ? (heights[i + 1] ?? 0) + nextBlk.gapBefore : 0
        const needed = blk.keepWithNext && h + nextPairH <= USABLE_BODY_H ? h + nextPairH : h

        if (current.length > 0 && !prevKeep && usedH + gap + needed > USABLE_BODY_H) {
          packed.push(current)
          current = [i]
          usedH = h
        } else {
          current.push(i)
          usedH += gap + h
        }
      }
      if (current.length > 0) packed.push(current)
      if (!packed.length && blocks.length > 0) packed.push(blocks.map((_, i) => i))

      setBlockHeights(heights)
      setPages(packed)
      onPageCountChange?.(packed.length)
    }

    measure()
    const raf = requestAnimationFrame(measure)
    const ro = new ResizeObserver(measure)
    ro.observe(stage)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [blocks, templateId, exportMode, splitTab, fields, measureVersion, onPageCountChange])

  const writeSpacePx =
    fields.writeSpace === 'compact' ? 113 : fields.writeSpace === 'spacious' ? 265 : 208

  const renderBlock = (block: ExamBlock) => {
    if (block.kind === 'header') {
      return (
        <div>
          {templateId === 'gaokao' ? (
            answerOnly ? (
              <header className="text-center mb-3">
                <div className="exam-heiti-bold text-[19px] text-black">
                  {fields.courseTitle}——参考答案与解析
                </div>
              </header>
            ) : (
              <>
                <div className="exam-heiti-bold text-[14.5px] tracking-[0.14em] text-black mb-2">
                  绝密 ★ 启用前
                </div>
                <header className="text-center mb-3.5">
                  <div className="text-[19px] text-black leading-snug">{fields.courseTitle}</div>
                  <div className="exam-heiti-bold text-[28px] tracking-[0.22em] text-black mt-1">
                    {fields.subject}
                  </div>
                </header>
                <div className="mb-2 text-[13.5px] leading-[1.7] text-black">
                  <div className="exam-heiti-bold mb-0.5">注意事项：</div>
                  <ol className="list-decimal pl-5 space-y-0.5">
                    <li>答卷前，考生务必将自己的姓名、学号或准考证号填写清楚。</li>
                    <li>客观题请在括号内填涂正确选项；非选择题应写出必要的文字说明、证明过程或演算步骤。</li>
                    <li>
                      本试卷共 {paper.items.length} 题，满分 {totalScore} 分。
                    </li>
                  </ol>
                </div>
              </>
            )
          ) : (
            <>
              <header className="text-center mb-3">
                {fields.schoolTerm && (
                  <div className="exam-heiti-bold text-[19px] leading-[1.45] text-black">
                    {formatDisplayTerm(fields.schoolTerm)}
                  </div>
                )}
                <div className="exam-heiti-bold text-[19px] leading-[1.45] text-black mt-1">
                  {fields.courseTitle}
                  {answerOnly ? ' ——参考答案与解析' : ''}
                </div>
                <div className="mt-2.5 text-[14.5px] text-black">
                  考试时间{' '}
                  <span className="inline-block min-w-[116px] border-b border-black px-3 text-center leading-[1.3]">
                    {fields.examDate}
                  </span>
                  <span className="inline-block w-11" />
                  考试形式{' '}
                  <span className="inline-block min-w-[116px] border-b border-black px-3 text-center leading-[1.3]">
                    {fields.examForm}
                  </span>
                </div>
              </header>

              {!answerOnly && groups.length > 0 && (
                <table className="score-table !my-3">
                  <tbody>
                    <tr>
                      <td className="exam-heiti-bold">题号</td>
                      {groups.map((_, i) => (
                        <td key={i}>{chineseNumber(i + 1)}</td>
                      ))}
                      <td className="exam-heiti-bold">总分</td>
                    </tr>
                    <tr>
                      <td className="exam-heiti-bold">满分</td>
                      {groups.map((g, i) => (
                        <td key={i}>{g.score}</td>
                      ))}
                      <td>{totalScore}</td>
                    </tr>
                    <tr>
                      <td className="exam-heiti-bold">得分</td>
                      {groups.map((_, i) => (
                        <td key={i} className="min-w-[44px]">
                          &nbsp;
                        </td>
                      ))}
                      <td className="min-w-[50px]">&nbsp;</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )
    }

    if (block.kind === 'section') {
      const { secIdx, group } = block
      return templateId === 'gaokao' ? (
        <h2 className="exam-heiti-bold text-[15px] text-black">
          {chineseNumber(secIdx + 1)}、{group.title}：{formatSectionScore(group)}
        </h2>
      ) : (
        <h2 className="text-[14.5px] font-normal text-black">
          <span className="exam-heiti-bold">{chineseNumber(secIdx + 1)}.</span> ({formatSectionScore(group)}) {group.title}
        </h2>
      )
    }

    if (block.kind === 'question-stem') {
      const { item, seq } = block
      const q = item.question
      const isGkChoice =
        templateId === 'gaokao' && (q.type === 'single' || q.type === 'multi')
      const isGkScored =
        templateId === 'gaokao' && (q.type === 'solve' || q.type === 'proof')

      return (
        <article className="grid grid-cols-[2.35em_minmax(0,1fr)] items-baseline text-[14.5px] text-black">
          <div className="select-none font-normal">{templateId === 'gaokao' ? `${seq}.` : `(${seq})`}</div>
          <div className="min-w-0">
            <div>
              {isGkScored && <span className="mr-1">({item.score}分)</span>}
              <RichMath text={q.stem.md} displayMathInline inlineFirstParagraph />
              {isGkChoice && (
                <span className="float-right ml-3">
                  (&nbsp;{showSolutions ? extractChoiceKey(q.answer.md) : '\u00A0\u00A0\u00A0\u00A0'}&nbsp;)
                </span>
              )}
            </div>
            <QuestionFigures
              figures={q.stem.figures}
              source={sourceMap[item.source_id]}
              sourceId={item.source_id}
              courseCode={q.course_code}
            />
            {q.options?.length > 0 && (
              <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 mt-2">
                {q.options.map(opt => (
                  <div key={opt.key} className="flex items-baseline gap-1.5">
                    <span className="shrink-0">{opt.key}.</span>
                    <RichMath text={opt.md} displayMathInline inlineFirstParagraph />
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>
      )
    }

    if (block.kind === 'answer-line') {
      const { item, seq } = block
      const q = item.question
      return (
        <div className="grid grid-cols-[2.35em_minmax(0,1fr)] items-baseline text-[14.5px] text-black">
          <div className="select-none font-normal">
            {answerOnly ? (templateId === 'gaokao' ? `${seq}.` : `(${seq})`) : ''}
          </div>
          <div className="min-w-0">
            <span className="exam-heiti-bold mr-[0.55em]">
              {templateId === 'gaokao' ? '【答案】' : '答案：'}
            </span>
            <RichMath text={q.answer.md} displayMathInline inlineFirstParagraph />
          </div>
        </div>
      )
    }

    if (block.kind === 'solution-para') {
      const { item, seq, isFirst, isLast, text } = block
      const q = item.question
      const label = q.type === 'proof' ? '证明' : '解'
      const showSeqHere = answerOnly && isFirst && !shouldShowAnswerLine(q)

      return (
        <div className="grid grid-cols-[2.35em_minmax(0,1fr)] items-baseline text-[14.5px] text-black">
          <div className="select-none font-normal">
            {showSeqHere ? (templateId === 'gaokao' ? `${seq}.` : `(${seq})`) : ''}
          </div>
          <div className="min-w-0">
            {isFirst && (
              <span className="exam-heiti-bold mr-[1em]">
                {templateId === 'gaokao' ? `【${label}】` : label}
              </span>
            )}
            <RichMath text={text} displayMathInline inlineFirstParagraph />
            {isLast && (
              <QuestionFigures
                figures={q.solution?.figures}
                source={sourceMap[item.source_id]}
                sourceId={item.source_id}
                courseCode={q.course_code}
              />
            )}
          </div>
        </div>
      )
    }

    if (block.kind === 'comment') {
      return (
        <div className="grid grid-cols-[2.35em_minmax(0,1fr)] items-baseline text-[14.5px] text-[#C01C28]">
          <div />
          <div className="min-w-0">
            <span className="exam-heiti-bold">点评：</span>
            <RichMath text={block.text} displayMathInline inlineFirstParagraph />
          </div>
        </div>
      )
    }

    return <div style={{ height: `${writeSpacePx}px` }} />
  }

  const scale = containerWidth > 0 ? Math.min(1, containerWidth / A4_W) : 1
  const renderedPages = pages.length ? pages : [blocks.map((_, i) => i)]
  const totalPages = renderedPages.length

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Off-screen measurement container at exact odd-page A4 text width (605px) */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="exam-paper-render pointer-events-none fixed left-[-10000px] top-0 opacity-0"
        style={{ width: `${MEASURE_W}px` }}
      >
        {blocks.map((block, idx) => (
          <div key={block.id} data-block-idx={idx}>
            {renderBlock(block)}
          </div>
        ))}
      </div>

      {/* Discrete A4 Paper Sheets: odd pages show left binding line, even pages do not */}
      <div className="space-y-6">
        {renderedPages.map((pageBlockIndices, pageIdx) => {
          const pageNum = pageIdx + 1
          const isOddPage = pageNum % 2 === 1
          const hasBinding =
            templateId === 'ustc-exam' && fields.showBindingLine && !answerOnly && isOddPage

          const contentH = pageBlockIndices.reduce((sum, idx, pos) => {
            const gap = pos > 0 ? (blocks[idx]?.gapBefore ?? 0) : 0
            return sum + (blockHeights[idx] ?? 0) + gap
          }, 0)
          const logicalPageH = Math.max(A4_H, PAD_TOP + PAD_BOTTOM + FOOTER_H + contentH + 16)

          const footerText =
            templateId === 'gaokao'
              ? `${fields.subject}试题第 ${pageNum} 页（共 ${totalPages} 页）`
              : `${fields.footerTerm ? `${formatDisplayTerm(fields.footerTerm)}　` : ''}第 ${pageNum} 页（共 ${totalPages} 页）`

          return (
            <div
              key={`a4-page-${pageNum}`}
              className="mx-auto relative"
              style={{
                width: `${Math.round(A4_W * scale)}px`,
                height: `${Math.round(logicalPageH * scale)}px`,
              }}
            >
              <div
                className="paper-sheet exam-paper-render relative rounded-sm overflow-hidden flex flex-col origin-top-left"
                style={{
                  width: `${A4_W}px`,
                  height: `${logicalPageH}px`,
                  transform: `scale(${scale})`,
                  paddingTop: `${PAD_TOP}px`,
                  paddingRight: `${PAD_RIGHT}px`,
                  paddingBottom: `${PAD_BOTTOM}px`,
                  paddingLeft: `${hasBinding ? PAD_LEFT_ODD : PAD_LEFT_EVEN}px`,
                }}
              >
                {/* Odd-page-only USTC 4-hole binding line */}
                {hasBinding && (
                  <div
                    className="pointer-events-none select-none absolute left-0 top-0"
                    style={{ width: `${BINDING_W}px`, height: `${A4_H}px` }}
                  >
                    <UstcBindingLine className="h-full w-full" />
                  </div>
                )}

                <div className="flex-1 flex flex-col">
                  {pageBlockIndices.map((blockIdx, pos) => {
                    const block = blocks[blockIdx]
                    if (!block) return null
                    return (
                      <div
                        key={block.id}
                        style={{ marginTop: pos > 0 ? `${block.gapBefore}px` : 0 }}
                      >
                        {renderBlock(block)}
                      </div>
                    )
                  })}
                </div>

                <footer className="mt-auto pt-4 text-center text-[12.5px] text-[#666666] select-none">
                  {footerText}
                </footer>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
