export type SourceType = 'book' | 'article' | 'electronic'

export interface SourceEntry {
  id: string
  type: SourceType
  key?: string         // citation key: {cite:key} in text → [N]
  authors: string      // comma-separated: "Прізвище І. П., Інший А. Б."
  title: string        // main title
  subtitle?: string    // subtitle (after " : ")
  responsibility?: string // statement of responsibility after "/" (e.g. "за ред. ...")
  city: string
  publisher: string    // book
  year: string
  pages: string        // "256 с." (book); "С. 12–20." (article)
  journal: string      // article
  volume?: string      // article volume, e.g. "12"
  issue?: string       // article issue, e.g. "3"
  isbn?: string        // book
  doi?: string         // article / electronic
  url: string          // electronic
  resourceType?: string // electronic resource type, e.g. "Веб-сайт"
  accessDate: string   // electronic access date
}

function splitAuthors(raw: string): string[] {
  return raw.split(',').map(a => a.trim()).filter(Boolean)
}

// Ensure a string ends with sentence-final punctuation, used between ДСТУ zones.
function dot(s: string): string {
  const t = s.trim()
  if (!t) return ''
  return /[.!?]$/.test(t) ? t : t + '.'
}

// "Назва : підзаголовок / відомості про відповідальність".
function titleZone(e: SourceEntry, authors: string[]): string {
  let zone = e.title.trim()
  if (e.subtitle?.trim()) zone += ` : ${e.subtitle.trim()}`

  // Responsibility (after "/"), per ДСТУ 8302:
  //   1 author   → lead author in the heading; no "/ ..." needed
  //   2–3 authors → list all after "/"
  //   4+ authors  → "/ <first> та ін."
  // An explicit responsibility (e.g. "за ред. ...") overrides this rule.
  const resp = e.responsibility?.trim()
  if (resp) {
    zone += ` / ${resp}`
  } else if (authors.length >= 2 && authors.length <= 3) {
    zone += ` / ${authors.join(', ')}`
  } else if (authors.length >= 4) {
    zone += ` / ${authors[0]} та ін.`
  }
  return zone
}

// Format one source entry per ДСТУ 8302:2015.
export function formatSourceDSTU(e: SourceEntry): string {
  const dash = '–'
  const parts: string[] = []
  const authors = splitAuthors(e.authors)

  // The first author leads the reference; title-led entries (no authors) start
  // with the title.
  const heading = authors.length === 1 ? authors[0]!.trim() : (authors[0]?.trim() ?? '')
  if (heading) parts.push(dot(heading))

  const titlePart = titleZone(e, authors)
  if (titlePart) parts.push(dot(titlePart))

  if (e.type === 'book') {
    const imprint = [e.city.trim(), e.publisher.trim()].filter(Boolean).join(' : ')
    const tail = [imprint, e.year.trim()].filter(Boolean).join(', ')
    if (tail) parts.push(dot(tail))
    if (e.pages.trim()) parts.push(dot(e.pages.trim()))
    if (e.isbn?.trim()) parts.push(dot(`ISBN ${e.isbn.trim().replace(/^ISBN\s*/i, '')}`))
  } else if (e.type === 'article') {
    if (e.journal.trim()) parts.push(dot(e.journal.trim()))
    if (e.year.trim()) parts.push(dot(e.year.trim()))
    const vol = e.volume?.trim() ? `Т. ${e.volume.trim()}` : ''
    const iss = e.issue?.trim() ? `№ ${e.issue.trim().replace(/^№\s*/, '')}` : ''
    const volIss = [vol, iss].filter(Boolean).join(', ')
    if (volIss) parts.push(dot(volIss))
    if (e.pages.trim()) parts.push(dot(e.pages.trim()))
    if (e.doi?.trim()) parts.push(dot(`DOI: ${e.doi.trim().replace(/^DOI:?\s*/i, '')}`))
  } else {
    const rtype = e.resourceType?.trim() || 'Веб-сайт'
    parts.push(dot(rtype))
    if (e.doi?.trim()) parts.push(dot(`DOI: ${e.doi.trim().replace(/^DOI:?\s*/i, '')}`))
    if (e.url.trim()) {
      const acc = e.accessDate.trim() ? ` (дата звернення: ${e.accessDate.trim()}).` : ''
      parts.push(`URL: ${e.url.trim()}${acc}`)
    }
  }
  return parts.join(' ').replace(/—/g, dash)
}
