import { AlignmentType, FootnoteReferenceRun, Paragraph, ShadingType, TextRun } from 'docx'
import { addNbsp } from './nbsp'

export interface FontConfig {
  name: string
  size: number // half-points
  lineSpacing: number
  paragraphIndent: number // cm
  color?: string // hex without '#'
}

export interface RunStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  mono?: boolean
  color?: string // hex without '#', overrides cfg.color for this run
  highlight?: string // background fill, hex without '#'
}

const DEFAULT_HIGHLIGHT = 'FFFF00'

export function styledRun(text: string, cfg: FontConfig, st: RunStyle): TextRun {
  return new TextRun({
    text,
    font: st.mono ? 'Courier New' : cfg.name,
    size: cfg.size,
    bold: st.bold,
    italics: st.italic,
    underline: st.underline ? {} : undefined,
    color: st.color ?? cfg.color,
    shading: st.highlight ? { type: ShadingType.CLEAR, fill: st.highlight, color: 'auto' } : undefined,
  })
}

export function baseRun(text: string, cfg: FontConfig, bold = false, italic = false): TextRun {
  return styledRun(text, cfg, { bold, italic })
}

// Inline formatting markers. The parser is stateful: a marker toggles its style
// on/off, so styles nest and combine freely, e.g.
//   ***bold italic***  →  **_x_**  →  *a `b`*  all work.
//   **bold**   *italic*   __underline__   `mono`   ==highlight (yellow)==
type BoolStyleKey = 'bold' | 'italic' | 'underline' | 'mono'
const MARKERS: Array<{ tok: string; key: BoolStyleKey }> = [
  { tok: '**', key: 'bold' },
  { tok: '__', key: 'underline' },
  { tok: '*', key: 'italic' },
  { tok: '`', key: 'mono' },
]

// Document-wide knowledge needed by some inline tokens. buildDocxBlob sets it
// for the duration of one (synchronous) build and clears it afterwards.
export interface InlineContext {
  refs: Map<string, string> // refKey(label) → number of the labelled object
  nbsp: boolean             // settings.autoNbsp
  footnotes: Record<number, { children: Paragraph[] }> // collected ^[…] footnotes, by id
  cite: {
    keys: Map<string, string>    // refKey(entry key) or "N" (list position) → entry id
    numbers: Map<string, number> // entry id → number in the sources list
    cited: string[]              // entry ids in order of first citation (filled while rendering)
  }
}
let context: InlineContext | null = null
export function setInlineContext(c: InlineContext | null): void {
  context = c
}
export function getInlineContext(): InlineContext | null {
  return context
}

// {cite:a,b|с. 25} → "[1, 3, с. 25]"; runs of 3+ consecutive numbers collapse
// to a range ("[2–4]"); unknown keys show as "?".
function citation(keys: string, extra: string | undefined): string {
  const c = context?.cite
  const nums: number[] = []
  let unknown = false
  for (const k of keys.split(',').map(refKey).filter(Boolean)) {
    const id = c?.keys.get(k)
    const n = id ? c!.numbers.get(id) : undefined
    if (id && n) {
      if (!c!.cited.includes(id)) c!.cited.push(id)
      if (!nums.includes(n)) nums.push(n)
    } else {
      unknown = true
    }
  }
  nums.sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < nums.length;) {
    let j = i
    while (j + 1 < nums.length && nums[j + 1] === nums[j]! + 1) j++
    if (j - i >= 2) parts.push(`${nums[i]}–${nums[j]}`)
    else for (let k = i; k <= j; k++) parts.push(String(nums[k]))
    i = j + 1
  }
  if (unknown) parts.push('?')
  if (extra?.trim()) parts.push(extra.trim())
  return `[${parts.join(', ')}]`
}

// Labels are matched case-insensitively, ignoring surrounding spaces.
export function refKey(label: string): string {
  return label.trim().toLowerCase()
}

// Cross-reference: {ref:label} → the number of the object with that label
// ("??" when there is no such label). Citation: {cite:key} → [N], see citation().
// Inline color markers: {#RRGGBB|text colour} and {!#RRGGBB|background fill};
// 3-digit hex works too, and {!|text} uses the default yellow fill.
// Escape any marker char with a backslash: \*  \_  \`  \=  \^  \{  \}  \\
export type InlineRun = TextRun | FootnoteReferenceRun

