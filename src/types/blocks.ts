import type { SourceEntry } from './sources'

export interface ParagraphBlock {
  id: string
  type: 'paragraph'
  text: string
  bold?: boolean
  align?: 'left' | 'center' | 'right' | 'justify'
  fontSize?: number
  fontFamily?: string
  lineSpacing?: number
  indent?: number // cm, first-line indent
  color?: string  // hex without '#'
}

// Inline text appended to the end of the previous paragraph (no new line);
// supports the same inline markers as a paragraph.
export interface TextBlock {
  id: string
  type: 'text'
  text: string
}

export interface HeadingBlock {
  id: string
  type: 'heading'
  text: string
  level: 1 | 2 | 3
  bold?: boolean
  align?: 'left' | 'center' | 'right' | 'justify'
  fontSize?: number
  fontFamily?: string
  lineSpacing?: number
  indent?: number
  color?: string
}

export interface PageBreakBlock {
  id: string
  type: 'pageBreak'
}

export interface SpacerBlock {
  id: string
  type: 'spacer'
  lines?: number // default 1
}

export interface TocBlock {
  id: string
  type: 'toc'
  title?: string // heading above the table of contents (default "Зміст")
  // Formatting applies to the "Зміст" title AND the generated entry lines
  // (entries via Word's TOC1–TOC3 paragraph styles).
  bold?: boolean
  align?: 'left' | 'center' | 'right' | 'justify'
  fontSize?: number
  fontFamily?: string
  lineSpacing?: number
  color?: string
}

export interface ListItem {
  id: string
  text: string
  children?: ListItem[]
}

export interface ListBlock {
  id: string
  type: 'list'
  ordered: boolean
  items: ListItem[]
  introText?: string
  bulletChar?: string // marker for unordered lists (default "•")
  bold?: boolean
  align?: 'left' | 'center' | 'right' | 'justify'
  fontSize?: number
  fontFamily?: string
  lineSpacing?: number
  color?: string
}

export interface CodeBlock {
  id: string
  type: 'code'
  caption: string
  code: string
  language: string
  label?: string // cross-reference key: {ref:label} in text → this object's number
  referenceText?: string
  inlineReference?: boolean // append referenceText to the previous paragraph
  fontSize?: number     // default 12
  lineSpacing?: number  // default 1.0
  fontFamily?: string   // default "Courier New"
  bold?: boolean
  color?: string
  noTrailingSpace?: boolean
  spaceAfterReference?: number // empty lines after the reference paragraph (default 1)
  /** @deprecated renamed to spaceAfterReference — kept for old saved docs */
  spaceAfterCaption?: number
}

export interface ImageBlock {
  id: string
  type: 'image'
  src: string
  caption: string
  label?: string // cross-reference key: {ref:label} in text → this object's number
  referenceText?: string
  inlineReference?: boolean
  noTrailingSpace?: boolean
  width?: number   // px; height scales proportionally if unset
  height?: number  // px
  naturalWidth?: number  // px, measured from the uploaded file (for ratio)
  naturalHeight?: number // px, measured from the uploaded file (for ratio)
  keepRatio?: boolean    // auto-keep width/height proportional (default true)
  // Caption formatting.
  bold?: boolean
  align?: 'left' | 'center' | 'right' | 'justify'
  fontSize?: number
  fontFamily?: string
  lineSpacing?: number
  color?: string
  spaceAfterReference?: number // empty lines after the reference paragraph (default 1)
  /** @deprecated renamed to spaceAfterReference — kept for old saved docs */
  spaceAfterCaption?: number
}

export interface TableCell {
  text: string
  isHeader?: boolean
  colspan?: number
  rowspan?: number
}

export interface TableRow {
  id: string
  cells: TableCell[]
  splitBefore?: boolean // start a manual "continuation table" before this row
}

export interface TableBlock {
  id: string
  type: 'table'
  caption: string
  headers: string[]
  rows: TableRow[]
  label?: string // cross-reference key: {ref:label} in text → this object's number
  referenceText?: string
  inlineReference?: boolean
  fontSize?: number     // default 12
  lineSpacing?: number  // default 1.0
  fontFamily?: string
  bold?: boolean        // data cells (headers are always bold)
  align?: 'left' | 'center' | 'right' | 'justify' // data-cell alignment
  color?: string
  fullWidth?: boolean       // stretch to content width (default true)
  columnWidths?: number[]   // relative width per column in %; empty = equal
  noTrailingSpace?: boolean
  spaceAfterReference?: number // empty lines after the reference paragraph (default 1)
  /** @deprecated renamed to spaceAfterReference — kept for old saved docs */
  spaceAfterCaption?: number
}

export interface FormulaBlock {
  id: string
  type: 'formula'
  latex: string
  caption?: string
  label?: string // cross-reference key: {ref:label} in text → this object's number
  referenceText?: string
  inlineReference?: boolean
  numbered?: boolean        // equation number on the right (default true)
  noTrailingSpace?: boolean
  // Caption / reference-text formatting (not the formula image itself).
  bold?: boolean
  align?: 'left' | 'center' | 'right' | 'justify'
  fontSize?: number
  fontFamily?: string
  lineSpacing?: number
  color?: string
  spaceAfterReference?: number // empty lines after the reference paragraph (default 1)
  /** @deprecated renamed to spaceAfterReference — kept for old saved docs */
  spaceAfterCaption?: number
}

export interface SourcesBlock {
  id: string
  type: 'sources'
  title?: string // heading above the list (default "Список використаних джерел")
  entries: SourceEntry[]
  // 'list' (default): numbered as entered; 'citation': in order of the first
  // {cite:…} in the text (uncited entries go last, in list order).
  order?: 'list' | 'citation'
  bold?: boolean
  align?: 'left' | 'center' | 'right' | 'justify'
  fontSize?: number
  fontFamily?: string
  lineSpacing?: number
  color?: string
}

export interface DocColumn {
  id: string
  width: number         // relative width in % (columns should sum ~100)
  blocks: ReportBlock[]
}

export interface ColumnsBlock {
  id: string
  type: 'columns'
  columns: DocColumn[]
}

// Transparent organizational container (one level deep: groups cannot contain
// groups). The title is editor-only — .docx export renders just the children.
export interface GroupBlock {
  id: string
  type: 'group'
  title: string
  collapsed?: boolean // default false (open)
  blocks: ReportBlock[]
}

// Starts appendix А, Б, … on a new page. Everything after it (until the next
// appendix) belongs to it: figures/tables/formulas are numbered А.1, А.2, …
export interface AppendixBlock {
  id: string
  type: 'appendix'
  title: string
  label?: string // {ref:label} in text → the appendix letter
}

// ДСТУ 3008:2015: Ukrainian capitals except Ґ, Є, З, І, Ї, Й, О, Ч, Ь.
export const APPENDIX_LETTERS = [
  'А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'И', 'К', 'Л', 'М', 'Н',
  'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ш', 'Щ', 'Ю', 'Я',
]

/** Letter of the n-th appendix (0-based); past Я continues as А1, Б1, … */
export function appendixLetter(index: number): string {
  const n = APPENDIX_LETTERS.length
  const round = Math.floor(index / n)
  return APPENDIX_LETTERS[index % n]! + (round > 0 ? String(round) : '')
}

export type ReportBlock =
  | ParagraphBlock
  | TextBlock
  | HeadingBlock
  | ListBlock
  | CodeBlock
  | ImageBlock
  | TableBlock
  | FormulaBlock
  | PageBreakBlock
  | SpacerBlock
  | TocBlock
  | SourcesBlock
  | ColumnsBlock
  | GroupBlock
  | AppendixBlock
