import {
  putLocalAsset,
  replaceCourseData,
  saveSource,
} from '../db/storage'
import type {
  BankManifest,
  ManifestCourse,
  QuestionRecord,
  SourceConfig,
  StoredQuestion,
  StoredTaxonomy,
  TaxonomyNode,
} from '../types/study'

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}

export function buildCandidateUrls(source: SourceConfig, relativePath: string): string[] {
  const cleanRel = relativePath.replace(/^\/+/, '')
  const urls: string[] = []

  if (source.transport === 'github-raw') {
    const ref = encodeURIComponent(source.ref || 'main')
    const rawBase = `https://raw.githubusercontent.com/${source.location}/${ref}/`
    const jsdelivrBase = `https://cdn.jsdelivr.net/gh/${source.location}@${ref}/`

    if (source.mirror_url?.trim()) {
      const m = ensureTrailingSlash(source.mirror_url.trim())
      if (m.includes('jsdelivr') || m.includes(source.location)) {
        urls.push(new URL(cleanRel, m).href)
      } else {
        urls.push(`${m}${rawBase}${cleanRel}`)
      }
    }
    if (!urls.some(u => u.startsWith(jsdelivrBase))) {
      urls.push(new URL(cleanRel, jsdelivrBase).href)
    }
    urls.push(new URL(cleanRel, rawBase).href)
  } else if (source.transport === 'http-manifest') {
    let base = source.location.trim()
    if (base.endsWith('/manifest.json')) base = base.slice(0, -'manifest.json'.length)
    urls.push(new URL(cleanRel, ensureTrailingSlash(base)).href)
  }

  return urls
}

export function resolveFigureUrl(
  source: SourceConfig | undefined,
  courseCode: string,
  figPath: string,
): string | null {
  if (!source || !figPath) return null
  if (/^https?:\/\//i.test(figPath) || figPath.startsWith('data:') || figPath.startsWith('blob:')) {
    return figPath
  }
  const clean = figPath.replace(/^\/+/, '')
  if (source.manifest?.asset_base_url) {
    return new URL(`${encodeURIComponent(courseCode)}/${clean}`, ensureTrailingSlash(source.manifest.asset_base_url)).href
  }
  const urls = buildCandidateUrls(source, `courses/${courseCode}/${clean}`)
  return urls[0] ?? null
}

async function fetchWithFallback(
  urls: string[],
  signal?: AbortSignal,
  expectedSha256?: string,
  label?: string,
): Promise<ArrayBuffer> {
  let lastError: unknown = null
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal, cache: 'no-store' })
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} (${url})`)
        continue
      }
      const buf = await res.arrayBuffer()
      if (expectedSha256) {
        const actual = await sha256Hex(buf)
        if (actual !== expectedSha256) {
          // Stale CDN mirror (e.g. jsDelivr caching an older @main snapshot) — fall back to next candidate
          lastError = new Error(`${label ?? '文件'} SHA-256 校验未通过`)
          continue
        }
      }
      return buf
    } catch (err) {
      if (signal?.aborted) throw err
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error('网络请求失败，请检查网络或切换镜像地址')
}

export function buildSearchText(q: QuestionRecord): string {
  return [
    q.id,
    q.course_code,
    q.stem?.md ?? '',
    ...(q.options ?? []).map(o => `${o.key} ${o.md}`),
    q.answer?.md ?? '',
    q.solution?.md ?? '',
    q.source?.ref ?? '',
    ...(q.tags?.keywords ?? []),
    ...(q.tags?.kp_ids ?? []),
  ]
    .join('\n')
    .toLowerCase()
}

function compareSemver(a?: string | null, b?: string | null): number {
  const pa = (a ?? '0.0.0').split('.').map(n => parseInt(n, 10) || 0)
  const pb = (b ?? '0.0.0').split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

function isNewerManifest(candidate: BankManifest, current: BankManifest): boolean {
  const cmp = compareSemver(candidate.data_version, current.data_version)
  if (cmp !== 0) return cmp > 0
  const candCourses = candidate.courses?.length ?? 0
  const curCourses = current.courses?.length ?? 0
  if (candCourses !== curCourses) return candCourses > curCourses
  const candQ = candidate.stats?.questions ?? 0
  const curQ = current.stats?.questions ?? 0
  if (candQ !== curQ) return candQ > curQ
  return (candidate.updated_at ?? '') > (current.updated_at ?? '')
}

async function fetchManifestCandidate(url: string, signal?: AbortSignal, timeoutMs = 6000): Promise<BankManifest> {
  const ctrl = new AbortController()
  const onParentAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onParentAbort, { once: true })
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`)
    const text = new TextDecoder('utf-8').decode(await res.arrayBuffer())
    const parsed = JSON.parse(text) as BankManifest
    if (!parsed || !Array.isArray(parsed.courses)) {
      throw new Error('manifest.json 格式不符合题库协议 v1.0')
    }
    return parsed
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onParentAbort)
  }
}

