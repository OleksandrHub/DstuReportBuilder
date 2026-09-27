import type { ReportBlock, ReportDocument, ListItem } from '../types/document'
import { blockSummary, blockTypeName } from './block-labels'

// Formatting check ("Перевірка оформлення"): typical ДСТУ 3008 remarks that
// can be found mechanically. Pure — reads the document, changes nothing.

export type IssueFix = 'quotes' | 'dashes' | 'spaces'

export interface FormatIssue {
  blockId: string // top-level block (the group, for blocks inside a group)
  where: string   // "Рисунок · Схема алгоритму"
  message: string
  fix?: IssueFix  // a document-wide auto-fix exists for this kind of issue
}

// Text of every user-editable field of a block (code bodies excluded: quotes,
// spaces and hyphens there are code, not typography).
export function blockTexts(b: ReportBlock): string[] {
  const items = (list: ListItem[]): string[] => list.flatMap(i => [i.text, ...items(i.children ?? [])])
  switch (b.type) {
    case 'paragraph':
    case 'text':
    case 'heading':
      return [b.text]
    case 'list':
      return [b.introText ?? '', ...items(b.items)]
    case 'code':
    case 'image':
      return [b.caption, b.referenceText ?? '']
    case 'table':
      return [b.caption, b.referenceText ?? '', ...b.headers, ...b.rows.flatMap(r => r.cells.map(c => c.text))]
    case 'formula':
      return [b.caption ?? '', b.referenceText ?? '']
    case 'toc':
    case 'sources':
      return [b.title ?? '']
    case 'appendix':
      return [b.title]
    case 'abbreviations':
      return [b.title ?? '', ...b.entries.flatMap(e => [e.term, e.definition])]
    case 'columns':
      return b.columns.flatMap(c => c.blocks.flatMap(blockTexts))
    case 'group':
      return b.blocks.flatMap(blockTexts)
    case 'pageBreak':
    case 'spacer':
      return []
  }
}

const REF = /\{ref:([^}]*)\}/g
const CITE = /\{cite:([^}|]*)(?:\|[^}]*)?\}/g
const key = (s: string) => s.trim().toLowerCase()

