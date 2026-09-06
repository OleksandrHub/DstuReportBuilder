import type { FormulaImage } from '../useFormulaImage'

// Module-level cache of rendered formula PNGs across .docx rebuilds.
// Without it every keystroke-pause re-renders ALL KaTeX formulas (DOM
// measure + SVG raster), which dominates preview latency on formula-heavy
// documents. Entries are shared by reference (read-only downstream).
const MAX_ENTRIES = 100
const cache = new Map<string, FormulaImage>()

export function formulaCacheKey(latex: string, fontSizePx: number): string {
  return `${fontSizePx}px@@${latex}`
}

export function getCachedFormula(key: string): FormulaImage | undefined {
  const hit = cache.get(key)
  if (hit) {
    // Refresh LRU position.
    cache.delete(key)
    cache.set(key, hit)
  }
  return hit
}

export function setCachedFormula(key: string, img: FormulaImage): void {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, img)
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next()
    if (oldest.done) break
    cache.delete(oldest.value)
  }
}

export function clearFormulaCache(): void {
  cache.clear()
}

/** Test hook. */
export function formulaCacheSize(): number {
  return cache.size
}
