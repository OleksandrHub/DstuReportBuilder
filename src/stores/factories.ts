import type {
  ReportDocument,
  TitleBlock,
  SourceEntry,
} from '../types/document'
import {
  DEFAULT_SETTINGS,
  DEFAULT_TITLE_PAGE,
  DEFAULT_TITLE_TEMPLATE,
} from '../types/document'

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function emptySourceEntry(): SourceEntry {
  return {
    id: generateId(),
    type: 'book',
    authors: '', title: '', city: '', publisher: '', year: '',
    pages: '', journal: '', url: '', accessDate: '',
  }
}

export function deepCloneTitleBlocks(blocks: TitleBlock[]): TitleBlock[] {
  return JSON.parse(JSON.stringify(blocks)) as TitleBlock[]
}

export function createDocument(name: string): ReportDocument {
  return {
    id: generateId(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    titlePage: { ...DEFAULT_TITLE_PAGE, year: new Date().getFullYear().toString() },
    titleTemplate: deepCloneTitleBlocks(DEFAULT_TITLE_TEMPLATE),
    // Deep clone: DEFAULT_SETTINGS now holds nested style objects that must
    // not be shared between documents.
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    blocks: [],
  }
}
