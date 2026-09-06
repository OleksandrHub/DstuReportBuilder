# Architecture

A single-page Vue 3 app. The user edits a `ReportDocument` (a tree of typed
blocks); the document is rendered to `.docx` on export and for the live preview.
Everything is client-side — no backend.

## Data flow

```
IndexedDB ──load+migrate──▶ Pinia store ──▶ editor components (edit blocks)
    ▲ (async, 500 ms debounce)  │
    │                           ▼
    └──────────── save ◀── useDocxExport(doc) ──▶ docx Blob ──▶ download
                                    │
                                    └──(preview=true)──▶ Blob ──▶ SuperDoc preview
```

The store loads asynchronously (`ready` flag gates the UI) and auto-saves to
**IndexedDB** (quota: hundreds of MB) with a 500 ms debounce after each change
batch. Legacy `localStorage` payloads are migrated into IndexedDB on first load
and then deleted to free the ~5 MB quota; `localStorage` remains only as a
fallback when IndexedDB is unavailable. See `stores/db.ts` (promise wrapper),
`stores/storage.ts` (`loadState`/`saveState`), and the `ready`/`storageBackend`/
`storageError` fields on the report store.

## Module layout

### `src/types/` — the document model
`document.ts` is a **barrel** that re-exports the model; import from there.

| Module | Contents |
|--------|----------|
| `blocks.ts` | All block interfaces + the `ReportBlock` discriminated union. |
| `document-settings.ts` | `DocumentSettings`, header/footer, numbering schemes. |
| `title.ts` | `TitlePageData`, title-layout blocks, templates, `resolveTitleVars`. |
| `sources.ts` | `SourceEntry` + `formatSourceDSTU()` (ДСТУ 8302:2015 formatter). |
| `markdown.ts` | `parseMarkdownTable()` (paste a Markdown table into a table block). |
| `defaults.ts` | `ReportDocument`, `DEFAULT_*` constants, storage keys. |

### `src/stores/` — state + persistence
| Module | Contents |
|--------|----------|
| `report.ts` | The Pinia store: reactive state + all actions (document/block/title CRUD). Async init (`ready` flag); debounced persist. |
| `factories.ts` | Pure factories: `generateId`, `createDocument`, `emptySourceEntry`. |
| `db.ts` | Minimal promise-based IndexedDB key-value wrapper (no deps). |
| `storage.ts` | Async `loadState`/`saveState`: IndexedDB-first, one-time migration from legacy `localStorage` keys, localStorage fallback. |
| `migrations.ts` | `migrateDocuments()` — backfills new fields on old saved docs. |
| `block-utils.ts` | Pure block helpers: `cloneBlockWithNewIds`, `findListItem`. |

### `src/composables/docx/` — the `.docx` generator
`useDocxExport.ts` is a thin composable over `docx/build-document.ts`.

| Module | Contents |
|--------|----------|
| `build-document.ts` | `buildDocxBlob()` — assembles sections, pre-renders formulas, packs the Blob. |
| `blocks.ts` | `buildBlock()` — the per-block-type renderer (the core dispatcher). |
| `title-page.ts` | `buildTitlePage()` — renders the title layout (calls `buildBlock`). |
| `text-runs.ts` | Inline markup parser (`**bold**`, `{#RGB|…}`, etc.) → docx runs. |
| `paragraphs.ts` | Paragraph/caption builders + alignment maps. |
| `counters.ts` | Figure/table/listing/formula numbering (`plain`/`perSection`/`sectioned`). |
| `latex-math.ts` | LaTeX → OMML fallback parser (used only if KaTeX PNG fails). |
| `formula.ts` | Formula paragraph (KaTeX PNG, OMML fallback, numbering). |
| `header-footer.ts` | Header/footer builders with cached PAGE fields. |
| `units.ts` | cm→twip, pt→half-pt, data-URL→bytes. |

### `src/components/` & `src/views/`
- `views/HomeView.vue` — the main editor + live preview pane.
- `components/blocks/` — one editor component per block type, plus the shared
  `BlockStyleRow.vue` (font/size/bold/align/colour/indent controls).
- `components/editor/` — title page, title-template, and settings editors.

## Gotchas

- **`disablePiniaDevtools` must stay `false`** in `HomeView.vue`. SuperDoc 1.41's
  devtools-suppression path mis-iterates `__VUE_DEVTOOLS_PLUGINS__` and throws
  `object is not iterable`, crashing the preview in production builds only.
- **TOC in preview**: SuperDoc can't render a Word TOC field, so in preview mode
  the TOC block emits a placeholder line instead (see `buildBlock`'s `toc` case).
- **Formulas** export as PNG (KaTeX), not OMML, for cross-editor compatibility.
- **Schema changes**: when adding a field to a block/settings type, add a
  backfill in `stores/migrations.ts` so existing saved documents keep working.