// Drop `mono` spans and escaped characters before looking at typography.
function prose(text: string): string {
  return text.replace(/\\./g, '').replace(/`[^`]*`/g, '')
}

export function checkDocument(doc: ReportDocument): FormatIssue[] {
  const issues: FormatIssue[] = []

  // Blocks in order, remembering the top-level block each one belongs to.
  const all: Array<{ block: ReportBlock; top: string }> = []
  const walk = (list: ReportBlock[], top?: string) => {
    for (const b of list) {
      all.push({ block: b, top: top ?? b.id })
      if (b.type === 'group') walk(b.blocks, top ?? b.id)
      if (b.type === 'columns') b.columns.forEach(c => walk(c.blocks, top ?? b.id))
    }
  }
  walk(doc.blocks)

  const add = (b: ReportBlock, top: string, message: string, fix?: IssueFix) => {
    issues.push({ blockId: top, where: `${blockTypeName(b)} · ${blockSummary(b)}`, message, fix })
  }

  // Every {ref:…} / {cite:…} used anywhere (title layout included).
  const texts = all.flatMap(({ block }) => (block.type === 'group' || block.type === 'columns' ? [] : blockTexts(block)))
  for (const tb of doc.titleTemplate) {
    if (tb.type === 'titleLine') texts.push(tb.text)
    else if (tb.type === 'titleContent') texts.push(...blockTexts(tb.block))
  }
  const usedRefs = new Set<string>()
  const usedCites = new Set<string>()
  for (const t of texts) {
    for (const m of t.matchAll(REF)) usedRefs.add(key(m[1]!))
    for (const m of t.matchAll(CITE)) m[1]!.split(',').map(key).filter(Boolean).forEach(k => usedCites.add(k))
  }

  // Labels and source keys that exist.
  const labels = new Map<string, number>()
  const sources = all.find(x => x.block.type === 'sources')
  const sourceEntries = sources?.block.type === 'sources' ? sources.block.entries : []
  for (const { block } of all) {
    if ('label' in block && block.label?.trim()) {
      labels.set(key(block.label), (labels.get(key(block.label)) ?? 0) + 1)
    }
  }
  const sourceKeys = new Map<string, number>()
  sourceEntries.forEach((e, i) => {
    sourceKeys.set(String(i + 1), 1)
    if (e.key?.trim()) sourceKeys.set(key(e.key), (sourceKeys.get(key(e.key)) ?? 0) + 1)
  })

  for (const { block: b, top } of all) {
    // Captions and in-text references of numbered objects.
    if (b.type === 'image' || b.type === 'table' || b.type === 'code') {
      if (!b.caption.trim()) add(b, top, 'Немає назви')
      const referenced = !!b.referenceText?.trim() || (!!b.label?.trim() && usedRefs.has(key(b.label)))
      if (!referenced) add(b, top, 'Немає посилання в тексті: увімкни «Показувати посилання» або дай мітку й напиши {ref:мітка}')
    }
    if (b.type === 'image' && !b.src) add(b, top, 'Не завантажено зображення')
    if ('label' in b && b.label?.trim() && (labels.get(key(b.label)) ?? 0) > 1) {
      add(b, top, `Мітка «${b.label.trim()}» повторюється в кількох блоках`)
    }
    if (b.type === 'heading' && /[.]\s*$/.test(b.text.trim()) && !/\.\.\.\s*$/.test(b.text)) {
      add(b, top, 'Крапка в кінці заголовка (за ДСТУ не ставиться)')
    }
    if (b.type === 'appendix' && !b.title.trim()) add(b, top, 'Немає заголовка додатка')

    if (b.type === 'group' || b.type === 'columns') continue
    const own = blockTexts(b)

    // Broken references / citations.
    for (const t of own) {
      for (const m of t.matchAll(REF)) {
        if (!labels.has(key(m[1]!))) add(b, top, `Посилання {ref:${m[1]}} — немає блоку з такою міткою`)
      }
      for (const m of t.matchAll(CITE)) {
        for (const k of m[1]!.split(',').map(key).filter(Boolean)) {
          if (!sourceKeys.has(k)) add(b, top, `Посилання {cite:${k}} — немає джерела з таким ключем`)
        }
      }
    }

    // Typography.
    const text = own.map(prose).join('\n')
    if (/"/.test(text)) add(b, top, 'Прямі лапки "…" — за ДСТУ «…»', 'quotes')
    if (/\s-\s|—/.test(text)) add(b, top, 'Дефіс або довге тире замість тире «–»', 'dashes')
    if (/\S {2,}\S/.test(text)) add(b, top, 'Подвійні пробіли', 'spaces')
  }

  // Sources: duplicate keys, entries never cited (once citations are in use).
  if (sources) {
    const b = sources.block
    sourceEntries.forEach((e, i) => {
      const k = e.key?.trim() ? key(e.key) : ''
      if (k && (sourceKeys.get(k) ?? 0) > 1) add(b, sources.top, `Ключ «${e.key!.trim()}» повторюється`)
      if (usedCites.size && !usedCites.has(String(i + 1)) && !(k && usedCites.has(k))) {
        add(b, sources.top, `Джерело №${i + 1} ніде не процитоване в тексті`)
      }
    })
  }

  return issues
}

// Apply fn outside `mono` spans only.
function outsideMono(fn: (s: string) => string): (s: string) => string {
  return s => s.split(/(`[^`]*`)/).map((part, i) => (i % 2 ? part : fn(part))).join('')
}

// Auto-fixes, applied to every text field through store.transformAllText
// (with code blocks skipped).
export const FIXES: Record<IssueFix, { label: string; apply: (s: string) => string }> = {
  quotes: {
    label: '"…" → «…»',
    apply: outsideMono(s => s.replace(/(?<!\\)"([^"\n]*)(?<!\\)"/g, '«$1»')),
  },
  dashes: {
    label: ' - і — → –',
    apply: outsideMono(s => s.replace(/(?<!\\)—/g, '–').replace(/(\s)-(?=\s)/g, '$1–')),
  },
  spaces: {
    label: 'Подвійні пробіли',
    apply: outsideMono(s => s.replace(/(\S) {2,}(?=\S)/g, '$1 ')),
  },
}
