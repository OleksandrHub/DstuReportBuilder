import {
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  PageBreak,
  Bookmark,
  TableOfContents,
} from 'docx'
import type { ReportDocument, ReportBlock, ListItem, TableRow as DocTableRow } from '../../types/document'
import { formatSourceDSTU, resolveHeadingStyle, resolveBodyStyle } from '../../types/document'
import type { FormulaImage } from '../useFormulaImage'
import { cmToTwip, ptToHalfPt } from './units'
import { baseRun, inlineRuns } from './text-runs'
import { bodyParagraph, emptyParagraph, captionParagraph, ALIGN4_MAP } from './paragraphs'
import type { Counters } from './counters'
import { resolveReference, tocBookmarkId } from './counters'
import { buildFormulaParagraph } from './formula'
import type { FontConfig } from './text-runs'

export type BodyEl = Paragraph | Table | TableOfContents

export function buildBlock(
  block: ReportBlock,
  doc: ReportDocument,
  cfg: FontConfig,
  counters: Counters,
  previewMode: boolean,
  out: { inlineRef?: string } = {},
  formulaImages: Map<string, FormulaImage> = new Map(),
): BodyEl[] {
  const s = doc.settings

  if (block.type === 'paragraph') {
    // Base = global body style; per-block fields override when set.
    const g = resolveBodyStyle(s)
    const pCfg = {
      ...cfg,
      name: g.fontFamily,
      size: ptToHalfPt(g.fontSize),
      lineSpacing: g.lineSpacing,
      paragraphIndent: g.indent,
      color: g.color || undefined,
    }
    if (block.fontSize) pCfg.size = ptToHalfPt(block.fontSize)
    if (block.fontFamily) pCfg.name = block.fontFamily
    if (block.lineSpacing !== undefined) pCfg.lineSpacing = block.lineSpacing
    if (block.indent !== undefined) pCfg.paragraphIndent = block.indent
    if (block.color) pCfg.color = block.color

    const effAlign = block.align ?? g.align
    const alignment = ALIGN4_MAP[effAlign] ?? AlignmentType.JUSTIFIED
    const noIndent = effAlign === 'center' || effAlign === 'right'

    return [bodyParagraph(inlineRuns(block.text, pCfg, block.bold ?? g.bold), pCfg, noIndent, alignment)]
  }

  if (block.type === 'heading') {
    // H2 starts a new chapter (only matters for the 'sectioned' scheme).
    if (block.level === 2) counters.bumpChapter()
    const levelMap: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
    }
    // Base = global H1/H2/H3 style; per-block fields override when set.
    const g = resolveHeadingStyle(s, block.level)
    const hCfg = {
      ...cfg,
      name: g.fontFamily,
      size: ptToHalfPt(g.fontSize),
      lineSpacing: g.lineSpacing,
      paragraphIndent: g.indent,
      color: g.color || undefined,
    }
    if (block.fontSize) hCfg.size = ptToHalfPt(block.fontSize)
    if (block.fontFamily) hCfg.name = block.fontFamily
    if (block.lineSpacing !== undefined) hCfg.lineSpacing = block.lineSpacing
    if (block.indent !== undefined) hCfg.paragraphIndent = block.indent
    if (block.color) hCfg.color = block.color

    const effAlign = block.align ?? g.align
    const hAlign = ALIGN4_MAP[effAlign] ?? AlignmentType.CENTER
    const hBold = block.bold ?? g.bold
    // First-line indent is meaningless for centered/right headings — skip it
    // there (same convention as body paragraphs above).
    const effIndent = block.indent ?? g.indent
    const hIndent = effAlign === 'center' || effAlign === 'right'
      ? undefined
      : { firstLine: cmToTwip(effIndent) }

    return [
      new Paragraph({
        // Bookmark the heading so the manual TOC can PAGEREF it.
        children: [
          new Bookmark({ id: tocBookmarkId(block.id), children: inlineRuns(block.text, hCfg, hBold) }),
        ],
        heading: levelMap[block.level],
        alignment: hAlign,
        spacing: { line: Math.round(hCfg.lineSpacing * 240), lineRule: 'auto' as never },
        indent: hIndent,
      }),
    ]
  }

  if (block.type === 'pageBreak') {
    return [new Paragraph({ children: [new PageBreak()] })]
  }

  if (block.type === 'toc') {
    const title = block.title ?? 'Зміст'
    // Per-block formatting overrides (apply to the "Зміст" title line).
    const tCfg = { ...cfg }
    if (block.fontSize) tCfg.size = ptToHalfPt(block.fontSize)
    if (block.fontFamily) tCfg.name = block.fontFamily
    if (block.lineSpacing !== undefined) tCfg.lineSpacing = block.lineSpacing
    if (block.color) tCfg.color = block.color
    const tBold = block.bold ?? false
    const tAlign = ALIGN4_MAP[block.align ?? 'center'] ?? AlignmentType.CENTER

    const titlePara = new Paragraph({
      children: inlineRuns(title, tCfg, tBold),
      alignment: tAlign,
      spacing: { line: Math.round(tCfg.lineSpacing * 240), lineRule: 'auto' as never },
    })
    // The in-app preview (SuperDoc) can't render a TOC field — show a hint line
    // instead of the field, which otherwise throws while parsing.
    if (previewMode) {
      return [
        titlePara,
        bodyParagraph([baseRun('(Зміст оновиться автоматично у Word / OnlyOffice)', cfg, false, true)], cfg, true),
      ]
    }
    // A real Word table-of-contents field, built from the Heading 1–3 styles.
    // Word/OnlyOffice populate and paginate it themselves (updateFields on open,
    // or Ctrl+A → F9). This is the standard mechanism, identical to Insert → TOC.
    return [
      titlePara,
      new TableOfContents(title, {
        hyperlink: true,
        headingStyleRange: '1-3',
        captionLabel: undefined,
      }),
    ]
  }

  if (block.type === 'spacer') {
    const n = Math.max(1, block.lines ?? 1)
    return Array.from({ length: n }, () => emptyParagraph(cfg))
  }

  if (block.type === 'sources') {
    const result: BodyEl[] = []
    const title = block.title ?? 'Список використаних джерел'
    // Per-block formatting overrides (apply to the heading AND every entry).
    const srcCfg = { ...cfg }
    if (block.fontSize) srcCfg.size = ptToHalfPt(block.fontSize)
    if (block.fontFamily) srcCfg.name = block.fontFamily
    if (block.lineSpacing !== undefined) srcCfg.lineSpacing = block.lineSpacing
    if (block.color) srcCfg.color = block.color
    const entryAlign = ALIGN4_MAP[block.align ?? 'justify'] ?? AlignmentType.JUSTIFIED
    const entryBold = block.bold ?? false

    result.push(new Paragraph({
      children: inlineRuns(title, srcCfg, true),
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { line: Math.round(srcCfg.lineSpacing * 240), lineRule: 'auto' as never },
    }))
    // Empty line between the heading and the first source.
    result.push(emptyParagraph(srcCfg))
    block.entries.forEach((e, i) => {
      const text = formatSourceDSTU(e)
      result.push(new Paragraph({
        children: [baseRun(`${i + 1}. ${text}`, srcCfg, entryBold)],
        alignment: entryAlign,
        spacing: { line: Math.round(srcCfg.lineSpacing * 240), lineRule: 'auto' as never },
        // First line (with the number) at the paragraph indent; wrapped lines at 0.
        indent: { left: 0, firstLine: cmToTwip(cfg.paragraphIndent) },
      }))
    })
    return result
  }

  if (block.type === 'columns') {
    const contentTwips = cmToTwip(21 - s.marginLeft - s.marginRight)
    const cols = block.columns
    const total = cols.reduce((a, c) => a + (c.width || 0), 0) || cols.length
    const colTwips = cols.map(c => Math.round(contentTwips * (c.width || 100 / cols.length) / total))
    const noBorder = {
      top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 },
      left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 },
    }
    // Render each column's nested blocks; only paragraph-like children are kept
    // (tables/TOC inside a column cell aren't supported).
    const row = new TableRow({
      children: cols.map((col, i) => new TableCell({
        width: { size: colTwips[i] ?? 0, type: WidthType.DXA },
        borders: noBorder,
        children: col.blocks.flatMap(inner => {
          const els = buildBlock(inner, doc, cfg, counters, previewMode)
          return els.filter((el): el is Paragraph => el instanceof Paragraph)
        }),
      })),
    })
    return [new Table({ rows: [row], width: { size: contentTwips, type: WidthType.DXA }, columnWidths: colTwips, borders: { ...noBorder, insideHorizontal: { style: BorderStyle.NONE, size: 0 }, insideVertical: { style: BorderStyle.NONE, size: 0 } } })]
  }

  if (block.type === 'formula') {
    const num = counters.next('formula')
    const result: BodyEl[] = []

    // Caption / reference text formatting overrides (the formula image is
    // rendered separately and unaffected by these).
    const fCfg = { ...cfg }
    if (block.fontSize) fCfg.size = ptToHalfPt(block.fontSize)
    if (block.fontFamily) fCfg.name = block.fontFamily
    if (block.lineSpacing !== undefined) fCfg.lineSpacing = block.lineSpacing
    if (block.color) fCfg.color = block.color
    const fAlign = ALIGN4_MAP[block.align ?? 'left'] ?? AlignmentType.LEFT
    const fBold = block.bold ?? false

    const refText = resolveReference(block.referenceText, s.formulaPrefix, num)
    if (refText) {
      if (block.inlineReference) {
        out.inlineRef = refText
      } else {
        result.push(bodyParagraph(inlineRuns(refText, fCfg, fBold), fCfg))
      }
    }

    const numbered = block.numbered !== false
    const contentTwips = cmToTwip(21 - s.marginLeft - s.marginRight)
    const img = formulaImages.get(block.id)
    result.push(buildFormulaParagraph(block.latex, cfg, numbered, num, contentTwips, img))

    if (block.caption) {
      result.push(captionParagraph(`${s.formulaPrefix} ${num} – ${block.caption}`, fCfg, fAlign))
    }
    if (!block.noTrailingSpace) result.push(emptyParagraph(cfg))

    return result
  }

  if (block.type === 'list') {
    const result: Paragraph[] = []

    // Per-block formatting overrides (apply to the intro line and every item).
    const lCfg = { ...cfg }
    if (block.fontSize) lCfg.size = ptToHalfPt(block.fontSize)
    if (block.fontFamily) lCfg.name = block.fontFamily
    if (block.lineSpacing !== undefined) lCfg.lineSpacing = block.lineSpacing
    if (block.color) lCfg.color = block.color
    const lAlign = ALIGN4_MAP[block.align ?? 'justify'] ?? AlignmentType.JUSTIFIED
    const lBold = block.bold ?? false
    // Custom bullet for unordered lists (top level); nested levels use a hollow
    // bullet to keep the hierarchy readable.
    const bullet = (block.bulletChar && block.bulletChar.trim()) || '•'

    if (block.introText) {
      result.push(bodyParagraph(inlineRuns(block.introText, lCfg, lBold), lCfg))
    }

    // Render items recursively; sub-lists are indented one level deeper.
    // The text is emitted exactly as typed — only the marker (N. / bullet) is added.
    const renderItems = (items: ListItem[], ordered: boolean, level: number) => {
      items.forEach((item, idx) => {
        const text = item.text.trim()
        // The item's first line (with the marker) starts at the paragraph indent
        // (1.25 cm for the top level); wrapped lines fall back to 0 (left edge).
        // Nested levels add 0.75 cm of left indent per level for the whole block.
        const levelIndent = cmToTwip(0.75 * level)
        const firstLineIndent = cmToTwip(cfg.paragraphIndent)
        if (text) {
          const marker = ordered ? `${idx + 1}. ` : `${level === 0 ? bullet : '◦'} `
          result.push(new Paragraph({
            children: inlineRuns(`${marker}${text}`, lCfg, lBold),
            alignment: lAlign,
            spacing: { line: Math.round(lCfg.lineSpacing * 240), lineRule: 'auto' as never },
            indent: { left: levelIndent, firstLine: firstLineIndent },
          }))
        }
        // Sub-list (always bullet style for readability).
        if (item.children && item.children.length) {
          renderItems(item.children, false, level + 1)
        }
      })
    }
    renderItems(block.items, block.ordered, 0)

    return result
  }

  if (block.type === 'code') {
    const num = counters.next('code')
    const result: BodyEl[] = []
    const codeSize = ptToHalfPt(block.fontSize ?? 12)
    const codeSpacing = block.lineSpacing ?? 1.0

    const refText = resolveReference(block.referenceText, s.listingPrefix, num)

    if (refText) {
      if (block.inlineReference) {
        out.inlineRef = refText
      } else {
        result.push(bodyParagraph(inlineRuns(refText, cfg), cfg))
      }
    }
    result.push(emptyParagraph(cfg))
    result.push(captionParagraph(`${s.listingPrefix} ${num} – ${block.caption}`, cfg))
    result.push(
      new Paragraph({
        children: [new TextRun({
          text: block.code,
          font: block.fontFamily || 'Courier New',
          size: codeSize,
          bold: block.bold,
          color: block.color,
        })],
        spacing: { line: Math.round(codeSpacing * 240), lineRule: 'auto' as never },
      })
    )
    if (!block.noTrailingSpace) result.push(emptyParagraph(cfg))

    return result
  }

  if (block.type === 'image') {
    const num = counters.next('image')
    const result: BodyEl[] = []

    const refText = resolveReference(block.referenceText, s.imagePrefix, num)

    if (refText) {
      if (block.inlineReference) {
        out.inlineRef = refText
      } else {
        result.push(bodyParagraph(inlineRuns(refText, cfg), cfg))
      }
    }
    result.push(emptyParagraph(cfg))

    if (block.src && block.src.startsWith('data:')) {
      try {
        const base64 = block.src.split(',')[1] ?? ''
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

        const w = block.width && block.width > 0 ? block.width : 400
        const h = block.height && block.height > 0 ? block.height : Math.round(w * 0.75)
        result.push(
          new Paragraph({
            children: [new ImageRun({ data: bytes, transformation: { width: w, height: h }, type: 'png' })],
            alignment: AlignmentType.CENTER,
          })
        )
      } catch {
        result.push(bodyParagraph([baseRun('[Зображення]', cfg, false, true)], cfg, true))
      }
    }

    // Caption formatting overrides.
    const capCfg = { ...cfg }
    if (block.fontSize) capCfg.size = ptToHalfPt(block.fontSize)
    if (block.fontFamily) capCfg.name = block.fontFamily
    if (block.lineSpacing !== undefined) capCfg.lineSpacing = block.lineSpacing
    if (block.color) capCfg.color = block.color
    result.push(
      new Paragraph({
        children: inlineRuns(`${s.imagePrefix} ${num} – ${block.caption}`, capCfg, block.bold ?? false),
        alignment: ALIGN4_MAP[block.align ?? 'center'] ?? AlignmentType.CENTER,
        spacing: { line: Math.round(capCfg.lineSpacing * 240), lineRule: 'auto' as never },
      })
    )
    if (!block.noTrailingSpace) result.push(emptyParagraph(cfg))

    return result
  }

  if (block.type === 'table') {
    const num = counters.next('table')
    const result: BodyEl[] = []
    const tblSize = ptToHalfPt(block.fontSize ?? 12)
    const tblSpacing = block.lineSpacing ?? 1.0
    const tCfg = { ...cfg, size: tblSize, lineSpacing: tblSpacing }
    if (block.fontFamily) tCfg.name = block.fontFamily
    if (block.color) tCfg.color = block.color
    const cellBold = block.bold ?? false
    const cellAlign = ALIGN4_MAP[block.align ?? 'left'] ?? AlignmentType.LEFT
    const ROWS_PER_PAGE = 20 // split threshold

    const refText = block.referenceText
      ? (block.referenceText.includes('{no}')
          ? block.referenceText.replace(/\{no\}/g, num)
          : `У ${s.tablePrefix.toLowerCase()} ${num} ${block.referenceText.toLowerCase()}.`)
      : ''

    if (refText) {
      if (block.inlineReference) {
        out.inlineRef = refText
      } else {
        result.push(bodyParagraph(inlineRuns(refText, cfg), cfg))
      }
    }
    result.push(emptyParagraph(cfg))

    const makeBorder = () => ({
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    })

    // Content width (twips) available for the table = page width − L/R margins.
    const A4_WIDTH_CM = 21
    const contentTwips = cmToTwip(A4_WIDTH_CM - s.marginLeft - s.marginRight)
    const colCount = block.headers.length

    // Per-column width in twips. Use explicit columnWidths (% → twips) when valid,
    // otherwise distribute evenly.
    const widths = block.columnWidths
    const hasWidths = Array.isArray(widths) && widths.length === colCount && widths.some(w => w > 0)
    const colTwips: number[] = []
    for (let i = 0; i < colCount; i++) {
      const pct = hasWidths ? (widths![i] || 0) : 100 / colCount
      colTwips.push(Math.round(contentTwips * pct / 100))
    }

    const cellWidth = (i: number) => ({ size: colTwips[i] ?? 0, type: WidthType.DXA })

    const makeHeaderRow = () => new TableRow({
      children: block.headers.map((h, i) =>
        new TableCell({
          children: [new Paragraph({ children: inlineRuns(h, tCfg, true), alignment: AlignmentType.CENTER, spacing: { line: Math.round(tblSpacing * 240), lineRule: 'auto' as never } })],
          borders: makeBorder(),
          width: cellWidth(i),
        })
      ),
      tableHeader: true,
    })

    const makeDataRow = (row: DocTableRow) => new TableRow({
      children: row.cells.map((cell, i) =>
        new TableCell({
          children: [new Paragraph({ children: inlineRuns(cell.text, tCfg, cellBold), alignment: cellAlign, spacing: { line: Math.round(tblSpacing * 240), lineRule: 'auto' as never } })],
          borders: makeBorder(),
          width: cellWidth(i),
        })
      ),
    })

    // fullWidth (default true) stretches to content width; otherwise auto-fit.
    const fullWidth = block.fullWidth !== false
    const tableWidth = fullWidth
      ? { size: contentTwips, type: WidthType.DXA }
      : { size: 0, type: WidthType.AUTO }

    // First split at manual breakpoints (rows flagged with splitBefore),
    // then split each manual segment further if it exceeds the auto threshold.
    const manualSegments: DocTableRow[][] = []
    let current: DocTableRow[] = []
    for (const row of block.rows) {
      if (row.splitBefore && current.length > 0) {
        manualSegments.push(current)
        current = []
      }
      current.push(row)
    }
    if (current.length > 0) manualSegments.push(current)

    const chunks: DocTableRow[][] = []
    for (const seg of manualSegments) {
      for (let i = 0; i < seg.length; i += ROWS_PER_PAGE) {
        chunks.push(seg.slice(i, i + ROWS_PER_PAGE))
      }
    }

    chunks.forEach((chunk, ci) => {
      if (ci === 0) {
        result.push(captionParagraph(`${s.tablePrefix} ${num} – ${block.caption}`, cfg))
      } else {
        result.push(emptyParagraph(cfg))
        result.push(captionParagraph(`Продовження таблиці ${num} – ${block.caption}`, cfg, AlignmentType.RIGHT))
      }
      result.push(new Table({
        rows: [makeHeaderRow(), ...chunk.map(makeDataRow)],
        width: tableWidth,
        columnWidths: colTwips,
      }))
    })
    if (!block.noTrailingSpace) result.push(emptyParagraph(cfg))

    return result
  }

  return []
}