export async function refreshSourceManifest(
  source: SourceConfig,
  signal?: AbortSignal,
): Promise<SourceConfig> {
  if (source.transport === 'local-import') return source
  const urls = buildCandidateUrls(source, 'manifest.json')
  let bestManifest: BankManifest | null = null
  let lastError: unknown = null

  // Probe all candidate URLs (CDN mirror + raw GitHub) concurrently with bounded timeout
  // so a stale jsDelivr @main cache never masks a newer upstream release on raw.githubusercontent.com.
  const results = await Promise.allSettled(urls.map(url => fetchManifestCandidate(url, signal)))
  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (!bestManifest || isNewerManifest(r.value, bestManifest)) {
        bestManifest = r.value
      }
    } else {
      lastError = r.reason
    }
  }

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  if (!bestManifest) {
    throw lastError instanceof Error ? lastError : new Error('网络请求失败，请检查网络或切换镜像地址')
  }

  // Never downgrade a newer bundled/cached manifest with a stale CDN response
  if (source.manifest && !isNewerManifest(bestManifest, source.manifest) && compareSemver(bestManifest.data_version, source.data_version) < 0) {
    return source
  }

  const updated: SourceConfig = {
    ...source,
    data_version: bestManifest.data_version ?? source.data_version,
    manifest: bestManifest,
  }
  await saveSource(updated)
  return updated
}

export interface SyncProgress {
  courseCode: string
  courseName: string
  index: number
  total: number
  phase: 'fetching' | 'verifying' | 'indexing'
}

export async function syncCoursesFromSource(
  source: SourceConfig,
  courseCodes: string[],
  onProgress?: (p: SyncProgress) => void,
  signal?: AbortSignal,
): Promise<{ updatedSource: SourceConfig; syncedCount: number }> {
  let activeSource = source
  try {
    activeSource = await refreshSourceManifest(source, signal)
  } catch {
    if (!activeSource.manifest) {
      throw new Error('无法拉取题库 manifest.json，请检查网络连接或镜像设置')
    }
  }

  const manifest = activeSource.manifest!
  const targets = manifest.courses.filter(c => courseCodes.includes(c.code))
  if (!targets.length) throw new Error('请至少选择一门课程进行同步')

  const nextInstalled = { ...activeSource.installed_courses }
  let totalSyncedQuestions = 0

  for (let i = 0; i < targets.length; i++) {
    const course: ManifestCourse = targets[i]
    onProgress?.({
      courseCode: course.code,
      courseName: course.name,
      index: i + 1,
      total: targets.length,
      phase: 'fetching',
    })

    const [metaBuf, taxBuf, qBuf] = await Promise.all([
      fetchWithFallback(
        buildCandidateUrls(activeSource, course.paths.meta),
        signal,
        course.sha256?.meta,
        `${course.code} meta.json`,
      ),
      fetchWithFallback(
        buildCandidateUrls(activeSource, course.paths.taxonomy),
        signal,
        course.sha256?.taxonomy,
        `${course.code} taxonomy.json`,
      ),
      fetchWithFallback(
        buildCandidateUrls(activeSource, course.paths.questions),
        signal,
        course.sha256?.questions,
        `${course.code} questions.jsonl`,
      ),
    ])

    onProgress?.({
      courseCode: course.code,
      courseName: course.name,
      index: i + 1,
      total: targets.length,
      phase: 'verifying',
    })

    onProgress?.({
      courseCode: course.code,
      courseName: course.name,
      index: i + 1,
      total: targets.length,
      phase: 'indexing',
    })

    const decoder = new TextDecoder('utf-8')
    const meta = JSON.parse(decoder.decode(metaBuf)) as { description?: string }
    const taxRaw = JSON.parse(decoder.decode(taxBuf)) as { nodes: TaxonomyNode[] }
    const qLines = decoder.decode(qBuf).split(/\r?\n/)
    const questions: StoredQuestion[] = []

    for (const line of qLines) {
      if (!line.trim()) continue
      const parsed = JSON.parse(line) as QuestionRecord
      questions.push({
        ...parsed,
        source_id: activeSource.source_id,
        key: `${activeSource.source_id}\0${parsed.id}`,
        search_text: buildSearchText(parsed),
      })
    }

    const taxonomy: StoredTaxonomy = {
      key: `${activeSource.source_id}\0${course.code}`,
      source_id: activeSource.source_id,
      course_code: course.code,
      nodes: taxRaw.nodes ?? [],
    }

    await replaceCourseData(activeSource.source_id, course.code, taxonomy, questions)

    nextInstalled[course.code] = {
      installed_at: new Date().toISOString(),
      question_count: questions.length,
      questions_sha256: course.sha256?.questions,
      taxonomy_sha256: course.sha256?.taxonomy,
      description: meta.description ?? '',
    }
    totalSyncedQuestions += questions.length
  }

  const updatedSource: SourceConfig = {
    ...activeSource,
    last_synced_at: new Date().toISOString(),
    installed_courses: nextInstalled,
  }
  await saveSource(updatedSource)
  return { updatedSource, syncedCount: totalSyncedQuestions }
}

