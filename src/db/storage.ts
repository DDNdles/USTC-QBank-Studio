import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  FeedbackRecord,
  MistakeRecord,
  SavedPaper,
  SourceConfig,
  StoredQuestion,
  StoredTaxonomy,
} from '../types/study'
import fallbackManifest from '../data/fallback-manifest.json'
import type { BankManifest } from '../types/study'

interface StudyStudioDB extends DBSchema {
  sources: {
    key: string
    value: SourceConfig
  }
  questions: {
    key: string
    value: StoredQuestion
    indexes: {
      'by-source': string
      'by-course': [string, string]
      'by-course-code': string
    }
  }
  taxonomies: {
    key: string
    value: StoredTaxonomy
    indexes: {
      'by-source': string
    }
  }
  papers: {
    key: string
    value: SavedPaper
  }
  mistakes: {
    key: string
    value: MistakeRecord
    indexes: {
      'by-question': [string, string]
    }
  }
  feedback: {
    key: string
    value: FeedbackRecord
  }
  local_assets: {
    key: string // `${source_id}\0${course_code}\0${relPath}`
    value: {
      key: string
      blob: Blob
      mime: string
    }
  }
}

const DB_NAME = 'ustc-qbank-studio-v1'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<StudyStudioDB>> | null = null

export function getDb(): Promise<IDBPDatabase<StudyStudioDB>> {
  if (!dbPromise) {
    dbPromise = openDB<StudyStudioDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sources')) {
          db.createObjectStore('sources', { keyPath: 'source_id' })
        }
        if (!db.objectStoreNames.contains('questions')) {
          const qs = db.createObjectStore('questions', { keyPath: 'key' })
          qs.createIndex('by-source', 'source_id')
          qs.createIndex('by-course', ['source_id', 'course_code'])
          qs.createIndex('by-course-code', 'course_code')
        }
        if (!db.objectStoreNames.contains('taxonomies')) {
          const tx = db.createObjectStore('taxonomies', { keyPath: 'key' })
          tx.createIndex('by-source', 'source_id')
        }
        if (!db.objectStoreNames.contains('papers')) {
          db.createObjectStore('papers', { keyPath: 'paper_id' })
        }
        if (!db.objectStoreNames.contains('mistakes')) {
          const ms = db.createObjectStore('mistakes', { keyPath: 'mistake_id' })
          ms.createIndex('by-question', ['source_id', 'question_id'])
        }
        if (!db.objectStoreNames.contains('feedback')) {
          db.createObjectStore('feedback', { keyPath: 'feedback_id' })
        }
        if (!db.objectStoreNames.contains('local_assets')) {
          db.createObjectStore('local_assets', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

export const DEFAULT_SOURCES: SourceConfig[] = [
  {
    source_id: 'ustc-official',
    name: '中科大公开题库（USTC-Question-Bank）',
    transport: 'github-raw',
    location: 'DDNdles/USTC-Question-Bank',
    ref: 'main',
    mirror_url: 'https://cdn.jsdelivr.net/gh/DDNdles/USTC-Question-Bank@main/',
    data_version: (fallbackManifest as unknown as BankManifest).data_version,
    manifest: fallbackManifest as unknown as BankManifest,
    installed_courses: {},
    builtin: true,
  },
  {
    source_id: 'local-personal',
    name: '个人自录错题库',
    transport: 'personal',
    location: 'browser-indexeddb://personal',
    installed_courses: {},
    builtin: true,
  },
]

export async function ensureBuiltinSources(): Promise<SourceConfig[]> {
  const db = await getDb()
  const existing = await db.getAll('sources')
  const byId = new Map(existing.map(s => [s.source_id, s]))

  for (const def of DEFAULT_SOURCES) {
    if (!byId.has(def.source_id)) {
      await db.put('sources', def)
      byId.set(def.source_id, def)
    } else if (def.source_id === 'ustc-official') {
      const cur = byId.get(def.source_id)!
      if (!cur.manifest) {
        cur.manifest = def.manifest
        cur.data_version = def.data_version
        await db.put('sources', cur)
      }
    }
  }
  return Array.from(byId.values())
}

export async function listSources(): Promise<SourceConfig[]> {
  return ensureBuiltinSources()
}

export async function saveSource(source: SourceConfig): Promise<void> {
  const db = await getDb()
  await db.put('sources', source)
}

export async function deleteSource(sourceId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['sources', 'questions', 'taxonomies'], 'readwrite')
  await tx.objectStore('sources').delete(sourceId)
  const qIdx = tx.objectStore('questions').index('by-source')
  let qCursor = await qIdx.openCursor(sourceId)
  while (qCursor) {
    await qCursor.delete()
    qCursor = await qCursor.continue()
  }
  const tIdx = tx.objectStore('taxonomies').index('by-source')
  let tCursor = await tIdx.openCursor(sourceId)
  while (tCursor) {
    await tCursor.delete()
    tCursor = await tCursor.continue()
  }
  await tx.done
}

export async function replaceCourseData(
  sourceId: string,
  courseCode: string,
  taxonomy: StoredTaxonomy,
  questions: StoredQuestion[],
): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['questions', 'taxonomies'], 'readwrite')
  const qStore = tx.objectStore('questions')
  const qIdx = qStore.index('by-course')
  let cursor = await qIdx.openCursor([sourceId, courseCode])
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  for (const q of questions) {
    await qStore.put(q)
  }
  await tx.objectStore('taxonomies').put(taxonomy)
  await tx.done
}

