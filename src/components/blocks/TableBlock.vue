<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TableBlock } from '../../types/document'
import { useReportStore } from '../../stores/report'
import MarkerHint from './MarkerHint.vue'

const props = defineProps<{ block: TableBlock; index: number }>()
const emit = defineEmits<{
  update: [data: Partial<TableBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()

const store = useReportStore()

function updateHeader(colIdx: number, value: string) {
  const headers = [...props.block.headers]
  headers[colIdx] = value
  emit('update', { headers })
}

function updateCell(rowId: string, colIdx: number, value: string) {
  const rows = props.block.rows.map(r => {
    if (r.id !== rowId) return r
    const cells = r.cells.map((c, i) => i === colIdx ? { ...c, text: value } : c)
    return { ...r, cells }
  })
  emit('update', { rows })
}

// Column width displayed for column i (explicit % or even split).
function colWidth(i: number): number {
  const n = props.block.headers.length
  const w = props.block.columnWidths
  if (w && w.length === n && w[i] != null) return w[i] as number
  return Math.round(100 / n)
}

// --- Markdown import ---
const showMd = ref(false)
const mdText = ref('')
const mdError = ref('')

function applyMarkdown() {
  mdError.value = ''
  const ok = store.importMarkdownTable(props.block.id, mdText.value)
  if (!ok) {
    mdError.value = 'Не вдалося розпізнати таблицю. Перевірте формат Markdown.'
    return
  }
  showMd.value = false
  mdText.value = ''
}

// Export the current table back to Markdown (so editing round-trips).
const currentMarkdown = computed(() => {
  const esc = (s: string) => s.replace(/\|/g, '\\|')
  const head = `| ${props.block.headers.map(esc).join(' | ')} |`
  const sep = `| ${props.block.headers.map(() => '---').join(' | ')} |`
  const body = props.block.rows
    .map(r => `| ${r.cells.map(c => esc(c.text)).join(' | ')} |`)
    .join('\n')
  return [head, sep, body].filter(Boolean).join('\n')
})

function openMdWithCurrent() {
  mdText.value = currentMarkdown.value
  mdError.value = ''
  showMd.value = true
}
</script>

<template>
  <div class="block table-block">
    <div class="block-toolbar">
      <span class="block-type-label">⊞ Таблиця {{ props.index }}</span>
      <div class="block-actions">
        <button @click="emit('duplicate')" title="Копіювати" aria-label="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору" aria-label="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз" aria-label="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити" aria-label="Видалити">✕</button>
      </div>
    </div>

    <label class="ref-toggle">
      <input
        type="checkbox"
        :checked="props.block.referenceText !== ''"
        @change="emit('update', { referenceText: ($event.target as HTMLInputElement).checked ? 'Дані наведено у таблиці {no}.' : '' })"
      />
      <span>Показувати посилання в тексті</span>
    </label>
    <template v-if="props.block.referenceText !== ''">
      <div class="block-field-row">
        <label>Текст посилання:</label>
        <input
          class="block-input"
          :value="props.block.referenceText"
          @input="emit('update', { referenceText: ($event.target as HTMLInputElement).value })"
          placeholder="Дані наведено у таблиці {no}."
        />
      </div>
      <p class="block-hint">{no} — підставиться номер таблиці</p>
      <label class="ref-toggle">
        <input
          type="checkbox"
          :checked="!!props.block.inlineReference"
          @change="emit('update', { inlineReference: ($event.target as HTMLInputElement).checked })"
        />
        <span>Продовжити попередній абзац (без нового рядка)</span>
      </label>
    </template>

    <div class="block-field-row">
      <label>Підпис:</label>
      <input
        class="block-input"
        :value="props.block.caption"
        @input="emit('update', { caption: ($event.target as HTMLInputElement).value })"
        placeholder="Назва таблиці"
      />
    </div>

    <div class="block-style-row">
      <select class="style-select"
        :value="props.block.fontFamily ?? 'Times New Roman'"
        @change="emit('update', { fontFamily: ($event.target as HTMLSelectElement).value || undefined })"
        title="Шрифт">
        <option value="Times New Roman">Times New Roman</option>
        <option value="Arial">Arial</option>
        <option value="Calibri">Calibri</option>
        <option value="Courier New">Courier New</option>
      </select>
      <span class="style-label">Розмір:</span>
      <input type="number" min="8" max="24" step="1" class="style-number"
        :value="props.block.fontSize ?? 12"
        @input="emit('update', { fontSize: parseInt(($event.target as HTMLInputElement).value) || 12 })"
        title="Розмір шрифту (pt)"
      />
      <span class="style-unit">pt</span>
      <span class="style-label">Інтервал:</span>
      <input type="number" min="1" max="3" step="0.5" class="style-number"
        :value="props.block.lineSpacing ?? 1.0"
        @input="emit('update', { lineSpacing: parseFloat(($event.target as HTMLInputElement).value) || 1.0 })"
        title="Міжрядковий інтервал"
      />
      <button :class="['style-btn', { active: props.block.bold }]"
        @click="emit('update', { bold: !props.block.bold })" title="Жирний (комірки даних)" aria-label="Жирний (комірки даних)"><b>B</b></button>
      <select class="style-select"
        :value="props.block.align ?? 'left'"
        @change="emit('update', { align: ($event.target as HTMLSelectElement).value as 'left'|'center'|'right'|'justify' })"
        title="Вирівнювання комірок даних">
        <option value="left">⇤ зліва</option>
        <option value="center">⇔ центр</option>
        <option value="right">⇥ справа</option>
        <option value="justify">≡ по ширині</option>
      </select>
      <input type="color" class="style-color"
        :value="'#' + (props.block.color ?? '000000')"
        @input="emit('update', { color: ($event.target as HTMLInputElement).value.replace('#','').toUpperCase() })"
        title="Колір тексту"
      />
    </div>

    <!-- Width settings -->
    <label class="ref-toggle">
      <input
        type="checkbox"
        :checked="props.block.fullWidth !== false"
        @change="store.setTableFullWidth(props.block.id, ($event.target as HTMLInputElement).checked)"
      />
      <span>На всю ширину сторінки</span>
    </label>
    <label class="ref-toggle">
      <input type="checkbox" :checked="!!props.block.noTrailingSpace"
        @change="emit('update', { noTrailingSpace: ($event.target as HTMLInputElement).checked })" />
      <span>Без порожнього рядка знизу</span>
    </label>

    <div class="col-width-row">
      <span class="style-label">Ширина стовпців (%):</span>
      <div class="col-width-inputs">
        <input
          v-for="(_h, ci) in props.block.headers"
          :key="ci"
          type="number" min="1" max="100" step="1"
          class="style-number"
          :value="colWidth(ci)"
          @input="store.setTableColumnWidth(props.block.id, ci, parseInt(($event.target as HTMLInputElement).value) || 1)"
          :title="`Стовпець ${ci + 1}`"
        />
        <button class="btn-small" @click="store.resetTableColumnWidths(props.block.id)" title="Рівні ширини" aria-label="Рівні ширини">↺</button>
      </div>
    </div>

    <!-- Markdown import/export -->
    <div class="md-table-toolbar">
      <button class="btn-small" @click="showMd ? (showMd = false) : openMdWithCurrent()">
        {{ showMd ? '✕ Сховати Markdown' : '⇄ Markdown' }}
      </button>
    </div>
    <div v-if="showMd" class="md-table-panel">
      <textarea
        class="block-textarea"
        v-model="mdText"
        rows="8"
        spellcheck="false"
        placeholder="| Колонка 1 | Колонка 2 |&#10;| --- | --- |&#10;| Текст | Текст |"
      />
      <p v-if="mdError" class="block-hint md-error">{{ mdError }}</p>
      <p class="block-hint">Вставте Markdown-таблицю і натисніть «Застосувати» — вона замінить вміст.</p>
      <button class="btn-add-item" @click="applyMarkdown">Застосувати Markdown</button>
    </div>

    <div class="table-editor-wrap">
      <table class="editor-table">
        <thead>
          <tr>
            <th v-for="(header, ci) in props.block.headers" :key="ci" class="table-header-cell">
              <input
                class="table-cell-input"
                :value="header"
                @input="updateHeader(ci, ($event.target as HTMLInputElement).value)"
                placeholder="Заголовок"
              />
              <button
                class="btn-icon btn-danger col-remove-btn"
                @click="store.removeTableColumn(props.block.id, ci)"
                :disabled="props.block.headers.length <= 1"
                title="Видалити стовпець" aria-label="Видалити стовпець"
              >✕</button>
            </th>
            <th class="col-add-cell">
              <button class="btn-icon" @click="store.addTableColumn(props.block.id)" title="Додати стовпець" aria-label="Додати стовпець">+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(row, ri) in props.block.rows" :key="row.id">
            <tr v-if="row.splitBefore" class="split-marker-row">
              <td :colspan="row.cells.length + 1" class="split-marker-cell">
                ✂ Продовження таблиці з цього рядка
              </td>
            </tr>
            <tr>
              <td v-for="(cell, ci) in row.cells" :key="ci">
                <input
                  class="table-cell-input"
                  :value="cell.text"
                  @input="updateCell(row.id, ci, ($event.target as HTMLInputElement).value)"
                  placeholder="..."
                />
              </td>
              <td class="row-action-cell">
                <button
                  v-if="ri > 0"
                  class="btn-icon"
                  :class="{ active: row.splitBefore }"
                  @click="store.toggleTableRowSplit(props.block.id, row.id)"
                  :title="row.splitBefore ? 'Прибрати розрив таблиці' : 'Розірвати таблицю перед цим рядком'"
                >✂</button>
                <button
                  class="btn-icon btn-danger"
                  @click="store.removeTableRow(props.block.id, row.id)"
                  :disabled="props.block.rows.length <= 1"
                  title="Видалити рядок" aria-label="Видалити рядок"
                >✕</button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <button class="btn-add-item" @click="store.addTableRow(props.block.id)">
      + Додати рядок
    </button>
    <MarkerHint />
  </div>
</template>
