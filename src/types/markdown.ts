export interface ParsedMarkdownTable {
  headers: string[]
  rows: string[][]
}

export interface ParsedMarkdownList {
  ordered: boolean
  items: string[]
}

// Parse a list from Markdown text: unordered (`- ` or `* `) or ordered (`1. `).
// Blank lines separate list groups. Returns null if text doesn't look like a list.
export function parseMarkdownList(md: string): ParsedMarkdownList | null {
  const rawLines = md.split(/\r?\n/)
  const lines = rawLines.map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) return null

  const isOrdered = (l: string) => /^\d+\.\s/.test(l)
  const isUnordered = (l: string) => /^[-*]\s/.test(l)
  const strip = (l: string) => l.replace(/^[-*]\s/, '').replace(/^\d+\.\s/, '')

  if (!isOrdered(lines[0]!) && !isUnordered(lines[0]!)) return null

  const ordered = isOrdered(lines[0]!)
  const items: string[] = []
  for (const line of lines) {
    if (isOrdered(line) || isUnordered(line)) {
      items.push(strip(line))
    }
  }
  if (items.length === 0) return null
  return { ordered, items }
}

// Parse a GitHub-flavored Markdown table into headers + rows. Accepts optional
// leading/trailing pipes; the separator row (---|:--:) is skipped. Returns null
// if the text doesn't look like a table.
export function parseMarkdownTable(md: string): ParsedMarkdownTable | null {
  const splitRow = (line: string): string[] => {
    let s = line.trim()
    if (s.startsWith('|')) s = s.slice(1)
    if (s.endsWith('|')) s = s.slice(0, -1)
    // Split on unescaped pipes, then unescape \| back to |.
    return s.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim())
  }
  const isSeparator = (line: string): boolean =>
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)

  const lines = md.split(/\r?\n/).map(l => l.trim()).filter(l => l.includes('|'))
  if (lines.length < 1) return null

  const headerLine = lines[0]!
  let bodyStart = 1
  if (lines.length >= 2 && isSeparator(lines[1]!)) bodyStart = 2

  const headers = splitRow(headerLine)
  if (headers.length === 0) return null

  const rows: string[][] = []
  for (let i = bodyStart; i < lines.length; i++) {
    if (isSeparator(lines[i]!)) continue
    const cells = splitRow(lines[i]!)
    while (cells.length < headers.length) cells.push('')
    rows.push(cells.slice(0, headers.length))
  }
  return { headers, rows }
}
