import type {
  ReportDocument,
  ReportBlock,
  TitleSpacerBlock,
} from '../types/document'
import { DEFAULT_TITLE_TEMPLATE, DEFAULT_HEADING_STYLES, DEFAULT_BODY_TEXT } from '../types/document'
import { generateId, deepCloneTitleBlocks } from './factories'

// Run all schema migrations over freshly-loaded documents, mutating them in place.
export function migrateDocuments(rawDocs: ReportDocument[]): void {
  // Migrate: add titleTemplate to old documents that don't have it
  for (const doc of rawDocs) {
    if (!doc.titleTemplate) {
      doc.titleTemplate = deepCloneTitleBlocks(DEFAULT_TITLE_TEMPLATE)
    } else {
      for (const block of doc.titleTemplate) {
        if (block.type === 'titleLine') {
          if (block.paddingLeft === undefined) block.paddingLeft = 0
          if (block.paddingRight === undefined) block.paddingRight = 0
        }
        if (block.type === 'titleSpacer') {
          const b = block as TitleSpacerBlock & { flex?: number; heightCm?: number }
          if (b.lines === undefined) {
            // migrate old flex or heightCm → lines (1 line ≈ 0.74cm at 14pt×1.5)
            b.lines = b.flex ?? (Math.round((b.heightCm ?? 2) / 0.74) || 1)
          }
          delete b.flex
          delete b.heightCm
        }
      }
    }
  }

  // Migrate: add header/footer settings to old documents
  for (const doc of rawDocs) {
    if (doc.settings && !doc.settings.header) {
      doc.settings.header = { mode: 'none', text: '', align: 'right', fontSize: 12, fontFamily: doc.settings.fontFamily || 'Times New Roman' }
    }
    if (doc.settings && !doc.settings.footer) {
      doc.settings.footer = { mode: 'pageNumber', text: '', align: 'right', fontSize: 12, fontFamily: doc.settings.fontFamily || 'Times New Roman' }
    }
    if (doc.settings && doc.settings.differentFirstPage === undefined) {
      doc.settings.differentFirstPage = true
    }
    if (doc.settings && doc.settings.pageNumberStart === undefined) {
      doc.settings.pageNumberStart = 1
    }
    if (doc.settings && !doc.settings.numbering) {
      // migrate old single numberingScheme → per-type, default 'plain'
      const old = (doc.settings as { numberingScheme?: 'plain' | 'perSection' | 'sectioned' }).numberingScheme ?? 'plain'
      doc.settings.numbering = { image: old, table: old, code: old, formula: old }
    }
    if (doc.settings && doc.settings.formulaPrefix === undefined) {
      doc.settings.formulaPrefix = 'Формула'
    }
    // Migrate: add global heading/body text styles to old documents.
    // bodyText inherits the doc's own base values so appearance is unchanged.
    if (doc.settings && !doc.settings.headingStyles) {
      doc.settings.headingStyles = JSON.parse(JSON.stringify(DEFAULT_HEADING_STYLES))
    } else if (doc.settings?.headingStyles) {
      for (const lvl of [1, 2, 3] as const) {
        if (!doc.settings.headingStyles[lvl]) {
          doc.settings.headingStyles[lvl] = { ...DEFAULT_HEADING_STYLES[lvl] }
        }
      }
    }
    if (doc.settings && !doc.settings.bodyText) {
      doc.settings.bodyText = {
        fontFamily: '',
        fontSize: doc.settings.fontSize ?? DEFAULT_BODY_TEXT.fontSize,
        color: '000000',
        bold: false,
        align: 'justify',
        lineSpacing: doc.settings.lineSpacing ?? DEFAULT_BODY_TEXT.lineSpacing,
        indent: doc.settings.paragraphIndent ?? DEFAULT_BODY_TEXT.indent,
      }
    }
  }

  // Migrate: append {no} placeholder to legacy referenceText (so number isn't auto-doubled)
  for (const doc of rawDocs) {
    if (!doc.blocks) continue
    for (const b of doc.blocks) {
      if ((b.type === 'code' || b.type === 'image' || b.type === 'table') && b.referenceText && !b.referenceText.includes('{no}')) {
        const t = b.referenceText.trim()
        if (b.type === 'table') {
          // old table format auto-wrapped "У таблиці N <text>." — convert to explicit sentence
          b.referenceText = `У таблиці {no} ${t.toLowerCase()}.`
        } else {
          b.referenceText = `${t.replace(/\.$/, '')} {no}.`
        }
      }
    }
  }

  // Migrate: convert old intro field into paragraph blocks prepended to blocks[]
  for (const doc of rawDocs) {
    const d = doc as ReportDocument & { intro?: { topic?: string; goal?: string; variant?: string } }
    if (d.intro) {
      const introBlocks: ReportBlock[] = []
      if (d.intro.topic) introBlocks.push({ id: generateId(), type: 'paragraph', text: `Тема: ${d.intro.topic}.` })
      if (d.intro.goal) introBlocks.push({ id: generateId(), type: 'paragraph', text: `Мета: ${d.intro.goal}.` })
      if (d.intro.variant) introBlocks.push({ id: generateId(), type: 'paragraph', text: `Варіант №${d.intro.variant}` })
      introBlocks.push({ id: generateId(), type: 'paragraph', text: 'Виконання роботи:' })
      doc.blocks = [...introBlocks, ...doc.blocks]
      delete d.intro
    }
  }
}
