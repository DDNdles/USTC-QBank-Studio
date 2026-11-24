import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookPlus, Eye, X } from 'lucide-react'
import { useStudy } from '../context/StudyContext'
import type { QuestionType } from '../types/study'
import { RichMath } from './RichMath'

const COMMON_ERROR_TAGS = ['计算失误', '概念混淆', '思路卡壳', '审题偏差', '公式遗忘', '边界漏讨论']

export function AddMistakeModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { addPersonalMistake, sources, showToast } = useStudy()
  const [courseCode, setCourseCode] = useState('MATH1006')
  const [type, setType] = useState<QuestionType>('solve')
  const [stemMd, setStemMd] = useState('')
  const [answerMd, setAnswerMd] = useState('')
  const [solutionMd, setSolutionMd] = useState('')
  const [sourceRef, setSourceRef] = useState('')
  const [reflectionMd, setReflectionMd] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  const courseOptions = sources.flatMap(s => s.manifest?.courses ?? [])

  const toggleTag = (t: string) =>
    setTags(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]))

  const handleSave = async () => {
    if (!stemMd.trim()) {
      showToast('请先填写题干内容', 'error')
      return
    }
    setSaving(true)
    try {
      await addPersonalMistake({
        course_code: courseCode,
        type,
        stem_md: stemMd,
        answer_md: answerMd,
        solution_md: solutionMd,
        error_tags: tags,
        reflection_md: reflectionMd,
        source_ref: sourceRef,
      })
      setStemMd('')
      setAnswerMd('')
      setSolutionMd('')
      setReflectionMd('')
      setSourceRef('')
      setTags([])
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={e => e.stopPropagation()}
            className="paper-card w-full max-w-2xl rounded-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <BookPlus className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="font-editorial text-base font-semibold">手工录入个人错题</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreview(p => !p)}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${
                    preview
                      ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'border-[var(--border-hairline)] text-[var(--ink-secondary)]'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" /> {preview ? '返回编辑' : 'KaTeX 预览'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1 text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 max-h-[76vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-[var(--ink-muted)] mb-1">所属课程</label>
                  <select
                    value={courseCode}
                    onChange={e => setCourseCode(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--ink-primary)]"
                  >
                    {courseOptions.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                    <option value="PERSONAL">PERSONAL · 自定义课程</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[var(--ink-muted)] mb-1">题型</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as QuestionType)}
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--ink-primary)]"
                  >
                    <option value="solve">计算与解答题</option>
                    <option value="proof">证明题</option>
                    <option value="single">单选题</option>
                    <option value="blank">填空题</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[var(--ink-muted)] mb-1">题目出处（选填）</label>
                  <input
                    value={sourceRef}
                    onChange={e => setSourceRef(e.target.value)}
                    placeholder="如：作业第4章第8题"
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--ink-primary)]"
                  />
                </div>
              </div>

              {preview ? (
                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 space-y-3 text-sm">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)] mb-1">题干预览</div>
                    <RichMath text={stemMd || '（暂未输入题干）'} />
                  </div>
                  {answerMd && (
                    <div className="border-t border-[var(--border-hairline)] pt-2.5">
                      <div className="text-[11px] font-semibold text-[var(--amber)] mb-1">参考答案</div>
                      <RichMath text={answerMd} />
                    </div>
                  )}
                  {solutionMd && (
                    <div className="border-t border-[var(--border-hairline)] pt-2.5">
                      <div className="text-[11px] font-semibold text-[var(--accent)] mb-1">详细解析</div>
                      <RichMath text={solutionMd} />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-[var(--ink-muted)] mb-1">题干（支持 Markdown 与 $LaTeX$）*</label>
                    <textarea
                      rows={3}
                      value={stemMd}
                      onChange={e => setStemMd(e.target.value)}
                      placeholder="例如：求极限 $\lim_{x \to 0} \frac{\sin x - x}{x^3}$。"
                      className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[var(--ink-muted)] mb-1">参考答案</label>
                      <textarea
                        rows={2}
                        value={answerMd}
                        onChange={e => setAnswerMd(e.target.value)}
                        placeholder="如：$-\frac{1}{6}$"
                        className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--ink-muted)] mb-1">详细解析（选填）</label>
                      <textarea
                        rows={2}
                        value={solutionMd}
                        onChange={e => setSolutionMd(e.target.value)}
                        placeholder="泰勒展开：$\sin x = x - \frac{x^3}{6} + o(x^3)$..."
                        className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <div className="text-xs text-[var(--ink-muted)] mb-1.5">错因标签</div>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_ERROR_TAGS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      className={`rounded-full border px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                        tags.includes(t)
                          ? 'border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)] font-medium'
                          : 'border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-[var(--ink-muted)] mb-1">复盘反思（导出试卷时将自动作为红字点评）</label>
                <input
                  value={reflectionMd}
                  onChange={e => setReflectionMd(e.target.value)}
                  placeholder="写下易错点或关键切入思路..."
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--ink-primary)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-3.5 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={saving || !stemMd.trim()}
                  onClick={handleSave}
                  className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50 cursor-pointer"
                >
                  {saving ? '保存中…' : '存入错题本'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
