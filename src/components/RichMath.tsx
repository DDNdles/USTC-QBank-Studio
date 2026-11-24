import { useEffect, useMemo, useState } from 'react'
import { renderMarkdownToHtml } from '../engine/examRenderer'
import { resolveFigureUrl } from '../services/sourceSync'
import { getLocalAssetUrl } from '../db/storage'
import type { FigureRef, SourceConfig } from '../types/study'

export function RichMath({
  text,
  className = '',
}: {
  text?: string | null
  className?: string
}) {
  const html = useMemo(() => renderMarkdownToHtml(text ?? ''), [text])
  if (!html) return null
  return <div className={`rich-math ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}

export function QuestionFigures({
  figures,
  source,
  sourceId,
  courseCode,
  className = '',
}: {
  figures?: FigureRef[]
  source?: SourceConfig
  sourceId: string
  courseCode: string
  className?: string
}) {
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!figures?.length) return
    let cancelled = false
    const blobUrls: string[] = []

    const load = async () => {
      const next: Record<string, string> = {}
      for (const fig of figures) {
        if (!fig?.path) continue
        if (source?.transport === 'local-import') {
          const localUrl = await getLocalAssetUrl(sourceId, courseCode, fig.path)
          if (localUrl) {
            blobUrls.push(localUrl)
            next[fig.path] = localUrl
          }
        } else {
          const remote = resolveFigureUrl(source, courseCode, fig.path)
          if (remote) next[fig.path] = remote
        }
      }
      if (!cancelled) setResolvedUrls(next)
    }

    void load()
    return () => {
      cancelled = true
      for (const u of blobUrls) URL.revokeObjectURL(u)
    }
  }, [figures, source, sourceId, courseCode])

  if (!figures?.length) return null

  return (
    <div className={`my-2.5 flex flex-wrap gap-3 justify-center ${className}`}>
      {figures.map((fig, idx) => {
        const src = resolvedUrls[fig.path]
        if (!src) return null
        return (
          <figure
            key={`${fig.path}-${idx}`}
            className="rounded-lg border border-[var(--border-hairline)] bg-white p-2 max-w-full"
          >
            <img
              src={src}
              alt={fig.alt || `题图 ${idx + 1}`}
              loading="lazy"
              className="max-h-56 max-w-full object-contain mx-auto"
            />
          </figure>
        )
      })}
    </div>
  )
}
