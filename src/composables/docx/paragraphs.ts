import { Paragraph, TextRun, AlignmentType } from 'docx'
import type { FontConfig } from './text-runs'
import { inlineRuns } from './text-runs'
import { cmToTwip } from './units'

export function bodyParagraph(
  runs: TextRun[],
  cfg: FontConfig,
  noIndent = false,
  alignment: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED
): Paragraph {
  return new Paragraph({
    children: runs,
    alignment,
    spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
    indent: noIndent ? undefined : { firstLine: cmToTwip(cfg.paragraphIndent) },
  })
}

export function emptyParagraph(cfg: FontConfig): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: '', font: cfg.name, size: cfg.size })],
    spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
  })
}

export function emptyParagraphs(cfg: FontConfig, count: number): Paragraph[] {
  return Array.from({ length: Math.max(0, count) }, () => emptyParagraph(cfg))
}

// keepNext glues the caption to the object that follows it (table / listing),
// so a caption is never left alone at the bottom of a page.
export function captionParagraph(
  text: string,
  cfg: FontConfig,
  align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.LEFT,
  keepNext = false,
): Paragraph {
  // Left-aligned captions get the document's first-line indent (like body text,
  // e.g. "Таблиця 1 – ..."). Right/center captions (e.g. continuation) don't.
  const indent = align === AlignmentType.LEFT ? { firstLine: cmToTwip(cfg.paragraphIndent) } : undefined
  return new Paragraph({
    children: inlineRuns(text, cfg),
    alignment: align,
    spacing: { line: Math.round(cfg.lineSpacing * 240), lineRule: 'auto' as never },
    indent,
    keepNext,
    keepLines: true,
  })
}

export const ALIGN_MAP: Record<string, typeof AlignmentType[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
}

export const ALIGN4_MAP: Record<string, typeof AlignmentType[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
}
