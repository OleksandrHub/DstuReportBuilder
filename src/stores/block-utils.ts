import type {
  ReportBlock,
  ListItem,
} from '../types/document'
import { generateId } from './factories'

// Deep-clone a block and assign fresh ids to it and every nested entity.
export function cloneBlockWithNewIds(block: ReportBlock): ReportBlock {
  const copy = JSON.parse(JSON.stringify(block)) as ReportBlock
  const reid = (o: { id?: string }) => { if (o && typeof o === 'object' && 'id' in o) o.id = generateId() }
  copy.id = generateId()
  const reItems = (items?: ListItem[]) => items?.forEach(i => { reid(i); reItems(i.children) })
  if (copy.type === 'list') reItems(copy.items)
  else if (copy.type === 'table') copy.rows.forEach(reid)
  else if (copy.type === 'sources') copy.entries.forEach(reid)
  else if (copy.type === 'columns') copy.columns.forEach(c => { reid(c); c.blocks.forEach(reid) })
  else if (copy.type === 'group') copy.blocks = copy.blocks.map(cloneBlockWithNewIds)
  return copy
}

// Find an item (and its sibling array) anywhere in a nested list tree.
export function findListItem(items: ListItem[], itemId: string): { item: ListItem; siblings: ListItem[] } | null {
  for (const i of items) {
    if (i.id === itemId) return { item: i, siblings: items }
    if (i.children) {
      const found = findListItem(i.children, itemId)
      if (found) return found
    }
  }
  return null
}
