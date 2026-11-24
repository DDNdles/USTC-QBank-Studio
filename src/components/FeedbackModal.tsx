import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, Flag, Send, X, CheckCircle2, Copy } from 'lucide-react'
import { FEEDBACK_CATEGORIES } from '../services/feedbackService'
import { useStudy } from '../context/StudyContext'
import type { FeedbackRecord, QuestionRecord } from '../types/study'
import { RichMath } from './RichMath'

export function FeedbackModal({
  target,
  onClose,
}: {
  target: { source_id: string; question: QuestionRecord } | null
  onClose: () => void
}) {
  const { sendFeedback, showToast } = useStudy()
  const [selected, setSelected] = useState<string[]>([])
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<(FeedbackRecord & { delivery_error?: string | null }) | null>(null)

  const toggle = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const handleClose = () => {
    setSelected([])
    setDetail('')
    setResult(null)
    onClose()
  }

  const handleSubmit = async () => {
    if (!target) return
    setSubmitting(true)
    try {
      const res = await sendFeedback({
        source_id: target.source_id,
        question: target.question,
        category_ids: selected,
        detail,
      })
      setResult(res)
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={e => e.stopPropagation()}
            className="paper-card w-full max-w-lg rounded-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-[var(--amber)]" />
                <h3 className="font-editorial text-base font-semibold">题目纠错与反馈</h3>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-1 text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="rounded-xl bg-[var(--bg-subtle)] p-3 text-xs">
                <div className="font-mono-num text-[11px] text-[var(--ink-muted)] mb-1">
                  {target.question.course_code} · {target.question.id}
                </div>
                <div className="line-clamp-3 text-[var(--ink-secondary)]">
                  <RichMath text={target.question.stem.md} />
                </div>
              </div>

              {result ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 rounded-xl border border-[var(--mastered)]/30 bg-[var(--mastered-soft)] p-3.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-[var(--mastered)] mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium text-[var(--ink-primary)]">
                        {result.delivery_status === 'delivered' ? '已成功直推至题库维护通道' : '反馈单已生成并本地留档'}
                      </div>
                      {result.delivery_error && (
                        <div className="text-xs text-[var(--ink-secondary)] mt-0.5">{result.delivery_error}</div>
                      )}
                      {result.delivered_issue_url && (
                        <a
                          href={result.delivered_issue_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                        >
                          查看已创建的 Issue <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {result.issue_channels.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-[var(--ink-muted)]">一键跳转（已自动预填完整 Markdown）</div>
                      {result.issue_channels.map(ch => (
                        <a
                          key={ch.id}
                          href={ch.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-colors ${
                            ch.primary
                              ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] hover:opacity-90'
                              : 'border-[var(--border-hairline)] bg-[var(--bg-paper)] text-[var(--ink-primary)] hover:bg-[var(--bg-subtle)]'
                          }`}
                        >
                          <span>{ch.label}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(result.markdown)
                        showToast('已复制完整 Markdown 反馈内容', 'success')
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" /> 复制 Markdown
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-lg bg-[var(--ink-primary)] px-4 py-1.5 text-xs font-medium text-[var(--bg-paper)] cursor-pointer"
                    >
                      完成
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="text-xs font-medium text-[var(--ink-secondary)] mb-2">问题类型（可多选）</div>
                    <div className="flex flex-wrap gap-1.5">
                      {FEEDBACK_CATEGORIES.map(cat => {
                        const on = selected.includes(cat.id)
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => toggle(cat.id)}
                            className={`rounded-full border px-3 py-1 text-xs transition-colors cursor-pointer ${
                              on
                                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                                : 'border-[var(--border-hairline)] bg-[var(--bg-paper)] text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]'
                            }`}
                          >
                            {cat.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--ink-secondary)] mb-1.5">
                      具体说明（支持 LaTeX 片段）
                    </label>
                    <textarea
                      rows={3}
                      value={detail}
                      onChange={e => setDetail(e.target.value)}
                      placeholder="例如：第 (2) 问积分上限应为 \pi/2，当前解析中符号漏写了负号..."
                      className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-lg px-3.5 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      disabled={submitting || (!selected.length && !detail.trim())}
                      onClick={handleSubmit}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:opacity-95 cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {submitting ? '正在提交…' : '提交纠错'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
