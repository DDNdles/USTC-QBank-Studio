import { saveFeedback } from '../db/storage'
import type { FeedbackRecord, QuestionRecord, SourceConfig } from '../types/study'

export const FEEDBACK_CATEGORIES = [
  { id: 'stem_error', label: '题干错误' },
  { id: 'solution_error', label: '答案或解析错误' },
  { id: 'source_error', label: '来源/年份错误' },
  { id: 'image_blurry', label: '图片不清晰' },
  { id: 'image_cropped', label: '图片被截断' },
  { id: 'latex_format', label: '公式排版异常' },
  { id: 'taxonomy_error', label: '知识点归类错误' },
  { id: 'other', label: '其他问题' },
] as const

function excerpt(md: string | undefined, maxLen = 240): string {
  const clean = String(md ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return '（无）'
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}…` : clean
}

export async function submitQuestionFeedback(params: {
  source?: SourceConfig
  source_id: string
  course_name: string
  question: QuestionRecord
  category_ids: string[]
  detail: string
}): Promise<FeedbackRecord & { delivery_error?: string | null }> {
  const labels = params.category_ids
    .map(id => FEEDBACK_CATEGORIES.find(c => c.id === id)?.label ?? id)
    .filter(Boolean)
  const detailText = params.detail.trim().slice(0, 2000)
  if (!labels.length && !detailText) {
    throw new Error('请至少选择一项问题类型或填写具体说明')
  }

  const q = params.question
  const summaryTags = labels.length ? labels.join(' / ') : '题目反馈'
  const title = `[题目反馈][${q.course_code}] ${q.id} · ${summaryTags}`.slice(0, 140)
  const dataVer = params.source?.data_version || params.source?.manifest?.data_version || 'unknown'
  const sourceLabel = params.source
    ? `${params.source.name} (\`${params.source.source_id}\`, v${dataVer})`
    : `\`${params.source_id}\``

  const figureList = [
    ...(q.stem?.figures ?? []),
    ...(q.answer?.figures ?? []),
    ...(q.solution?.figures ?? []),
  ]
    .map(f => f.path)
    .filter(Boolean)

  const buildMd = (stemLen: number, ansLen: number) =>
    [
      '### 题目问题反馈',
      '',
      `- **课程**：${params.course_name} (\`${q.course_code}\`)`,
      `- **题目 ID**：\`${q.id}\``,
      `- **题库源**：${sourceLabel}`,
      `- **题目出处**：${q.source?.ref || '（无）'}`,
      `- **问题类型**：${labels.length ? labels.join('、') : '其他问题'}`,
      detailText ? `- **补充说明**：${detailText}` : null,
      figureList.length ? `- **涉及配图**：${figureList.map(p => `\`${p}\``).join('、')}` : null,
      '',
      '#### 原题摘要',
      `> ${excerpt(q.stem?.md, stemLen)}`,
      q.answer?.md ? `\n#### 当前答案摘要\n> ${excerpt(q.answer.md, ansLen)}` : null,
    ]
      .filter(line => line !== null)
      .join('\n')

  const fullMarkdown = buildMd(460, 220)
  const shortMarkdown = buildMd(200, 120)

  const issueChannels: FeedbackRecord['issue_channels'] = []
  const isBuiltinUstc = params.source_id === 'ustc-official' || params.source?.location === 'DDNdles/USTC-Question-Bank'

  if (isBuiltinUstc) {
    const glParams = new URLSearchParams()
    glParams.set('issue[title]', title)
    glParams.set('issue[description]', shortMarkdown)
    issueChannels.push({
      id: 'gitlab',
      label: '提交到 USTC GitLab（校内免代理 · 已自动填好）',
      url: `https://git.ustc.edu.cn/zzl_stella05/USTC-Question-Bank/-/issues/new?${glParams.toString()}`,
      primary: true,
    })
  }

  const repoMatch = (params.source?.manifest?.repository || params.source?.location || '').match(
    /(?:github\.com\/)?([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)/,
  )
  if (repoMatch) {
    const ghParams = new URLSearchParams()
    ghParams.set('title', title)
    ghParams.set('body', shortMarkdown)
    issueChannels.push({
      id: 'github',
      label: '提交到 GitHub Issue（已自动填好）',
      url: `https://github.com/${repoMatch[1]}/issues/new?${ghParams.toString()}`,
      primary: !isBuiltinUstc,
    })
  }

  const feedbackId = `fb-${crypto.randomUUID().slice(0, 10)}`
  const now = new Date().toISOString()

  let deliveryStatus: FeedbackRecord['delivery_status'] = issueChannels.length ? 'prepared' : 'local'
  let deliveredIssueUrl: string | null = null
  let deliveryError: string | null = null

  const endpoint = params.source?.manifest?.feedback_endpoint
  if (typeof endpoint === 'string' && /^https?:\/\//i.test(endpoint.trim())) {
    try {
      const res = await fetch(endpoint.trim(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schema: 'dsh-study-feedback/1.0',
          feedback_id: feedbackId,
          source_id: params.source_id,
          data_version: dataVer,
          course_code: q.course_code,
          course_name: params.course_name,
          question_id: q.id,
          source_ref: q.source?.ref || '',
          categories: params.category_ids,
          category_labels: labels,
          detail: detailText,
          figures: figureList,
          title,
          markdown: fullMarkdown,
          created_at: now,
        }),
      })
      if (res.ok) {
        deliveryStatus = 'delivered'
        try {
          const data = (await res.json()) as { issue_url?: string }
          if (data?.issue_url && /^https?:\/\//i.test(data.issue_url)) {
            deliveredIssueUrl = data.issue_url
          }
        } catch {
          // ignore non-json success body
        }
      } else {
        deliveryError = `直推接口返回 ${res.status}，可使用下方预填 Issue 链接提交`
      }
    } catch {
      deliveryError = '直推接口暂不可达，已为您生成预填好的 GitLab / GitHub Issue 链接'
    }
  }

  const record: FeedbackRecord = {
    feedback_id: feedbackId,
    source_id: params.source_id,
    question_id: q.id,
    course_code: q.course_code,
    categories: labels,
    detail: detailText,
    delivery_status: deliveryStatus,
    delivered_issue_url: deliveredIssueUrl,
    issue_channels: issueChannels,
    markdown: fullMarkdown,
    created_at: now,
  }
  await saveFeedback(record)
  return { ...record, delivery_error: deliveryError }
}
