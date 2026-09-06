# DSTU Report Builder

A Vue 3 web app for composing academic lab reports formatted to the Ukrainian
**ДСТУ** standards and exporting them as real `.docx` files. Built for students at
ТНТУ who want correct margins, fonts, numbering, a title page, and a
ДСТУ 8302:2015 bibliography without doing it by hand in Word.

## Features

- **Block-based editor** — paragraphs, headings, lists, code listings, images,
  tables, formulas (LaTeX), a table of contents, a bibliography, and multi-column
  layouts. Every text block exposes font / size / line-spacing / bold / alignment
  / colour overrides.
- **Title page** — a configurable layout of lines, spacers, and embedded blocks
  with `{{variable}}` substitution; reusable layout and data templates.
- **Real `.docx` export** — proper A4 margins, page numbering, a Word TOC field,
  and DSTU-compliant captions/numbering. Formulas render via KaTeX → PNG so they
  display in Word, OnlyOffice, and the in-app preview.
- **Live preview** — the generated `.docx` is rendered in-browser by SuperDoc.
- **Local persistence** — all documents and templates are saved to IndexedDB
  (legacy `localStorage` data is migrated automatically on first load);
  old documents are migrated forward on load. Uploaded images are downscaled
  on import to keep storage small.

## Getting started

```sh
npm install
npm run dev          # dev server (http://localhost:5173)
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build locally
npm run lint         # oxlint + eslint
```

Requires Node `^22.18.0 || >=24.12.0`.

## Deployment

The app is a static SPA. The production `dist/` is deployed to Cloudflare Workers
(`dstu-report-builder.sasha-klishch1.workers.dev`). Rebuild and redeploy after any
change — the live site serves the last built bundle.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the module layout and the data model.

## Tech stack

Vue 3 (`<script setup>`) · Pinia · Vue Router · [`docx`](https://docx.js.org) ·
KaTeX · SuperDoc · Vite.

## IDE setup

[VS Code](https://code.visualstudio.com/) + the
[Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
extension (disable Vetur). Type checking uses `vue-tsc` instead of `tsc` so it
understands `.vue` files.
