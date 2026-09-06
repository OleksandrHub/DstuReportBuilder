import type {
  ReportDocument,
  TitlePageTemplate,
  TitleDataTemplate,
  TitlePageData,
  DocumentSettings,
  TitleBlock,
} from '../types/document'
import { DEFAULT_SETTINGS, DEFAULT_TITLE_PAGE } from '../types/document'
import type { PersistedState } from './storage'

// ---------------------------------------------------------------------------
// Backup file format (JSON). One format covers both cases:
// - full backup: all documents + both template lists
// - single document: `documents` holds one item, template lists are empty
// ---------------------------------------------------------------------------

export const BACKUP_APP_ID = 'dstu-report-builder'
export const BACKUP_VERSION = 1
const LARGE_FILE_BYTES = 4 * 1024 * 1024

export interface BackupPayload {
  app: typeof BACKUP_APP_ID
  version: number
  exportedAt: string
  documents: ReportDocument[]
  titleTemplates: TitlePageTemplate[]
  titleDataTemplates: TitleDataTemplate[]
}

export type ImportMode = 'merge' | 'replace'

export interface ValidatedImport {
  documents: ReportDocument[]
  titleTemplates: TitlePageTemplate[]
  titleDataTemplates: TitleDataTemplate[]
  warnings: string[]
}

export interface BackupImportResult {
  error?: string
  addedDocs: number
  addedLayouts: number
  addedData: number
  skippedDocs: number
  warnings: string[]
}

export function buildBackupPayload(state: PersistedState): BackupPayload {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    documents: state.documents,
    titleTemplates: state.titleTemplates,
    titleDataTemplates: state.titleDataTemplates,
  }
}

export function buildSingleDocumentPayload(doc: ReportDocument): BackupPayload {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    documents: [doc],
    titleTemplates: [],
    titleDataTemplates: [],
  }
}

export function serializeBackup(payload: BackupPayload): string {
  // JSON.stringify reads through Vue reactive proxies, so no DataCloneError here.
  return JSON.stringify(payload, null, 2)
}

// ---------------------------------------------------------------------------
// Filenames + download
// ---------------------------------------------------------------------------

function fileStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

export function backupFileName(): string {
  return `DSTU-backup-${fileStamp()}.json`
}

export function documentFileName(name: string): string {
  return `DSTU-${sanitizeFileName(name) || 'document'}-${fileStamp()}.json`
}

export function downloadJsonFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------------------------------------------------------------------------
// Import parsing + validation
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Normalize one raw document; missing sections fall back to defaults and
 *  are later backfilled by migrateDocuments(). Returns an error string for
 *  entries that must be skipped. */
export function sanitizeDocument(raw: unknown, index: number): { doc?: ReportDocument; error?: string } {
  if (!isRecord(raw)) return { error: `Документ #${index + 1}: не обʼєкт, пропущено` }
  if (!Array.isArray(raw.blocks)) return { error: `Документ #${index + 1}: відсутній масив blocks, пропущено` }
  const now = new Date().toISOString()
  const doc: ReportDocument = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : '',
    name: typeof raw.name === 'string' && raw.name ? raw.name : `Імпортований документ ${index + 1}`,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: now,
    titlePage: isRecord(raw.titlePage) ? (raw.titlePage as unknown as TitlePageData) : { ...DEFAULT_TITLE_PAGE },
    titleTemplate: Array.isArray(raw.titleTemplate) ? (raw.titleTemplate as TitleBlock[]) : [],
    settings: isRecord(raw.settings) ? (raw.settings as unknown as DocumentSettings) : { ...DEFAULT_SETTINGS },
    blocks: raw.blocks as ReportDocument['blocks'],
  }
  return { doc }
}

function asTemplateArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

export function parseImportPayload(text: string): { ok: true; data: ValidatedImport } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Файл не є коректним JSON' }
  }
  if (!isRecord(parsed)) return { ok: false, error: 'Невідомий формат файлу' }

  // Friendly redirect for the *templates-only* bundle (imported in the Titles tab).
  if (parsed.kind === 'dstu-templates') {
    return { ok: false, error: 'Це файл шаблонів титулки. Імпортуйте його у вкладці «Титулки» (кнопка ⬆ Імпорт).' }
  }

  if (typeof parsed.app === 'string' && parsed.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'Це JSON іншого додатку, а не бекап ДСТУ Конструктора' }
  }
  if (typeof parsed.version === 'number' && parsed.version > BACKUP_VERSION) {
    return { ok: false, error: 'Файл створено у новіший версії додатку. Оновіть додаток і спробуйте знову.' }
  }

  // Accept both the backup container and a bare single document.
  const docsRaw: unknown[] = Array.isArray(parsed.documents)
    ? parsed.documents
    : Array.isArray(parsed.blocks)
      ? [parsed]
      : []
  if (!Array.isArray(parsed.documents) && !Array.isArray(parsed.blocks)) {
    return { ok: false, error: 'У файлі немає документів: очікується бекап DSTU (.json) або документ' }
  }

  const warnings: string[] = []
  if (text.length > LARGE_FILE_BYTES) {
    warnings.push('Великий файл (багато зображень) — імпорт може тривати кілька секунд.')
  }

  return {
    ok: true,
    data: {
      documents: docsRaw as ReportDocument[],
      titleTemplates: asTemplateArray<TitlePageTemplate>(parsed.titleTemplates),
      titleDataTemplates: asTemplateArray<TitleDataTemplate>(parsed.titleDataTemplates),
      warnings,
    },
  }
}
