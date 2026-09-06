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
  referenceText?: string
  inlineReference?: boolean // append referenceText to the previous paragraph
  fontSize?: number     // default 12
  lineSpacing?: number  // default 1.0
  fontFamily?: string   // default "Courier New"
  bold?: boolean
  color?: string
  noTrailingSpace?: boolean
  spaceAfterCaption?: number // empty lines after caption (default 1)
}

export interface ImageBlock {
  id: string
  type: 'image'
  src: string
  caption: string
  referenceText?: string
  inlineReference?: boolean
  noTrailingSpace?: boolean
  width?: number   // px; height scales proportionally if unset
  height?: number  // px
  // Caption formatting.
  bold?: boolean
  align?: 'left' | 'center' | 'right' | 'justify'
  fontSize?: number
  fontFamily?: string
  lineSpacing?: number
  color?: string
  spaceAfterCaption?: number // empty lines after caption (default 1)
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
  spaceAfterCaption?: number // empty lines after caption (default 1)
}

export interface FormulaBlock {
  id: string
  type: 'formula'
  latex: string
  caption?: string
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
  spaceAfterCaption?: number // empty lines after caption (default 1)
}

export interface SourcesBlock {
  id: string
  type: 'sources'
  title?: string // heading above the list (default "Список використаних джерел")
  entries: SourceEntry[]
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
