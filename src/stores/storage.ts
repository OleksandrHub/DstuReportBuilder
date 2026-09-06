import type {
  ReportDocument,
  TitlePageTemplate,
  TitleDataTemplate,
} from '../types/document'
import {
  TITLE_TEMPLATES_STORAGE_KEY,
  TITLE_DATA_TEMPLATES_KEY,
} from '../types/document'
import { idb, isIndexedDBSupported } from './db'

// Legacy localStorage keys (kept as a one-time migration source + fallback
// for browsers without IndexedDB).
export const STORAGE_KEY = 'dstu-report-builder-documents'
export const ACTIVE_DOC_KEY = 'dstu-report-builder-active'

export type StorageBackend = 'indexeddb' | 'localstorage'

export interface PersistedState {
  documents: ReportDocument[]
  titleTemplates: TitlePageTemplate[]
  titleDataTemplates: TitleDataTemplate[]
  activeDocumentId: string | null
}

const IDB_KEYS = {
  documents: 'documents',
  titleTemplates: 'titleTemplates',
  titleDataTemplates: 'titleDataTemplates',
  activeDocumentId: 'activeDocumentId',
} as const

export function emptyState(): PersistedState {
  return { documents: [], titleTemplates: [], titleDataTemplates: [], activeDocumentId: null }
}

// ---------------------------------------------------------------------------
// Legacy localStorage layer
// ---------------------------------------------------------------------------

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function hasLegacyPayload(): boolean {
  try {
    return (
      localStorage.getItem(STORAGE_KEY) !== null ||
      localStorage.getItem(TITLE_TEMPLATES_STORAGE_KEY) !== null ||
      localStorage.getItem(TITLE_DATA_TEMPLATES_KEY) !== null ||
      localStorage.getItem(ACTIVE_DOC_KEY) !== null
    )
  } catch {
    return false
  }
}

function readLegacyState(): PersistedState {
  const documents = readJson<ReportDocument[]>(STORAGE_KEY) ?? []
  const titleTemplates = readJson<TitlePageTemplate[]>(TITLE_TEMPLATES_STORAGE_KEY) ?? []
  const titleDataTemplates = readJson<TitleDataTemplate[]>(TITLE_DATA_TEMPLATES_KEY) ?? []
  let activeDocumentId: string | null = null
  try {
    activeDocumentId = localStorage.getItem(ACTIVE_DOC_KEY)
  } catch {
    activeDocumentId = null
  }
  return { documents, titleTemplates, titleDataTemplates, activeDocumentId }
}

/** Remove the bulky legacy payload after a successful migration to IndexedDB
 *  (frees the ~5 MB localStorage quota). */
function clearLegacyPayload(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(TITLE_TEMPLATES_STORAGE_KEY)
    localStorage.removeItem(TITLE_DATA_TEMPLATES_KEY)
    localStorage.removeItem(ACTIVE_DOC_KEY)
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Public async API (IndexedDB-first)
// ---------------------------------------------------------------------------

async function readIndexedDBState(): Promise<PersistedState | null> {
  const [documents, titleTemplates, titleDataTemplates, activeDocumentId] = await Promise.all([
    idb.get<ReportDocument[]>(IDB_KEYS.documents),
    idb.get<TitlePageTemplate[]>(IDB_KEYS.titleTemplates),
    idb.get<TitleDataTemplate[]>(IDB_KEYS.titleDataTemplates),
    idb.get<string | null>(IDB_KEYS.activeDocumentId),
  ])
  // `documents === undefined` means "never written" → not initialized.
  if (documents === undefined) return null
  return {
    documents,
    titleTemplates: titleTemplates ?? [],
    titleDataTemplates: titleDataTemplates ?? [],
    activeDocumentId: activeDocumentId ?? null,
  }
}

async function writeIndexedDBState(state: PersistedState): Promise<void> {
  // Strip Vue reactivity: reactive proxies are NOT structured-cloneable
  // (throws DataCloneError on put). The model is JSON-safe — it previously
  // lived in localStorage as JSON — so a JSON round-trip is lossless here.
  const plain: PersistedState = JSON.parse(JSON.stringify(state))
  // Sequential puts avoid overwhelming the transaction on huge documents.
  await idb.set(IDB_KEYS.documents, plain.documents)
  await idb.set(IDB_KEYS.titleTemplates, plain.titleTemplates)
  await idb.set(IDB_KEYS.titleDataTemplates, plain.titleDataTemplates)
  await idb.set(IDB_KEYS.activeDocumentId, plain.activeDocumentId)
}

function writeLocalStorageState(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.documents))
  localStorage.setItem(TITLE_TEMPLATES_STORAGE_KEY, JSON.stringify(state.titleTemplates))
  localStorage.setItem(TITLE_DATA_TEMPLATES_KEY, JSON.stringify(state.titleDataTemplates))
  if (state.activeDocumentId) localStorage.setItem(ACTIVE_DOC_KEY, state.activeDocumentId)
  else localStorage.removeItem(ACTIVE_DOC_KEY)
}

export interface LoadResult {
  state: PersistedState
  backend: StorageBackend
  /** True when data was moved from localStorage into IndexedDB on this load. */
  migrated: boolean
}

/**
 * Load persisted state. Strategy:
 * 1. Try IndexedDB → return it (fast path, quota in hundreds of MB).
 * 2. Else read legacy localStorage; if IndexedDB works, migrate the payload
 *    there and delete the legacy keys to free the 5 MB quota.
 * 3. If IndexedDB is unavailable/broken, keep using localStorage as fallback.
 */
export async function loadState(): Promise<LoadResult> {
  if (isIndexedDBSupported()) {
    try {
      const fromIdb = await readIndexedDBState()
      if (fromIdb) return { state: fromIdb, backend: 'indexeddb', migrated: false }
    } catch {
      // Fall through to legacy — IDB may be blocked (private mode, old tab).
    }
  }

  const legacy = readLegacyState()

  if (isIndexedDBSupported()) {
    try {
      const hadLegacy = hasLegacyPayload()
      await writeIndexedDBState(legacy)
      if (hadLegacy) clearLegacyPayload()
      return { state: legacy, backend: 'indexeddb', migrated: hadLegacy }
    } catch {
      // IDB write failed (quota/blocked) → stay on localStorage.
    }
  }

  return { state: legacy, backend: 'localstorage', migrated: false }
}

/** Persist state to the backend chosen at load time. Throws on quota errors
 *  so the store can surface them (storageError banner) instead of failing silently. */
export async function saveState(state: PersistedState, backend: StorageBackend): Promise<void> {
  if (backend === 'indexeddb') {
    await writeIndexedDBState(state)
    return
  }
  try {
    writeLocalStorageState(state)
  } catch (e) {
    throw e instanceof Error ? e : new Error('Failed to write to localStorage')
  }
}

export function describeStorageError(e: unknown): string {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  if (/quota/i.test(msg)) {
    return 'Сховище переповнене. Видаліть зайві зображення або документи — інакше зміни може бути втрачено.'
  }
  return `Не вдалося зберегти дані (${msg}). Зміни тримаються лише в памʼяті вкладки.`
}
