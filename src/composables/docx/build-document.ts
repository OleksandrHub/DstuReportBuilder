import {
  Document,
  Header,
  Footer,
  Packer,
  PageBreak,
  Paragraph,
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
  const hasTitle = titleChildren.length > 0
  // Title page shows startPage; the first body page is the next one (continuous).
  const bodyFirstPage = hasTitle ? startPage + 1 : startPage
  // Each header/footer's PAGE field caches the number of the page it first appears on.
  const titleHeader = s.differentFirstPage ? new Header({ children: [] }) : buildHeader(s.header, startPage)
  const titleFooter = s.differentFirstPage ? new Footer({ children: [] }) : buildFooter(s.footer, startPage)
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

  // Title and body share one section, separated by a plain (visible) page
  // break. The title page gets its own header/footer via "different first page".
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
          titlePage: hasTitle,
          page: {
            margin: pageMargin,
            pageNumbers: { start: startPage },
          },
        },
        headers: hasTitle
          ? { default: bodyHeader, first: titleHeader }
          : bodyHeader ? { default: bodyHeader } : undefined,
        footers: hasTitle
          ? { default: bodyFooter, first: titleFooter }
          : bodyFooter ? { default: bodyFooter } : undefined,
        children: hasTitle
          ? [...titleChildren, new Paragraph({ children: [new PageBreak()] }), ...bodyChildren]
          : [...bodyChildren],
      },
    ],
  })

  return Packer.toBlob(docxDoc)
}
