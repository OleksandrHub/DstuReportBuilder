import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  ReportDocument,
  ReportBlock,
  DocumentSettings,
  TitlePageData,
  ListItem,
  TableRow,
  TitleBlock,
  TitlePageTemplate,
  TitleDataTemplate,
  SourceEntry,
  SourcesBlock,
  ColumnsBlock,
} from '../types/document'
import {
  DEFAULT_TITLE_TEMPLATE,
  parseMarkdownTable,
} from '../types/document'
import { generateId, emptySourceEntry, deepCloneTitleBlocks, createDocument } from './factories'
import {
  loadState,
  saveState,
  describeStorageError,
  type StorageBackend,
  type PersistedState,
} from './storage'
import { migrateDocuments } from './migrations'
import { cloneBlockWithNewIds, findListItem } from './block-utils'
import {
  buildBackupPayload,
  buildSingleDocumentPayload,
  serializeBackup,
  parseImportPayload,
  sanitizeDocument,
  backupFileName,
  documentFileName,
  type ImportMode,
  type BackupImportResult,
} from './document-io'

export const useReportStore = defineStore('report', () => {
  const documents = ref<ReportDocument[]>([])
  const activeDocumentId = ref<string | null>(null)
  const titleTemplates = ref<TitlePageTemplate[]>([])
  const titleDataTemplates = ref<TitleDataTemplate[]>([])

  // --- Async persistence state (IndexedDB-first, see ./storage.ts) ---
  const ready = ref(false)
  const storageBackend = ref<StorageBackend>('indexeddb')
  const storageError = ref<string | null>(null)
  const lastSavedAt = ref<string | null>(null)

  let persistTimer: ReturnType<typeof setTimeout> | null = null
  let persistInFlight = false
  let persistQueued = false

  function currentState(): PersistedState {
    return {
      documents: documents.value,
      titleTemplates: titleTemplates.value,
      titleDataTemplates: titleDataTemplates.value,
      activeDocumentId: activeDocumentId.value,
    }
  }

  async function persistNow() {
    if (persistInFlight) {
      persistQueued = true
      return
    }
    persistInFlight = true
    try {
      await saveState(currentState(), storageBackend.value)
      lastSavedAt.value = new Date().toISOString()
      storageError.value = null
    } catch (e) {
      storageError.value = describeStorageError(e)
    } finally {
      persistInFlight = false
      if (persistQueued) {
        persistQueued = false
        schedulePersist()
      }
    }
  }

  function schedulePersist() {
    if (!ready.value) return
    if (persistTimer) clearTimeout(persistTimer)
    // Debounce: deep watchers fire on every keystroke; IndexedDB writes of
    // large documents are async and must not block typing.
    persistTimer = setTimeout(() => void persistNow(), 500)
  }

  async function initStore() {
    try {
      const { state, backend } = await loadState()
      storageBackend.value = backend
      migrateDocuments(state.documents)
      documents.value = state.documents
      titleTemplates.value = state.titleTemplates
      titleDataTemplates.value = state.titleDataTemplates

      if (documents.value.length === 0) {
        const first = createDocument('Лабораторна робота №1')
        documents.value.push(first)
        activeDocumentId.value = first.id
      } else if (state.activeDocumentId && documents.value.some(d => d.id === state.activeDocumentId)) {
        activeDocumentId.value = state.activeDocumentId
      } else {
        activeDocumentId.value = documents.value[0]?.id ?? null
      }
    } catch (e) {
      // Total storage failure (e.g. blocked IDB + no localStorage): keep the
      // app usable in-memory and show the error banner.
      storageError.value = describeStorageError(e)
      if (documents.value.length === 0) {
        const first = createDocument('Лабораторна робота №1')
        documents.value.push(first)
        activeDocumentId.value = first.id
      }
    } finally {
      ready.value = true
      schedulePersist()
    }
  }

  // Kick off async load immediately; components render a loading state
  // until `ready` becomes true.
  void initStore()

  const activeDocument = computed<ReportDocument | null>(() =>
    documents.value.find(d => d.id === activeDocumentId.value) ?? null
  )

  // Persist everything (documents + templates + active id) with debounce.
  // Guards on `ready` so the initial async load doesn't trigger a write
  // before state is populated (initStore schedules one persist itself).
  watch(
    [documents, titleTemplates, titleDataTemplates, activeDocumentId],
    () => schedulePersist(),
    { deep: true },
  )

  function touchActive() {
    const doc = activeDocument.value
    if (doc) doc.updatedAt = new Date().toISOString()
  }

  // Find a block by id in the body OR inside a titleContent wrapper in the title
  // layout — so block editors work the same whether the block sits in the body
  // or in the title.
  function findBlockById(blockId: string): ReportBlock | undefined {
    const doc = activeDocument.value
    if (!doc) return undefined
    const inBody = doc.blocks.find(b => b.id === blockId)
    if (inBody) return inBody
    for (const tb of doc.titleTemplate) {
      if (tb.type === 'titleContent' && tb.block.id === blockId) return tb.block
    }
    return undefined
  }

  // --- Document management ---

  function createNewDocument(name: string): string {
    const doc = createDocument(name)
    documents.value.push(doc)
    activeDocumentId.value = doc.id
    return doc.id
  }

  function duplicateDocument(id: string): string {
    const src = documents.value.find(d => d.id === id)
    if (!src) return ''
    const copy: ReportDocument = JSON.parse(JSON.stringify(src))
    copy.id = generateId()
    copy.name = src.name + ' (копія)'
    copy.createdAt = new Date().toISOString()
    copy.updatedAt = new Date().toISOString()
    copy.blocks = copy.blocks.map(b => ({ ...b, id: generateId() }))
    documents.value.push(copy)
    activeDocumentId.value = copy.id
    return copy.id
  }

  function deleteDocument(id: string) {
    const idx = documents.value.findIndex(d => d.id === id)
    if (idx === -1) return
    documents.value.splice(idx, 1)
    if (documents.value.length === 0) {
      const fresh = createDocument('Лабораторна робота №1')
      documents.value.push(fresh)
      activeDocumentId.value = fresh.id
    } else if (activeDocumentId.value === id) {
      activeDocumentId.value = documents.value[0]!.id
    }
  }

  function renameDocument(id: string, name: string) {
    const doc = documents.value.find(d => d.id === id)
    if (doc) { doc.name = name; doc.updatedAt = new Date().toISOString() }
  }

  function setActiveDocument(id: string) {
    activeDocumentId.value = id
  }

  // --- Title page ---

  function updateTitlePage(data: Partial<TitlePageData>) {
    const doc = activeDocument.value
    if (!doc) return
    doc.titlePage = { ...doc.titlePage, ...data }
    touchActive()
  }

  // --- Settings ---

  function updateSettings(data: Partial<DocumentSettings>) {
    const doc = activeDocument.value
    if (!doc) return
    doc.settings = { ...doc.settings, ...data }
    touchActive()
  }

  // --- Blocks ---

  function addBlock(type: ReportBlock['type'], afterId?: string, position?: 'start') {
    const doc = activeDocument.value
    if (!doc) return

    let block: ReportBlock

    if (type === 'paragraph') {
      block = { id: generateId(), type: 'paragraph', text: '' }
    } else if (type === 'text') {
      block = { id: generateId(), type: 'text', text: '' }
    } else if (type === 'heading') {
      block = { id: generateId(), type: 'heading', text: '', level: 1 }
    } else if (type === 'list') {
      block = {
        id: generateId(),
        type: 'list',
        ordered: false,
        items: [
          { id: generateId(), text: '' },
        ],
        introText: '',
      }
    } else if (type === 'code') {
      block = {
        id: generateId(),
        type: 'code',
        caption: '',
        code: '',
        language: 'typescript',
        referenceText: 'Код програми подано у лістингу {no}.',
      }
    } else if (type === 'image') {
      block = {
        id: generateId(),
        type: 'image',
        src: '',
        caption: '',
        referenceText: 'Результат роботи програми наведено на рисунку {no}.',
      }
    } else if (type === 'table') {
      block = {
        id: generateId(),
        type: 'table',
        caption: '',
        headers: ['Стовпець 1', 'Стовпець 2'],
        rows: [
          { id: generateId(), cells: [{ text: '' }, { text: '' }] },
        ],
        referenceText: 'Дані наведено у таблиці {no}.',
      }
    } else if (type === 'formula') {
      block = {
        id: generateId(),
        type: 'formula',
        latex: 'E = mc^2',
        caption: '',
        referenceText: '',
        numbered: true,
      }
    } else if (type === 'pageBreak') {
      block = { id: generateId(), type: 'pageBreak' }
    } else if (type === 'spacer') {
      block = { id: generateId(), type: 'spacer', lines: 1 }
    } else if (type === 'toc') {
      block = { id: generateId(), type: 'toc', title: 'Зміст' }
    } else if (type === 'sources') {
      block = {
        id: generateId(),
        type: 'sources',
        title: 'Список використаних джерел',
        entries: [emptySourceEntry()],
      }
    } else {
      block = {
        id: generateId(),
        type: 'columns',
        columns: [
          { id: generateId(), width: 50, blocks: [{ id: generateId(), type: 'paragraph', text: 'Текст лівого стовпця...' }] },
          { id: generateId(), width: 50, blocks: [{ id: generateId(), type: 'paragraph', text: 'Текст правого стовпця...' }] },
        ],
      }
    }

    if (position === 'start') {
      doc.blocks.unshift(block)
      touchActive()
      return
    }

    if (afterId) {
      const idx = doc.blocks.findIndex(b => b.id === afterId)
      if (idx !== -1) {
        doc.blocks.splice(idx + 1, 0, block)
        touchActive()
        return
      }
    }

    doc.blocks.push(block)
    touchActive()
  }

  function addIntroBlocks() {
    const doc = activeDocument.value
    if (!doc) return
    const introBlocks: ReportBlock[] = [
      { id: generateId(), type: 'paragraph', text: '**Тема:** ', bold: false, align: 'justify' },
      { id: generateId(), type: 'paragraph', text: '**Мета:** ', bold: false, align: 'justify' },
      { id: generateId(), type: 'paragraph', text: 'Варіант №1', bold: false, align: 'center' },
      { id: generateId(), type: 'paragraph', text: 'Виконання роботи:', bold: true, align: 'center' },
      { id: generateId(), type: 'paragraph', text: '**Висновки:** ', bold: false, align: 'justify' },
    ]
    doc.blocks = [...introBlocks, ...doc.blocks]
    touchActive()
  }

  // Apply a string transform to every user-editable text field across all blocks.
  // Returns the number of fields changed.
  function transformAllText(fn: (s: string) => string): number {
    const doc = activeDocument.value
    if (!doc) return 0
    let changed = 0
    const apply = (s: string | undefined): string | undefined => {
      if (s == null) return s
      const out = fn(s)
      if (out !== s) changed++
      return out
    }
    const applyItems = (items: ListItem[]) => {
      items.forEach(i => {
        i.text = apply(i.text)!
        if (i.children) applyItems(i.children)
      })
    }
    for (const b of doc.blocks) {
      if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'text') {
        b.text = apply(b.text)!
      } else if (b.type === 'list') {
        if (b.introText !== undefined) b.introText = apply(b.introText)
        applyItems(b.items)
      } else if (b.type === 'code') {
        b.caption = apply(b.caption)!
        b.code = apply(b.code)!
        b.referenceText = apply(b.referenceText)
      } else if (b.type === 'image') {
        b.caption = apply(b.caption)!
        b.referenceText = apply(b.referenceText)
      } else if (b.type === 'table') {
        b.caption = apply(b.caption)!
        b.referenceText = apply(b.referenceText)
        b.headers = b.headers.map(h => apply(h)!)
        b.rows.forEach(r => r.cells.forEach(c => { c.text = apply(c.text)! }))
      } else if (b.type === 'formula') {
        if (b.caption !== undefined) b.caption = apply(b.caption)
        b.referenceText = apply(b.referenceText)
      } else if (b.type === 'toc') {
        if (b.title !== undefined) b.title = apply(b.title)
      }
    }
    if (changed) touchActive()
    return changed
  }

  function replaceAllText(find: string, replace: string, caseSensitive = false): number {
    if (!find) return 0
    const flags = caseSensitive ? 'g' : 'gi'
    const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
    return transformAllText(s => s.replace(re, replace))
  }

  // Replace em dash (—) and hyphen-minus used as dashes with the en dash (–).
  function emDashToEnDash(): number {
    return transformAllText(s => s.replace(/—/g, '–'))
  }

  function removeBlock(id: string) {
    const doc = activeDocument.value
    if (!doc) return
    doc.blocks = doc.blocks.filter(b => b.id !== id)
    touchActive()
  }

  function duplicateBlock(id: string) {
    const doc = activeDocument.value
    if (!doc) return
    const idx = doc.blocks.findIndex(b => b.id === id)
    if (idx === -1) return
    const copy = cloneBlockWithNewIds(doc.blocks[idx]!)
    doc.blocks.splice(idx + 1, 0, copy)
    touchActive()
  }

  function moveBlock(id: string, direction: 'up' | 'down') {
    const doc = activeDocument.value
    if (!doc) return
    const idx = doc.blocks.findIndex(b => b.id === id)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === doc.blocks.length - 1) return
    const target = direction === 'up' ? idx - 1 : idx + 1
    const tmp = doc.blocks[idx]!
    doc.blocks[idx] = doc.blocks[target]!
    doc.blocks[target] = tmp
    touchActive()
  }

  function updateBlock(id: string, data: Partial<ReportBlock>) {
    const doc = activeDocument.value
    if (!doc) return
    const idx = doc.blocks.findIndex(b => b.id === id)
    if (idx === -1) return
    doc.blocks[idx] = { ...doc.blocks[idx], ...data } as ReportBlock
    touchActive()
  }

  // --- List helpers ---

  function addListItem(blockId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = findBlockById(blockId)
    if (!block || block.type !== 'list') return
    block.items.push({ id: generateId(), text: '' })
    touchActive()
  }

  function addSubListItem(blockId: string, parentItemId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = findBlockById(blockId)
    if (!block || block.type !== 'list') return
    const found = findListItem(block.items, parentItemId)
    if (!found) return
    if (!found.item.children) found.item.children = []
    found.item.children.push({ id: generateId(), text: '' })
    touchActive()
  }

  // Add a new item right after the given one, at the same nesting level.
  function addSiblingListItem(blockId: string, itemId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = findBlockById(blockId)
    if (!block || block.type !== 'list') return
    const found = findListItem(block.items, itemId)
    if (!found) return
    const idx = found.siblings.findIndex(i => i.id === itemId)
    found.siblings.splice(idx + 1, 0, { id: generateId(), text: '' })
    touchActive()
  }

  function removeListItem(blockId: string, itemId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = findBlockById(blockId)
    if (!block || block.type !== 'list') return
    const found = findListItem(block.items, itemId)
    if (!found) return
    const idx = found.siblings.findIndex(i => i.id === itemId)
    if (idx !== -1) found.siblings.splice(idx, 1)
    touchActive()
  }

  function updateListItem(blockId: string, itemId: string, text: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = findBlockById(blockId)
    if (!block || block.type !== 'list') return
    const found = findListItem(block.items, itemId)
    if (found) { found.item.text = text; touchActive() }
  }

  // --- Table helpers ---

  function addTableRow(blockId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = findBlockById(blockId)
    if (!block || block.type !== 'table') return
    const newRow: TableRow = {
      id: generateId(),
      cells: block.headers.map(() => ({ text: '' })),
    }
    block.rows.push(newRow)
    touchActive()
  }

  function removeTableRow(blockId: string, rowId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = findBlockById(blockId)
    if (!block || block.type !== 'table') return
    block.rows = block.rows.filter((r: TableRow) => r.id !== rowId)
    touchActive()
  }

  function addTableColumn(blockId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = findBlockById(blockId)
    if (!block || block.type !== 'table') return
    block.headers.push('Стовпець ' + (block.headers.length + 1))
    block.rows.forEach((r: TableRow) => r.cells.push({ text: '' }))
    touchActive()
  }

  function setTableFullWidth(blockId: string, full: boolean) {
    const doc = activeDocument.value
    if (!doc) return
    const block = findBlockById(blockId)
    if (!block || block.type !== 'table') return
    block.fullWidth = full
    touchActive()
  }

  function setTableColumnWidth(blockId: string, colIndex: number, pct: number) {
    const doc = activeDocument.value
    if (!doc) return
    const block = findBlockById(blockId)
    if (!block || block.type !== 'table') return
    const n = block.headers.length
    // Initialize to an even split if no explicit widths yet.
    if (!block.columnWidths || block.columnWidths.length !== n) {
      block.columnWidths = Array.from({ length: n }, () => Math.round(100 / n))
    }
    block.columnWidths[colIndex] = pct
    touchActive()
  }

  function resetTableColumnWidths(blockId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = findBlockById(blockId)
    if (!block || block.type !== 'table') return
    block.columnWidths = undefined
    touchActive()
  }

  function importMarkdownTable(blockId: string, md: string): boolean {
    const doc = activeDocument.value
    if (!doc) return false
    const block = findBlockById(blockId)
    if (!block || block.type !== 'table') return false
    const parsed = parseMarkdownTable(md)
    if (!parsed || parsed.headers.length === 0) return false
    block.headers = [...parsed.headers]
    block.rows = parsed.rows.map(cells => ({
      id: generateId(),
      cells: cells.map(text => ({ text })),
    }))
    // Column count changed → drop stale explicit widths.
    block.columnWidths = undefined
    touchActive()
    return true
  }

  function toggleTableRowSplit(blockId: string, rowId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const block = findBlockById(blockId)
    if (!block || block.type !== 'table') return
    const row = block.rows.find((r: TableRow) => r.id === rowId)
    if (!row) return
    row.splitBefore = !row.splitBefore
    touchActive()
  }

  function removeTableColumn(blockId: string, colIndex: number) {
    const doc = activeDocument.value
    if (!doc) return
    const block = findBlockById(blockId)
    if (!block || block.type !== 'table') return
    if (block.headers.length <= 1) return
    block.headers.splice(colIndex, 1)
    block.rows.forEach((r: TableRow) => r.cells.splice(colIndex, 1))
    touchActive()
  }

  // --- Sources (ДСТУ) helpers ---

  function findSourcesBlock(blockId: string): SourcesBlock | null {
    const doc = activeDocument.value
    if (!doc) return null
    const b = findBlockById(blockId)
    return b && b.type === 'sources' ? b : null
  }

  function addSource(blockId: string) {
    const b = findSourcesBlock(blockId)
    if (!b) return
    b.entries.push(emptySourceEntry())
    touchActive()
  }

  function removeSource(blockId: string, entryId: string) {
    const b = findSourcesBlock(blockId)
    if (!b) return
    b.entries = b.entries.filter(e => e.id !== entryId)
    touchActive()
  }

  function updateSource(blockId: string, entryId: string, data: Partial<SourceEntry>) {
    const b = findSourcesBlock(blockId)
    if (!b) return
    const e = b.entries.find(x => x.id === entryId)
    if (!e) return
    Object.assign(e, data)
    touchActive()
  }

  function moveSource(blockId: string, entryId: string, dir: 'up' | 'down') {
    const b = findSourcesBlock(blockId)
    if (!b) return
    const i = b.entries.findIndex(e => e.id === entryId)
    if (i === -1) return
    const j = dir === 'up' ? i - 1 : i + 1
    if (j < 0 || j >= b.entries.length) return
    const tmp = b.entries[i]!
    b.entries[i] = b.entries[j]!
    b.entries[j] = tmp
    touchActive()
  }

  // --- Columns helpers ---

  function findColumnsBlock(blockId: string): ColumnsBlock | null {
    const b = findBlockById(blockId)
    return b && b.type === 'columns' ? b : null
  }

  function setColumnCount(blockId: string, count: number) {
    const b = findColumnsBlock(blockId)
    if (!b) return
    const n = Math.max(1, Math.min(4, count))
    const cur = b.columns.length
    if (n > cur) {
      for (let i = cur; i < n; i++) {
        b.columns.push({ id: generateId(), width: 0, blocks: [{ id: generateId(), type: 'paragraph', text: '' }] })
      }
    } else if (n < cur) {
      b.columns = b.columns.slice(0, n)
    }
    // Even widths.
    const w = Math.round(100 / n)
    b.columns.forEach(c => { c.width = w })
    touchActive()
  }

  function setColumnWidth(blockId: string, colId: string, width: number) {
    const b = findColumnsBlock(blockId)
    if (!b) return
    const c = b.columns.find(x => x.id === colId)
    if (!c) return
    c.width = width
    touchActive()
  }

  function addColumnBlock(blockId: string, colId: string, type: ReportBlock['type']) {
    const b = findColumnsBlock(blockId)
    if (!b) return
    const col = b.columns.find(x => x.id === colId)
    if (!col) return
    let nb: ReportBlock
    if (type === 'heading') nb = { id: generateId(), type: 'heading', text: 'Заголовок', level: 2 }
    else if (type === 'image') nb = { id: generateId(), type: 'image', src: '', caption: 'Назва рисунка', referenceText: '' }
    else nb = { id: generateId(), type: 'paragraph', text: 'Текст...' }
    col.blocks.push(nb)
    touchActive()
  }

  function updateColumnBlock(blockId: string, colId: string, innerId: string, data: Partial<ReportBlock>) {
    const b = findColumnsBlock(blockId)
    if (!b) return
    const col = b.columns.find(x => x.id === colId)
    if (!col) return
    const idx = col.blocks.findIndex(x => x.id === innerId)
    if (idx === -1) return
    col.blocks[idx] = { ...col.blocks[idx], ...data } as ReportBlock
    touchActive()
  }

  function removeColumnBlock(blockId: string, colId: string, innerId: string) {
    const b = findColumnsBlock(blockId)
    if (!b) return
    const col = b.columns.find(x => x.id === colId)
    if (!col) return
    col.blocks = col.blocks.filter(x => x.id !== innerId)
    touchActive()
  }

  function getBlockIndex(blockId: string, type: ReportBlock['type']): number {
    const doc = activeDocument.value
    if (!doc) return 0
    const filtered = doc.blocks.filter(b => b.type === type)
    return filtered.findIndex(b => b.id === blockId) + 1
  }

  // --- Title template (per-document blocks) ---

  function insertTitleBlock(newBlock: TitleBlock, afterId?: string) {
    const doc = activeDocument.value
    if (!doc) return
    if (afterId) {
      const idx = doc.titleTemplate.findIndex(b => b.id === afterId)
      if (idx !== -1) {
        doc.titleTemplate.splice(idx + 1, 0, newBlock)
        touchActive()
        return
      }
    }
    doc.titleTemplate.push(newBlock)
    touchActive()
  }

  function addTitleBlock(type: TitleBlock['type'], afterId?: string) {
    const newBlock: TitleBlock = type === 'titleSpacer'
      ? { id: generateId(), type: 'titleSpacer', lines: 1 }
      : { id: generateId(), type: 'titleLine', text: 'Новий рядок', align: 'center', bold: false, spaceBefore: false, paddingLeft: 0, paddingRight: 0 }
    insertTitleBlock(newBlock, afterId)
  }

  // Add a regular body block (paragraph/heading/image/table/formula/list) into
  // the title layout, wrapped in a titleContent block.
  function addTitleContentBlock(blockType: ReportBlock['type'], afterId?: string) {
    let inner: ReportBlock
    if (blockType === 'heading') inner = { id: generateId(), type: 'heading', text: '', level: 1 }
    else if (blockType === 'image') inner = { id: generateId(), type: 'image', src: '', caption: '', referenceText: '' }
    else if (blockType === 'table') inner = { id: generateId(), type: 'table', caption: '', headers: ['Стовпець 1', 'Стовпець 2'], rows: [{ id: generateId(), cells: [{ text: '' }, { text: '' }] }], referenceText: '' }
    else if (blockType === 'formula') inner = { id: generateId(), type: 'formula', latex: '', caption: '', referenceText: '', numbered: false }
    else if (blockType === 'list') inner = { id: generateId(), type: 'list', ordered: false, items: [{ id: generateId(), text: '' }], introText: '' }
    else if (blockType === 'columns') inner = {
      id: generateId(), type: 'columns',
      columns: [
        { id: generateId(), width: 50, blocks: [{ id: generateId(), type: 'paragraph', text: '' }] },
        { id: generateId(), width: 50, blocks: [{ id: generateId(), type: 'paragraph', text: '' }] },
      ],
    }
    else inner = { id: generateId(), type: 'paragraph', text: '' }
    insertTitleBlock({ id: generateId(), type: 'titleContent', block: inner }, afterId)
  }

  // Update the inner block of a titleContent wrapper.
  function updateTitleContentBlock(titleBlockId: string, data: Partial<ReportBlock>) {
    const doc = activeDocument.value
    if (!doc) return
    const tb = doc.titleTemplate.find(b => b.id === titleBlockId)
    if (!tb || tb.type !== 'titleContent') return
    tb.block = { ...tb.block, ...data } as ReportBlock
    touchActive()
  }

  function removeTitleBlock(id: string) {
    const doc = activeDocument.value
    if (!doc) return
    doc.titleTemplate = doc.titleTemplate.filter(b => b.id !== id)
    touchActive()
  }

  function moveTitleBlock(id: string, direction: 'up' | 'down') {
    const doc = activeDocument.value
    if (!doc) return
    const idx = doc.titleTemplate.findIndex(b => b.id === id)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === doc.titleTemplate.length - 1) return
    const target = direction === 'up' ? idx - 1 : idx + 1
    const tmp = doc.titleTemplate[idx]!
    doc.titleTemplate[idx] = doc.titleTemplate[target]!
    doc.titleTemplate[target] = tmp
    touchActive()
  }

  function updateTitleBlock(id: string, data: Partial<TitleBlock>) {
    const doc = activeDocument.value
    if (!doc) return
    const idx = doc.titleTemplate.findIndex(b => b.id === id)
    if (idx === -1) return
    doc.titleTemplate[idx] = { ...doc.titleTemplate[idx], ...data } as TitleBlock
    touchActive()
  }

  function resetTitleTemplate() {
    const doc = activeDocument.value
    if (!doc) return
    doc.titleTemplate = deepCloneTitleBlocks(DEFAULT_TITLE_TEMPLATE)
    touchActive()
  }

  // --- Global title templates (presets) ---

  function saveAsTemplate(name: string) {
    const doc = activeDocument.value
    if (!doc) return
    const template: TitlePageTemplate = {
      id: generateId(),
      name,
      blocks: deepCloneTitleBlocks(doc.titleTemplate),
    }
    titleTemplates.value.push(template)
  }

  function applyTemplate(templateId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const tpl = titleTemplates.value.find(t => t.id === templateId)
    if (!tpl) return
    doc.titleTemplate = deepCloneTitleBlocks(tpl.blocks)
    touchActive()
  }

  function deleteTemplate(templateId: string) {
    titleTemplates.value = titleTemplates.value.filter(t => t.id !== templateId)
  }

  function renameTemplate(templateId: string, name: string) {
    const tpl = titleTemplates.value.find(t => t.id === templateId)
    if (tpl) tpl.name = name
  }

  // --- Title data templates ---

  function saveAsDataTemplate(name: string) {
    const doc = activeDocument.value
    if (!doc) return
    titleDataTemplates.value.push({
      id: generateId(),
      name,
      data: { ...doc.titlePage },
    })
  }

  function applyDataTemplate(templateId: string) {
    const doc = activeDocument.value
    if (!doc) return
    const tpl = titleDataTemplates.value.find(t => t.id === templateId)
    if (!tpl) return
    doc.titlePage = { ...doc.titlePage, ...tpl.data }
    touchActive()
  }

  function deleteDataTemplate(templateId: string) {
    titleDataTemplates.value = titleDataTemplates.value.filter(t => t.id !== templateId)
  }

  function renameDataTemplate(templateId: string, name: string) {
    const tpl = titleDataTemplates.value.find(t => t.id === templateId)
    if (tpl) tpl.name = name
  }

  // --- Template export / import ---

  // Bundle all layout + data templates into one JSON string.
  function exportTemplates(): string {
    return JSON.stringify({
      kind: 'dstu-templates',
      version: 1,
      layoutTemplates: titleTemplates.value,
      dataTemplates: titleDataTemplates.value,
    }, null, 2)
  }

  // Import a bundle (merge=append with fresh ids; replace=overwrite). Returns
  // the number of layout + data templates added, or null on parse error.
  function importTemplates(json: string, mode: 'merge' | 'replace' = 'merge'): { layout: number; data: number } | null {
    try {
      const parsed = JSON.parse(json) as {
        kind?: string
        layoutTemplates?: TitlePageTemplate[]
        dataTemplates?: TitleDataTemplate[]
      }
      const layout = (parsed.layoutTemplates ?? []).map(t => ({ ...t, id: generateId() }))
      const data = (parsed.dataTemplates ?? []).map(t => ({ ...t, id: generateId() }))
      if (mode === 'replace') {
        titleTemplates.value = layout
        titleDataTemplates.value = data
      } else {
        titleTemplates.value = [...titleTemplates.value, ...layout]
        titleDataTemplates.value = [...titleDataTemplates.value, ...data]
      }
      return { layout: layout.length, data: data.length }
    } catch {
      return null
    }
  }

  // --- Full backup export / import (documents + templates, JSON) ---

  function exportBackupFile(): { filename: string; json: string } {
    return { filename: backupFileName(), json: serializeBackup(buildBackupPayload(currentState())) }
  }

  function exportDocumentFile(id: string): { filename: string; json: string } | null {
    const doc = documents.value.find(d => d.id === id)
    if (!doc) return null
    return { filename: documentFileName(doc.name), json: serializeBackup(buildSingleDocumentPayload(doc)) }
  }

  // Import a backup (or a single-document file). 'merge' appends everything
  // with fresh ids on collision; 'replace' overwrites the whole workspace.
  function importBackupFile(text: string, mode: ImportMode): BackupImportResult {
    const parsed = parseImportPayload(text)
    if (!parsed.ok) {
      return { error: parsed.error, addedDocs: 0, addedLayouts: 0, addedData: 0, skippedDocs: 0, warnings: [] }
    }
    const { documents: incoming, titleTemplates: layouts, titleDataTemplates: data, warnings } = parsed.data

    const validDocs: ReportDocument[] = []
    let skippedDocs = 0
    incoming.forEach((raw, i) => {
      const { doc, error } = sanitizeDocument(raw, i)
      if (!doc) {
        skippedDocs++
        if (error) warnings.push(error)
        return
      }
      migrateDocuments([doc])
      validDocs.push(doc)
    })

    if (mode === 'replace') {
      documents.value = validDocs
      titleTemplates.value = layouts.map(t => ({ ...t }))
      titleDataTemplates.value = data.map(t => ({ ...t }))
      if (documents.value.length === 0) {
        const fresh = createDocument('Лабораторна робота №1')
        documents.value.push(fresh)
      }
      activeDocumentId.value = documents.value[0]?.id ?? null
    } else {
      const existingIds = new Set(documents.value.map(d => d.id))
      for (const d of validDocs) {
        if (!d.id || existingIds.has(d.id)) d.id = generateId()
        existingIds.add(d.id)
        documents.value.push(d)
      }
      titleTemplates.value = [...titleTemplates.value, ...layouts.map(t => ({ ...t, id: generateId() }))]
      titleDataTemplates.value = [...titleDataTemplates.value, ...data.map(t => ({ ...t, id: generateId() }))]
      if (!activeDocumentId.value && documents.value.length > 0) {
        activeDocumentId.value = documents.value[0]!.id
      }
    }

    return {
      addedDocs: validDocs.length,
      addedLayouts: layouts.length,
      addedData: data.length,
      skippedDocs,
      warnings,
    }
  }

  return {
    documents,
    activeDocumentId,
    activeDocument,
    ready,
    storageBackend,
    storageError,
    lastSavedAt,
    /** Force an immediate persist (used by the error banner's "retry" button). */
    saveNow: () => void persistNow(),
    titleTemplates,
    createNewDocument,
    duplicateDocument,
    deleteDocument,
    renameDocument,
    setActiveDocument,
    updateTitlePage,
    updateSettings,
    addBlock,
    addIntroBlocks,
    replaceAllText,
    emDashToEnDash,
    addSource,
    removeSource,
    updateSource,
    moveSource,
    setColumnCount,
    setColumnWidth,
    addColumnBlock,
    updateColumnBlock,
    removeColumnBlock,
    removeBlock,
    duplicateBlock,
    moveBlock,
    updateBlock,
    addListItem,
    addSubListItem,
    addSiblingListItem,
    removeListItem,
    updateListItem,
    addTableRow,
    removeTableRow,
    addTableColumn,
    removeTableColumn,
    toggleTableRowSplit,
    setTableFullWidth,
    setTableColumnWidth,
    resetTableColumnWidths,
    importMarkdownTable,
    getBlockIndex,
    addTitleBlock,
    addTitleContentBlock,
    updateTitleContentBlock,
    removeTitleBlock,
    moveTitleBlock,
    updateTitleBlock,
    resetTitleTemplate,
    saveAsTemplate,
    applyTemplate,
    deleteTemplate,
    renameTemplate,
    titleDataTemplates,
    saveAsDataTemplate,
    applyDataTemplate,
    deleteDataTemplate,
    renameDataTemplate,
    exportTemplates,
    importTemplates,
    exportBackupFile,
    exportDocumentFile,
    importBackupFile,
  }
})