// Footnote text size: 10 pt, independent of the body size.
const FOOTNOTE_SIZE = 20
let inFootnote = false

// ^[text] → a footnote at the bottom of the page. The text may use every
// inline marker (but not another footnote). Returns the reference mark.
function footnote(content: string, cfg: FontConfig): InlineRun {
  const notes = context?.footnotes
  if (!notes || inFootnote) return styledRun(content, cfg, {})
  const id = Object.keys(notes).length + 1
  inFootnote = true
  try {
    notes[id] = {
      children: [new Paragraph({
        children: inlineRuns(content.trim(), { ...cfg, size: FOOTNOTE_SIZE }),
        alignment: AlignmentType.JUSTIFIED,
      })],
    }
  } finally {
    inFootnote = false
  }
  return new FootnoteReferenceRun(id)
}

// Index just past the "]" that closes a "^[" opened at `start` (nested
// brackets and backslash escapes allowed), or -1 if it is never closed.
function footnoteEnd(text: string, start: number): number {
  let depth = 0
  for (let j = start; j < text.length; j++) {
    const c = text[j]
    if (c === '\\') { j++; continue }
    if (c === '[') depth++
    else if (c === ']' && --depth === 0) return j + 1
  }
  return -1
}

export function inlineRuns(text: string, cfg: FontConfig, baseBold = false): InlineRun[] {
  if (context?.nbsp) text = addNbsp(text)
  const runs: InlineRun[] = []
  const active: RunStyle = { bold: baseBold }
  // {..|..} groups form a stack so nested groups restore the outer value on close.
  const groupStack: Array<{ key: 'color' | 'highlight'; prev: string | undefined }> = []
  let buf = ''

  const flush = () => {
    if (buf) {
      runs.push(styledRun(buf, cfg, { ...active }))
      buf = ''
    }
  }

  let i = 0
  while (i < text.length) {
    const ch = text[i]!

    // Backslash escape: emit the next char literally.
    if (ch === '\\' && i + 1 < text.length) {
      buf += text[i + 1]
      i += 2
      continue
    }

    if (active.mono) {
      if (ch === '`') { flush(); active.mono = false; i += 1; continue }
      buf += ch; i += 1; continue
    }

    const ref = /^\{ref:([^}]*)\}/.exec(text.slice(i))
    if (ref) {
      buf += context?.refs.get(refKey(ref[1]!)) ?? '??'
      i += ref[0].length
      continue
    }
    if (text.startsWith('^[', i)) {
      const end = footnoteEnd(text, i + 1)
      if (end !== -1) {
        flush()
        runs.push(footnote(text.slice(i + 2, end - 1), cfg))
        i = end
        continue
      }
    }

    const cite = /^\{cite:([^}|]*)(?:\|([^}]*))?\}/.exec(text.slice(i))
    if (cite) {
      buf += citation(cite[1]!, cite[2])
      i += cite[0].length
      continue
    }

    // Open group: {#RGB| (text colour) or {!#RGB| / {!| (background fill)
    const groupOpen = /^\{(!?)(?:#([0-9a-fA-F]{6}|[0-9a-fA-F]{3}))?\|/.exec(text.slice(i))
    if (groupOpen && (groupOpen[1] || groupOpen[2])) {
      flush()
      const key = groupOpen[1] ? 'highlight' : 'color'
      let hex = groupOpen[2]?.toUpperCase() ?? DEFAULT_HIGHLIGHT
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
      groupStack.push({ key, prev: active[key] })
      active[key] = hex
      i += groupOpen[0].length
      continue
    }
    // Close group: }
    if (ch === '}' && groupStack.length) {
      flush()
      const { key, prev } = groupStack.pop()!
      active[key] = prev
      i += 1
      continue
    }
    // Toggle yellow highlight: ==text==
    if (text.startsWith('==', i)) {
      flush()
      active.highlight = active.highlight ? undefined : DEFAULT_HIGHLIGHT
      i += 2
      continue
    }

    let matched = false
    for (const { tok, key } of MARKERS) {
      if (text.startsWith(tok, i)) {
        flush()
        active[key] = !active[key]
        i += tok.length
        matched = true
        break
      }
    }
    if (!matched) { buf += ch; i += 1 }
  }
  flush()
  if (runs.length === 0) runs.push(styledRun('', cfg, { bold: baseBold }))
  return runs
}
