import {
  Document,
  Packer,
  Paragraph,
  SectionType,
} from 'docx'
import type { ReportDocument, ReportBlock } from '../../types/document'
import { renderFormulaPng, type FormulaImage } from '../useFormulaImage'
import { cmToTwip, ptToHalfPt } from './units'
import type { FontConfig } from './text-runs'
import { inlineRuns } from './text-runs'
import { bodyParagraph } from './paragraphs'
import { makeCounters } from './counters'
import { buildHeader, buildFooter } from './header-footer'
import { formulaCacheKey, getCachedFormula, setCachedFormula } from './formula-cache'
import type { BodyEl } from './blocks'
import { buildBlock } from './blocks'
import { buildTitlePage } from './title-page'

export async function buildDocxBlob(doc: ReportDocument, forPreview = false): Promise<Blob> {
  const previewMode = forPreview
  const s = doc.settings
  const cfg: FontConfig = {
    name: s.fontFamily,
    size: ptToHalfPt(s.fontSize),
    lineSpacing: s.lineSpacing,
    paragraphIndent: s.paragraphIndent,
  }

  const counters = makeCounters(s.numbering)

  // Pre-render all formulas to PNG (async). KaTeX→PNG works everywhere
  // (Word, OnlyOffice, preview), unlike OMML which OnlyOffice can't show.
  const formulaImages = new Map<string, FormulaImage>()
  const renderFormula = async (b: ReportBlock) => {
    if (b.type === 'formula' && b.latex.trim()) {
      const size = Math.round(s.fontSize * 1.6)
      const key = formulaCacheKey(b.latex, size)
      const hit = getCachedFormula(key)
      if (hit) {
        formulaImages.set(b.id, hit)
        return
      }
      const img = await renderFormulaPng(b.latex, size)
      if (img) {
        formulaImages.set(b.id, img)
        setCachedFormula(key, img)
      }
    }
  }
  for (const block of doc.blocks) await renderFormula(block)
  for (const tb of doc.titleTemplate) {
    if (tb.type === 'titleContent') await renderFormula(tb.block)
  }

  const titleChildren = buildTitlePage(doc, cfg, counters, previewMode, formulaImages)
  const bodyChildren: BodyEl[] = []

  for (const block of doc.blocks) {
    // Inline text block: append to the previous paragraph (no new line).
    if (block.type === 'text') {
      const prev = bodyChildren[bodyChildren.length - 1]
      if (prev instanceof Paragraph) {
        for (const run of inlineRuns(block.text, cfg)) prev.addChildElement(run)
      } else {
        bodyChildren.push(bodyParagraph(inlineRuns(block.text, cfg), cfg))
      }
      continue
    }

    const out: { inlineRef?: string } = {}
    const elements = buildBlock(block, doc, cfg, counters, previewMode, out, formulaImages)

    // Inline reference: append the sentence to the previous paragraph instead of
    // emitting it on its own line. Falls back to a normal line if there's no
    // previous paragraph to attach to.
    if (out.inlineRef) {
      const prev = bodyChildren[bodyChildren.length - 1]
      if (prev instanceof Paragraph) {
        for (const run of inlineRuns(` ${out.inlineRef}`, cfg)) prev.addChildElement(run)
      } else {
        bodyChildren.push(bodyParagraph(inlineRuns(out.inlineRef, cfg), cfg))
      }
    }

    bodyChildren.push(...elements)
  }

  const startPage = s.pageNumberStart ?? 1
  // Title page shows startPage; the first body page is the next one (continuous).
  const bodyFirstPage = startPage + 1
  // Each section's PAGE field caches the number of the page it first appears on.
  const titleHeader = buildHeader(s.header, startPage)
  const titleFooter = buildFooter(s.footer, startPage)
  const bodyHeader = buildHeader(s.header, bodyFirstPage)
  const bodyFooter = buildFooter(s.footer, bodyFirstPage)

  const pageMargin = {
    left: cmToTwip(s.marginLeft),
    right: cmToTwip(s.marginRight),
    top: cmToTwip(s.marginTop),
    bottom: cmToTwip(s.marginBottom),
  }

  // TOC entry styling: Word generates the entry lines and applies its built-in
  // TOC1–TOC3 paragraph styles. Redefine those styles so the user's formatting
  // (font, size, bold, line spacing, colour) carries to the generated entries.
  const tocBlock = doc.blocks.find((b): b is Extract<ReportBlock, { type: 'toc' }> => b.type === 'toc')
  const tocParagraphStyles = tocBlock
    ? [1, 2, 3].map((lvl) => ({
        id: `TOC${lvl}`,
        name: `toc ${lvl}`,
        basedOn: 'Normal',
        quickFormat: true,
        run: {
          font: tocBlock.fontFamily ?? cfg.name,
          size: tocBlock.fontSize ? ptToHalfPt(tocBlock.fontSize) : cfg.size,
          bold: tocBlock.bold ?? false,
          color: tocBlock.color,
        },
        paragraph: {
          spacing: {
            line: Math.round((tocBlock.lineSpacing ?? cfg.lineSpacing) * 240),
            lineRule: 'auto' as never,
          },
        },
      }))
    : []

  // Title page is its own section so the body starts on a fresh page WITHOUT
  // an extra empty paragraph. The body section uses nextPage to break cleanly.
  const docxDoc = new Document({
    // Ask the editor to recompute fields (TOC, page numbers) when the file opens.
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: {
            font: cfg.name,
            size: cfg.size,
          },
        },
      },
      paragraphStyles: tocParagraphStyles,
    },
    sections: [
      {
        properties: {
          page: {
            margin: pageMargin,
            // First page of the document carries the configured start number.
            pageNumbers: { start: startPage },
          },
        },
        // The title section has no header/footer when differentFirstPage is on.
        headers: titleHeader && !s.differentFirstPage ? { default: titleHeader } : undefined,
        footers: titleFooter && !s.differentFirstPage ? { default: titleFooter } : undefined,
        children: [...titleChildren],
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            // No pageNumbers.start here: numbering flows continuously from the
            // title page, so the first body page is startPage + 1.
            margin: pageMargin,
          },
        },
        headers: bodyHeader ? { default: bodyHeader } : undefined,
        footers: bodyFooter ? { default: bodyFooter } : undefined,
        children: [...bodyChildren],
      },
    ],
  })

  return Packer.toBlob(docxDoc)
}
