export type HeaderFooterMode = 'none' | 'text' | 'pageNumber' | 'textAndPage'
export type HeaderFooterAlign = 'left' | 'center' | 'right'

export interface HeaderFooterConfig {
  mode: HeaderFooterMode
  text: string          // used when mode is 'text' or 'textAndPage'
  align: HeaderFooterAlign
  fontSize: number      // pt
  fontFamily: string
}

// 'plain'      → 1, 2, 3 (continuous, ignores sections)
// 'perSection' → 1.1, 1.2, 1.3 (chapter fixed at 1, item runs continuously)
// 'sectioned'  → 1.1, 1.2 … 2.1 (H2 = chapter N, item = N.k)
export type NumberingScheme = 'plain' | 'perSection' | 'sectioned'

export interface NumberingSchemes {
  image: NumberingScheme
  table: NumberingScheme
  code: NumberingScheme
  formula: NumberingScheme
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify'

/**
 * Global text style (one per heading level + one for body text).
 * `fontFamily: ''` means "inherit the document base font".
 * Per-block fields (HeadingBlock/ParagraphBlock fontSize, color, …) override
 * these when set; `undefined` on the block means "follow the global style".
 */
export interface TextStyle {
  fontFamily: string // '' = inherit settings.fontFamily
  fontSize: number // pt
  color: string // hex without '#'
  bold: boolean
  align: TextAlign
  lineSpacing: number
  indent: number // cm, first-line indent
}

export interface DocumentSettings {
  fontFamily: string
  fontSize: number // pt
  lineSpacing: number
  paragraphIndent: number // cm
  headingStyles: Record<1 | 2 | 3, TextStyle>
  bodyText: TextStyle
  marginLeft: number // cm
  marginRight: number // cm
  marginTop: number // cm
  marginBottom: number // cm
  imagePrefix: string
  listingPrefix: string
  tablePrefix: string
  header: HeaderFooterConfig
  footer: HeaderFooterConfig
  differentFirstPage: boolean // title page gets a separate (empty) header/footer
  pageNumberStart: number     // number assigned to the very first (title) page
  numbering: NumberingSchemes // per-type numbering schemes
  formulaPrefix: string
}

// ---------------------------------------------------------------------------
// Effective-style resolvers (shared by the editor preview, BlockStyleRow
// fallbacks and the .docx builder): global style with inheritance from the
// document base fields. Tolerant of pre-migration settings objects.
// ---------------------------------------------------------------------------

const FALLBACK_HEADING: TextStyle = {
  fontFamily: '',
  fontSize: 14,
  color: '000000',
  bold: true,
  align: 'center',
  lineSpacing: 1.5,
  indent: 0,
}

const FALLBACK_BODY: TextStyle = {
  fontFamily: '',
  fontSize: 14,
  color: '000000',
  bold: false,
  align: 'justify',
  lineSpacing: 1.5,
  indent: 1.25,
}

function inheritFont(s: DocumentSettings | null | undefined, style: TextStyle | undefined, fallback: TextStyle): TextStyle {
  const base = style ?? fallback
  return {
    ...base,
    fontFamily: base.fontFamily || s?.fontFamily || 'Times New Roman',
  }
}

/** Effective global style for H1/H2/H3. */
export function resolveHeadingStyle(
  s: DocumentSettings | null | undefined,
  level: 1 | 2 | 3,
): TextStyle {
  const stored = s?.headingStyles?.[level]
  if (!stored) {
    const fb = { ...FALLBACK_HEADING, align: (level === 3 ? 'left' : 'center') as TextAlign }
    return inheritFont(s, fb, fb)
  }
  return inheritFont(s, stored, FALLBACK_HEADING)
}

/** Effective global style for body (paragraph) text. */
export function resolveBodyStyle(s: DocumentSettings | null | undefined): TextStyle {
  return inheritFont(s, s?.bodyText, FALLBACK_BODY)
}
