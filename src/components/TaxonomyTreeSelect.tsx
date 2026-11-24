import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Check, Search } from 'lucide-react'
import type { StoredQuestion, StoredTaxonomy, TaxonomyNode } from '../types/study'

interface TreeNode extends TaxonomyNode {
  course_code: string
  children: TreeNode[]
  totalCount: number
}

export function TaxonomyTreeSelect({
  taxonomies,
  questions,
  courseCodes,
  selectedIds,
  onChange,
}: {
  taxonomies: StoredTaxonomy[]
  questions: StoredQuestion[]
  courseCodes: string[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const roots = useMemo(() => {
    const relevantTax = courseCodes.length
      ? taxonomies.filter(t => courseCodes.includes(t.course_code))
      : taxonomies

    const directCounts = new Map<string, number>()
    for (const q of questions) {
      if (q.quality?.quarantined) continue
      if (courseCodes.length && !courseCodes.includes(q.course_code)) continue
      for (const kpId of q.tags?.kp_ids ?? []) {
        const key = `${q.course_code}\0${kpId}`
        directCounts.set(key, (directCounts.get(key) ?? 0) + 1)
      }
    }

    const out: TreeNode[] = []
    for (const tax of relevantTax) {
      const map = new Map<string, TreeNode>()
      for (const n of tax.nodes) {
        map.set(n.id, {
          ...n,
          course_code: tax.course_code,
          children: [],
          totalCount: directCounts.get(`${tax.course_code}\0${n.id}`) ?? 0,
        })
      }
      const taxRoots: TreeNode[] = []
      for (const node of map.values()) {
        if (node.parent_id && map.has(node.parent_id)) {
          map.get(node.parent_id)!.children.push(node)
        } else {
          taxRoots.push(node)
        }
      }
      const rollup = (node: TreeNode): number => {
        let sum = node.totalCount
        for (const c of node.children) sum += rollup(c)
        node.totalCount = sum
        return sum
      }
      taxRoots.forEach(rollup)
      out.push(...taxRoots)
    }
    return out
  }, [taxonomies, questions, courseCodes])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter(x => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const qLower = query.trim().toLowerCase()

  const matches = (node: TreeNode): boolean => {
    if (!qLower) return true
    if (node.name.toLowerCase().includes(qLower) || node.id.toLowerCase().includes(qLower)) return true
    return node.children.some(matches)
  }

  const renderNode = (node: TreeNode, depth = 0) => {
    if (!matches(node)) return null
    const hasChildren = node.children.length > 0
    const isOpen = qLower ? true : Boolean(expanded[`${node.course_code}:${node.id}`])
    const isSelected = selectedSet.has(node.id)

    return (
      <div key={`${node.course_code}-${node.id}`}>
        <div
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-colors ${
            isSelected
              ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
              : 'hover:bg-[var(--bg-subtle)] text-[var(--ink-secondary)]'
          }`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() =>
                setExpanded(prev => ({
                  ...prev,
                  [`${node.course_code}:${node.id}`]: !isOpen,
                }))
              }
              className="p-0.5 text-[var(--ink-muted)] hover:text-[var(--ink-primary)] cursor-pointer"
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          <button
            type="button"
            onClick={() => toggle(node.id)}
            className="flex flex-1 items-center justify-between gap-2 text-left min-w-0 cursor-pointer"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : 'border-[var(--border-strong)] bg-[var(--bg-paper)]'
                }`}
              >
                {isSelected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              <span className="truncate">{node.name}</span>
            </span>
            <span className="font-mono-num text-[11px] text-[var(--ink-muted)] shrink-0">
              {node.totalCount}
            </span>
          </button>
        </div>
        {hasChildren && isOpen && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  if (!roots.length) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-hairline)] p-3 text-xs text-[var(--ink-muted)]">
        先同步至少一门课程后，将自动加载该课程的层级知识点树。
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-paper)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] px-2.5 py-2">
        <Search className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="筛选知识点..."
          className="w-full bg-transparent text-xs text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:outline-none"
        />
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="shrink-0 text-[11px] text-[var(--accent)] hover:underline cursor-pointer"
          >
            清空({selectedIds.length})
          </button>
        )}
      </div>
      <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
        {roots.map(node => renderNode(node, 0))}
      </div>
    </div>
  )
}