export async function importLocalBankFiles(
  files: FileList,
  customName?: string,
): Promise<{ source: SourceConfig; coursesImported: number; questionsImported: number }> {
  const fileMap = new Map<string, File>()
  for (const file of Array.from(files)) {
    const rel = (file.webkitRelativePath || file.name).replace(/\\/g, '/')
    const parts = rel.split('/')
    const normalized = parts.length > 1 ? parts.slice(1).join('/') : rel
    fileMap.set(normalized, file)
  }

  const manifestFile = fileMap.get('manifest.json')
  if (!manifestFile) {
    throw new Error('所选目录缺少 manifest.json（请遵循题库协议 v1.0 目录结构）')
  }
  const manifest = JSON.parse(await manifestFile.text()) as BankManifest
  if (!Array.isArray(manifest.courses)) {
    throw new Error('manifest.json 缺少 courses 列表')
  }

  const sourceId = `local-${Date.now().toString(36)}`
  const installed: SourceConfig['installed_courses'] = {}
  let questionsImported = 0
  let coursesImported = 0

  for (const course of manifest.courses) {
    const qFile = fileMap.get(course.paths.questions)
    const tFile = fileMap.get(course.paths.taxonomy)
    if (!qFile || !tFile) continue

    const taxRaw = JSON.parse(await tFile.text()) as { nodes: TaxonomyNode[] }
    const qLines = (await qFile.text()).split(/\r?\n/)
    const questions: StoredQuestion[] = []
    for (const line of qLines) {
      if (!line.trim()) continue
      const parsed = JSON.parse(line) as QuestionRecord
      questions.push({
        ...parsed,
        source_id: sourceId,
        key: `${sourceId}\0${parsed.id}`,
        search_text: buildSearchText(parsed),
      })
    }

    const courseDir = `courses/${course.code}/`
    for (const [relPath, file] of fileMap.entries()) {
      if (relPath.startsWith(`${courseDir}assets/`)) {
        const assetRel = relPath.slice(courseDir.length)
        await putLocalAsset(sourceId, course.code, assetRel, file)
      }
    }

    await replaceCourseData(
      sourceId,
      course.code,
      {
        key: `${sourceId}\0${course.code}`,
        source_id: sourceId,
        course_code: course.code,
        nodes: taxRaw.nodes ?? [],
      },
      questions,
    )

    installed[course.code] = {
      installed_at: new Date().toISOString(),
      question_count: questions.length,
    }
    questionsImported += questions.length
    coursesImported++
  }

  if (!coursesImported) {
    throw new Error('未在目录中找到可导入的课程文件（questions.jsonl / taxonomy.json）')
  }

  const source: SourceConfig = {
    source_id: sourceId,
    name: customName?.trim() || manifest.name || '本地导入题库',
    transport: 'local-import',
    location: 'local-directory',
    data_version: manifest.data_version ?? 'local',
    last_synced_at: new Date().toISOString(),
    manifest,
    installed_courses: installed,
    builtin: false,
  }
  await saveSource(source)
  return { source, coursesImported, questionsImported }
}
