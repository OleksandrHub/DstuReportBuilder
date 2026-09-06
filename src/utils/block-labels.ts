import type { ReportBlock, TitleBlock } from '../types/document'

// Short human-readable labels for the collapsible block headers
// (content outline in "Основний контент", title outline in "Титулки").

const SUMMARY_LEN = 60

function trunc(s: string | undefined, n = SUMMARY_LEN): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return '—'
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

export function blockTypeName(b: ReportBlock): string {
  switch (b.type) {
    case 'paragraph': return 'Абзац'
    case 'text': return 'Текст'
    case 'heading': return `Заголовок H${b.level}`
    case 'list': return b.ordered ? 'Нумерований список' : 'Список'
    case 'code': return 'Код'
    case 'image': return 'Рисунок'
    case 'table': return 'Таблиця'
    case 'formula': return 'Формула'
    case 'pageBreak': return 'Розрив сторінки'
    case 'spacer': return 'Відступ'
    case 'toc': return 'Зміст'
    case 'sources': return 'Джерела'
    case 'columns': return 'Стовпці'
    case 'group': return 'Група'
  }
}

export function blockSummary(b: ReportBlock): string {
  switch (b.type) {
    case 'paragraph':
    case 'text':
    case 'heading':
      return trunc(b.text)
    case 'list':
      return trunc(b.introText || b.items[0]?.text || `${b.items.length} пунктів`)
    case 'code':
      return trunc(b.caption || b.language)
    case 'image':
      return trunc(b.caption)
    case 'table':
      return trunc(b.caption || b.headers.join(' · '))
    case 'formula':
      return trunc(b.caption || b.latex)
    case 'toc':
    case 'sources':
      return trunc(b.title)
    case 'columns':
      return `${b.columns.length} стовпці`
    case 'group':
      return `${trunc(b.title)} (${b.blocks.length})`
    case 'spacer':
      return `${b.lines ?? 1} рядк.`
    case 'pageBreak':
      return 'нова сторінка'
  }
}

export function titleBlockKind(tb: TitleBlock): string {
  switch (tb.type) {
    case 'titleLine': return 'Рядок'
    case 'titleSpacer': return 'Відступ'
    case 'titleContent': return tb.block.type === 'group' ? 'Група' : 'Блок'
  }
}

export function titleBlockSummary(tb: TitleBlock): string {
  switch (tb.type) {
    case 'titleLine':
      return trunc(tb.text) === '—' ? 'Порожній рядок' : trunc(tb.text)
    case 'titleSpacer':
      return `${tb.lines} рядк.`
    case 'titleContent':
      return `${blockTypeName(tb.block)} · ${blockSummary(tb.block)}`
  }
}
