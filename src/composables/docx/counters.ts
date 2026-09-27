import type { NumberingSchemes } from '../../types/document'
import { refKey } from './text-runs'

// ===== Caption numbering =====
// Three schemes:
//   plain      → 1, 2, 3            (continuous, ignores chapters)
//   perSection → 1.1, 1.2, 1.3      (chapter fixed at 1, item runs continuously)
//   sectioned  → 1.1 … 2.1          (chapter = H2 index, item resets each chapter)
type NumKind = 'image' | 'code' | 'table' | 'formula'
export interface Counters {
  bumpChapter(): void                       // call on every H2 heading
  next(kind: NumKind, label?: string): string // formatted number; records it under label
  labels: Map<string, string>               // refKey(label) → number, for {ref:label}
}

// Each type can use its own scheme. The chapter counter advances on every H2;
// 'sectioned' types reset their per-chapter item count when that happens.
export function makeCounters(schemes: NumberingSchemes): Counters {
  let chapter = 0
  const items: Record<NumKind, number> = { image: 0, code: 0, table: 0, formula: 0 }
  const labels = new Map<string, string>()
  const format = (kind: NumKind): string => {
    const m = items[kind]
    const scheme = schemes[kind]
    if (scheme === 'plain') return String(m)
    const ch = scheme === 'sectioned' ? Math.max(1, chapter) : 1
    return `${ch}.${m}`
  }
  return {
    labels,
    bumpChapter() {
      chapter++
      // Reset only the item counters whose scheme is section-based.
      ;(['image', 'code', 'table', 'formula'] as NumKind[]).forEach((k) => {
        if (schemes[k] === 'sectioned') items[k] = 0
      })
    },
    next(kind: NumKind, label?: string): string {
      items[kind]++
      const num = format(kind)
      if (label?.trim()) labels.set(refKey(label), num)
      return num
    },
  }
}

// Build the in-text reference sentence for a numbered object (code/image/table).
// If the user's text contains the {no} placeholder, only substitute the number
// (no auto prefix). Otherwise fall back to the legacy "<text> <prefix> <n>." format.
export function resolveReference(text: string | undefined, prefix: string, num: string): string {
  if (!text) return ''
  if (text.includes('{no}')) {
    return text.replace(/\{no\}/g, num)
  }
  return `${text} ${prefix.toLowerCase()} ${num}.`
}

// Bookmark id for a heading block, referenced by the manual table of contents.
export function tocBookmarkId(blockId: string): string {
  return '_Toc_' + blockId.replace(/[^a-zA-Z0-9]/g, '')
}
