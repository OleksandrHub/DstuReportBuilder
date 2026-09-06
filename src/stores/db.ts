// Minimal promise-based IndexedDB key-value wrapper (no dependencies).
//
// Why: localStorage caps at ~5 MB and stores everything as strings, while
// images are kept as base64 data-URLs inside documents. IndexedDB gives us
// structured-clone storage with a quota measured in hundreds of MB (a share
// of free disk space), which removes the main data-loss risk.
//
// Layout: single database `dstu-report-builder-db`, one object store `kv`
// (out-of-line keys). Each entry is stored under a string key:
//   'documents' | 'titleTemplates' | 'titleDataTemplates' | 'activeDocumentId' | 'meta'

const DB_NAME = 'dstu-report-builder-db'
const DB_VERSION = 1
const STORE_NAME = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

export function isIndexedDBSupported(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  if (!isIndexedDBSupported()) {
    return Promise.reject(new Error('IndexedDB is not available in this browser'))
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      let req: IDBOpenDBRequest
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION)
      } catch (e) {
        dbPromise = null
        reject(e instanceof Error ? e : new Error('Failed to open IndexedDB'))
        return
      }
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        dbPromise = null
        reject(req.error ?? new Error('Failed to open IndexedDB'))
      }
      req.onblocked = () => {
        // Another tab holds an old version open; keep the promise pending —
        // the caller (storage.ts) treats a hang via its own fallback path.
      }
    })
  }
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let req: IDBRequest<T>
        try {
          const tx = db.transaction(STORE_NAME, mode)
          req = fn(tx.objectStore(STORE_NAME))
        } catch (e) {
          reject(e instanceof Error ? e : new Error('IndexedDB transaction failed'))
          return
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
      }),
  )
}

export const idb = {
  supported: isIndexedDBSupported,

  get<T>(key: string): Promise<T | undefined> {
    return run<unknown>('readonly', (s) => s.get(key)).then(
      (v) => (v === undefined ? undefined : (v as T)),
    )
  },

  set(key: string, value: unknown): Promise<void> {
    return run('readwrite', (s) => s.put(value, key)).then(() => undefined)
  },

  del(key: string): Promise<void> {
    return run('readwrite', (s) => s.delete(key)).then(() => undefined)
  },
}