export async function removeCourseData(sourceId: string, courseCode: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['questions', 'taxonomies', 'sources'], 'readwrite')
  const qIdx = tx.objectStore('questions').index('by-course')
  let cursor = await qIdx.openCursor([sourceId, courseCode])
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.objectStore('taxonomies').delete(`${sourceId}\0${courseCode}`)
  const src = await tx.objectStore('sources').get(sourceId)
  if (src) {
    delete src.installed_courses[courseCode]
    await tx.objectStore('sources').put(src)
  }
  await tx.done
}

export async function listAllQuestions(): Promise<StoredQuestion[]> {
  const db = await getDb()
  return db.getAll('questions')
}

export async function listQuestionsByCourse(courseCodes: string[]): Promise<StoredQuestion[]> {
  const db = await getDb()
  if (!courseCodes.length) return db.getAll('questions')
  const out: StoredQuestion[] = []
  const idx = db.transaction('questions').store.index('by-course-code')
  for (const code of courseCodes) {
    const rows = await idx.getAll(code)
    out.push(...rows)
  }
  return out
}

export async function listAllTaxonomies(): Promise<StoredTaxonomy[]> {
  const db = await getDb()
  return db.getAll('taxonomies')
}

export async function putQuestion(q: StoredQuestion): Promise<void> {
  const db = await getDb()
  await db.put('questions', q)
}

export async function listPapers(): Promise<SavedPaper[]> {
  const db = await getDb()
  const rows = await db.getAll('papers')
  return rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export async function savePaper(paper: SavedPaper): Promise<void> {
  const db = await getDb()
  await db.put('papers', paper)
}

export async function deletePaper(paperId: string): Promise<void> {
  const db = await getDb()
  await db.delete('papers', paperId)
}

export async function listMistakes(): Promise<MistakeRecord[]> {
  const db = await getDb()
  const rows = await db.getAll('mistakes')
  return rows.sort((a, b) => a.next_review_at.localeCompare(b.next_review_at) || b.wrong_count - a.wrong_count)
}

export async function saveMistake(mistake: MistakeRecord): Promise<void> {
  const db = await getDb()
  await db.put('mistakes', mistake)
}

export async function deleteMistake(mistakeId: string): Promise<void> {
  const db = await getDb()
  await db.delete('mistakes', mistakeId)
}

export async function listFeedback(): Promise<FeedbackRecord[]> {
  const db = await getDb()
  const rows = await db.getAll('feedback')
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function saveFeedback(rec: FeedbackRecord): Promise<void> {
  const db = await getDb()
  await db.put('feedback', rec)
}

export async function putLocalAsset(sourceId: string, courseCode: string, relPath: string, blob: Blob): Promise<void> {
  const db = await getDb()
  await db.put('local_assets', {
    key: `${sourceId}\0${courseCode}\0${relPath}`,
    blob,
    mime: blob.type || 'image/png',
  })
}

export async function getLocalAssetUrl(sourceId: string, courseCode: string, relPath: string): Promise<string | null> {
  const db = await getDb()
  const rec = await db.get('local_assets', `${sourceId}\0${courseCode}\0${relPath}`)
  if (!rec) return null
  return URL.createObjectURL(rec.blob)
}

export async function exportWorkspaceBackup(): Promise<string> {
  const db = await getDb()
  const [papers, mistakes, feedback] = await Promise.all([
    db.getAll('papers'),
    db.getAll('mistakes'),
    db.getAll('feedback'),
  ])
  return JSON.stringify(
    {
      schema: 'ustc-qbank-studio-backup/1.0',
      exported_at: new Date().toISOString(),
      papers,
      mistakes,
      feedback,
    },
    null,
    2,
  )
}

export async function importWorkspaceBackup(jsonText: string): Promise<{ papers: number; mistakes: number }> {
  const parsed = JSON.parse(jsonText)
  if (!parsed || typeof parsed !== 'object') throw new Error('备份文件格式无效')
  const db = await getDb()
  let papersCount = 0
  let mistakesCount = 0
  if (Array.isArray(parsed.papers)) {
    for (const p of parsed.papers) {
      if (p?.paper_id && Array.isArray(p.items)) {
        await db.put('papers', p)
        papersCount++
      }
    }
  }
  if (Array.isArray(parsed.mistakes)) {
    for (const m of parsed.mistakes) {
      if (m?.mistake_id && m.question) {
        await db.put('mistakes', m)
        mistakesCount++
      }
    }
  }
  return { papers: papersCount, mistakes: mistakesCount }
}
