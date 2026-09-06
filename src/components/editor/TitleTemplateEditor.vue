<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useReportStore } from '../../stores/report'
import { useToast } from '../../composables/useToast'
import type { TitleLineBlock, TitleSpacerBlock, TitleContentBlock, TitleBlock, GroupBlock } from '../../types/document'
import { titleBlockKind, titleBlockSummary } from '../../utils/block-labels'
import ParagraphBlock from '../blocks/ParagraphBlock.vue'
import HeadingBlock from '../blocks/HeadingBlock.vue'
import ImageBlock from '../blocks/ImageBlock.vue'
import TableBlock from '../blocks/TableBlock.vue'
import FormulaBlock from '../blocks/FormulaBlock.vue'
import ListBlock from '../blocks/ListBlock.vue'
import ColumnsBlock from '../blocks/ColumnsBlock.vue'
import GroupBlockEditor from '../blocks/GroupBlock.vue'

const store = useReportStore()
const toast = useToast()
const doc = computed(() => store.activeDocument)

const newTemplateName = ref('')
const showSavePrompt = ref(false)
const showTemplates = ref(false)

// --- Collapsible title outline (same pattern as content blocks) ---
const collapsedTitle = ref<Record<string, boolean>>({})

function toggleTitleBlock(id: string) {
  collapsedTitle.value[id] = !collapsedTitle.value[id]
}

function setAllTitleCollapsed(value: boolean) {
  if (!doc.value) return
  for (const b of doc.value.titleTemplate) {
    collapsedTitle.value[b.id] = value
    // Title-embedded groups have no outer header either — collapse-all
    // drives the group's own persisted flag.
    if (b.type === 'titleContent' && b.block.type === 'group' && b.block.collapsed !== value) {
      store.updateTitleContentBlock(b.id, { collapsed: value })
    }
  }
}

// A title item wrapping a group: the group's own head serves as the header,
// so it renders flat — no title-block-item wrapper, no title-content-wrap.
function isTitleGroup(tb: TitleBlock): tb is TitleContentBlock & { block: GroupBlock } {
  return tb.type === 'titleContent' && tb.block.type === 'group'
}

function isTitleItemOpen(tb: TitleBlock): boolean {
  if (tb.type === 'titleContent' && tb.block.type === 'group') return !tb.block.collapsed
  return !collapsedTitle.value[tb.id]
}

function saveTpl() {
  const name = newTemplateName.value.trim()
  if (!name) return
  store.saveAsTemplate(name)
  newTemplateName.value = ''
  showSavePrompt.value = false
}

const VARS: { name: string; desc: string }[] = [
  { name: '{{ministry}}', desc: 'Міністерство' },
  { name: '{{university}}', desc: 'Університет' },
  { name: '{{department}}', desc: 'Кафедра' },
  { name: '{{workType}}', desc: 'Тип роботи — напр. «лабораторної роботи»' },
  { name: '{{workNumber}}', desc: 'Номер роботи' },
  { name: '{{topic}}', desc: 'Тема роботи' },
  { name: '{{discipline}}', desc: 'Дисципліна' },
  { name: '{{studentGroup}}', desc: 'Група студента' },
  { name: '{{studentName}}', desc: 'ПІБ студента' },
  { name: '{{teacherTitle}}', desc: 'Звання викладача' },
  { name: '{{teacherName}}', desc: 'ПІБ викладача' },
  { name: '{{city}}', desc: 'Місто' },
  { name: '{{year}}', desc: 'Рік' },
]

// --- Variable insertion at the cursor position ---
// Tracks the caret of the last focused title-line input; clicking a variable
// chip inserts it there (falls back to appending to the last line).
const caret = ref<{ blockId: string; start: number; end: number } | null>(null)

function trackCaret(blockId: string, e: Event) {
  const el = e.target as HTMLInputElement
  caret.value = {
    blockId,
    start: el.selectionStart ?? el.value.length,
    end: el.selectionEnd ?? el.value.length,
  }
}

function insertVar(name: string) {
  const docVal = doc.value
  if (!docVal) return
  const c = caret.value
  const focused = c ? docVal.titleTemplate.find(b => b.id === c.blockId) : undefined
  const line = (focused?.type === 'titleLine' ? focused : undefined)
    ?? [...docVal.titleTemplate].reverse().find((b): b is TitleLineBlock => b.type === 'titleLine')
  if (!line) return
  const at = focused && c ? c : { start: line.text.length, end: line.text.length }
  store.updateTitleBlock(line.id, { text: line.text.slice(0, at.start) + name + line.text.slice(at.end) })
  // Clicking the chip blurs the input — restore focus and caret.
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>(`input[data-title-line="${line.id}"]`)
    if (!el) return
    el.focus()
    const p = at.start + name.length
    el.setSelectionRange(p, p)
    caret.value = { blockId: line.id, start: p, end: p }
  })
}

// --- Per-row advanced style (collapsed by default to declutter rows) ---
const rowDetails = ref<Record<string, boolean>>({})

function toggleRowDetails(id: string) {
  rowDetails.value[id] = !rowDetails.value[id]
}

// Map a content block type to its editor component.
const contentEditors: Record<string, unknown> = {
  paragraph: ParagraphBlock, heading: HeadingBlock, image: ImageBlock,
  table: TableBlock, formula: FormulaBlock, list: ListBlock, columns: ColumnsBlock,
  group: GroupBlockEditor,
}

// --- Export / import all templates as a JSON file ---
const importInput = ref<HTMLInputElement | null>(null)

function exportTpls() {
  const blob = new Blob([store.exportTemplates()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'dstu-templates.json'
  a.click()
  URL.revokeObjectURL(url)
}

function onImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const res = store.importTemplates(String(reader.result), 'merge')
    if (res) toast.success(`Імпортовано: ${res.layout} макетів, ${res.data} наборів даних`)
    else toast.error('Не вдалося прочитати файл шаблонів')
  }
  reader.readAsText(file)
  ;(e.target as HTMLInputElement).value = ''
}
</script>

<template>
  <div v-if="doc" class="title-tpl-editor">
    <h3 class="section-title">📰 Макет титульної сторінки</h3>

    <div class="tpl-toolbar">
      <button class="btn-sm" @click="store.resetTitleTemplate()" title="Скинути макет до стандартного" aria-label="Скинути макет до стандартного">↺ Скинути</button>
      <button class="btn-sm btn-accent" @click="showSavePrompt = !showSavePrompt" title="Зберегти поточний макет як шаблон" aria-label="Зберегти поточний макет як шаблон">💾 Зберегти шаблон</button>
      <button class="btn-sm" @click="showTemplates = !showTemplates" :title="showTemplates ? 'Сховати список шаблонів' : 'Показати збережені шаблони'">📂 Шаблони ({{ store.titleTemplates.length }})</button>
    </div>

    <!-- Save as template prompt -->
    <div v-if="showSavePrompt" class="save-prompt">
      <input
        class="field-input"
        v-model="newTemplateName"
        placeholder="Назва шаблону..."
        @keydown.enter="saveTpl"
      />
      <button class="btn-sm btn-accent" @click="saveTpl">Зберегти</button>
    </div>

    <!-- Templates list -->
    <div v-if="showTemplates && store.titleTemplates.length > 0" class="templates-list">
      <div
        v-for="tpl in store.titleTemplates"
        :key="tpl.id"
        class="tpl-item"
      >
        <span class="tpl-name">{{ tpl.name }}</span>
        <div class="tpl-actions">
          <button class="btn-sm" @click="store.applyTemplate(tpl.id)">Застосувати</button>
          <button class="btn-sm btn-danger" @click="store.deleteTemplate(tpl.id)">✕</button>
        </div>
      </div>
    </div>
    <div v-else-if="showTemplates" class="tpl-empty">Немає збережених шаблонів</div>
    <div v-if="showTemplates" class="tpl-io-row">
      <button class="btn-sm" @click="exportTpls" title="Зберегти всі шаблони макетів у JSON-файл" aria-label="Зберегти всі шаблони макетів у JSON-файл">⬇ Експорт у файл</button>
      <button class="btn-sm" @click="importInput?.click()" title="Завантажити шаблони макетів із JSON-файлу" aria-label="Завантажити шаблони макетів із JSON-файлу">⬆ Імпорт із файлу</button>
      <input ref="importInput" type="file" accept="application/json,.json" style="display:none" @change="onImportFile" />
    </div>

    <!-- Vars hint -->
    <div class="vars-hint">
      <span class="vars-label">Змінні — значення беруться з вкладки «Макроси». Натисни, щоб вставити в позицію курсора:</span>
      <div class="vars-list">
        <button
          v-for="v in VARS" :key="v.name" class="var-chip"
          :title="`${v.name} — ${v.desc}`"
          @click="insertVar(v.name)"
        >{{ v.name }}</button>
      </div>
    </div>

    <!-- Title blocks -->
    <div v-if="doc.titleTemplate.length > 1" class="collapse-all-row">
      <span class="collapse-count">Блоків: {{ doc.titleTemplate.length }}</span>
      <span class="collapse-all-spacer"></span>
      <button class="btn-sm" @click="setAllTitleCollapsed(true)" title="Згорнути всі блоки до заголовків" aria-label="Згорнути всі блоки до заголовків">Згорнути все</button>
      <button class="btn-sm" @click="setAllTitleCollapsed(false)" title="Розгорнути всі блоки" aria-label="Розгорнути всі блоки">Розгорнути все</button>
    </div>
    <div class="title-blocks-list">
      <div v-if="doc.titleTemplate.length === 0" class="tpl-empty">Макет порожній — додай рядок нижче або натисни «↺ Скинути».</div>
      <template v-for="block in doc.titleTemplate" :key="block.id">
      <!-- Title-embedded groups render flat: just the group, no item/wrap chrome. -->
      <GroupBlockEditor
        v-if="isTitleGroup(block)"
        :block="block.block"
        :index-override="1"
        context="title"
        @update="store.updateTitleContentBlock(block.id, $event)"
        @remove="store.removeTitleBlock(block.id)"
        @duplicate="store.duplicateTitleContentBlock(block.id)"
        @move-up="store.moveTitleBlock(block.id, 'up')"
        @move-down="store.moveTitleBlock(block.id, 'down')"
      />
      <div
        v-else
        class="title-block-item"
        :class="[
          block.type === 'titleSpacer' ? 'spacer-block' : 'line-block',
          { collapsed: !isTitleItemOpen(block) },
        ]"
      >
        <div class="collapse-head">
          <button
            class="collapse-toggle"
            @click="toggleTitleBlock(block.id)"
            :aria-expanded="!collapsedTitle[block.id]"
            :title="collapsedTitle[block.id] ? 'Розгорнути блок' : 'Згорнути блок'"
          >
            <span class="collapse-chevron" aria-hidden="true">{{ collapsedTitle[block.id] ? '▸' : '▾' }}</span>
            <span class="collapse-title">{{ titleBlockKind(block) }}</span>
            <span class="collapse-summary">{{ titleBlockSummary(block) }}</span>
          </button>
          <div class="collapse-mini">
            <button @click="store.moveTitleBlock(block.id, 'up')" title="Вгору" aria-label="Вгору">↑</button>
            <button @click="store.moveTitleBlock(block.id, 'down')" title="Вниз" aria-label="Вниз">↓</button>
          </div>
        </div>
        <div v-show="isTitleItemOpen(block)" class="collapse-body">
        <!-- SPACER -->
        <template v-if="block.type === 'titleSpacer'">
          <div class="spacer-row">
            <span class="block-type-label">⟷ Відступ</span>
            <div class="spacer-flex-ctrl">
              <label>Рядків:</label>
              <input
                type="number" min="1" max="50" step="1"
                class="small-number-input"
                :value="(block as TitleSpacerBlock).lines"
                @input="store.updateTitleBlock(block.id, { lines: parseInt(($event.target as HTMLInputElement).value) || 1 })"
              />
            </div>
            <div class="block-actions">
              <button @click="store.moveTitleBlock(block.id, 'up')" title="Вгору" aria-label="Вгору">↑</button>
              <button @click="store.moveTitleBlock(block.id, 'down')" title="Вниз" aria-label="Вниз">↓</button>
              <button class="btn-danger" @click="store.removeTitleBlock(block.id)" title="Видалити" aria-label="Видалити">✕</button>
            </div>
          </div>
          <div class="title-add-row">
            <button class="btn-add-item" @click="store.addTitleBlock('titleLine', block.id)">+ Рядок після</button>
            <button class="btn-add-item" @click="store.addTitleBlock('titleSpacer', block.id)">+ Відступ після</button>
          </div>
        </template>

        <!-- LINE -->
        <template v-else>
          <div class="line-row">
            <input
              class="block-input line-text-input"
              :data-title-line="block.id"
              :value="(block as TitleLineBlock).text"
              @input="store.updateTitleBlock(block.id, { text: ($event.target as HTMLInputElement).value })"
              @focus="trackCaret(block.id, $event)"
              @click="trackCaret(block.id, $event)"
              @keyup="trackCaret(block.id, $event)"
              @select="trackCaret(block.id, $event)"
              placeholder="Текст рядка або {{змінна}}"
            />
          </div>
          <div class="line-toolbar">
            <div class="line-controls">
              <div class="align-btns">
                <button
                  v-for="a in ['left','center','right']"
                  :key="a"
                  :class="['align-btn', { active: (block as TitleLineBlock).align === a }]"
                  @click="store.updateTitleBlock(block.id, { align: a as 'left'|'center'|'right' })"
                  :title="a === 'left' ? 'Зліва' : a === 'center' ? 'По центру' : 'Справа'"
                  :aria-label="a === 'left' ? 'Вирівняти зліва' : a === 'center' ? 'Вирівняти по центру' : 'Вирівняти справа'"
                >{{ a === 'left' ? '⇤' : a === 'center' ? '⇔' : '⇥' }}</button>
              </div>
              <button
                :class="['bold-btn', { active: (block as TitleLineBlock).bold }]"
                @click="store.updateTitleBlock(block.id, { bold: !(block as TitleLineBlock).bold })"
                :title="(block as TitleLineBlock).bold ? 'Прибрати жирний' : 'Зробити жирним'"
              >B</button>
            </div>
            <div class="block-actions">
              <button @click="store.moveTitleBlock(block.id, 'up')" title="Вгору" aria-label="Вгору">↑</button>
              <button @click="store.moveTitleBlock(block.id, 'down')" title="Вниз" aria-label="Вниз">↓</button>
              <button :class="{ toggled: rowDetails[block.id] }" @click="toggleRowDetails(block.id)" title="Стиль рядка: розмір, колір, відступи" aria-label="Стиль рядка: розмір, колір, відступи">⚙</button>
              <button class="btn-danger" @click="store.removeTitleBlock(block.id)" title="Видалити" aria-label="Видалити">✕</button>
            </div>
          </div>
          <div class="title-add-row">
            <button class="btn-add-item" @click="store.addTitleBlock('titleLine', block.id)" title="Додати рядок після цього" aria-label="Додати рядок після цього">+ Рядок після</button>
            <button class="btn-add-item" @click="store.addTitleBlock('titleSpacer', block.id)" title="Додати відступ після цього" aria-label="Додати відступ після цього">+ Відступ після</button>
          </div>

          <!-- Advanced style (collapsed by default) -->
          <template v-if="rowDetails[block.id]">
          <!-- Padding controls row -->
          <div class="line-padding-row">
            <label>Відступ зліва (см):</label>
            <input
              type="number" min="0" max="20" step="any"
              class="small-number-input"
              :value="(block as TitleLineBlock).paddingLeft"
              @input="store.updateTitleBlock(block.id, { paddingLeft: parseFloat(($event.target as HTMLInputElement).value) || 0 })"
            />
            <label>Відступ справа (см):</label>
            <input
              type="number" min="0" max="20" step="any"
              class="small-number-input"
              :value="(block as TitleLineBlock).paddingRight"
              @input="store.updateTitleBlock(block.id, { paddingRight: parseFloat(($event.target as HTMLInputElement).value) || 0 })"
            />
          </div>

          <!-- Font controls row -->
          <div class="line-padding-row">
            <label>Розмір (pt):</label>
            <input
              type="number" min="8" max="36" step="1"
              class="small-number-input"
              :value="(block as TitleLineBlock).fontSize ?? ''"
              placeholder="авто"
              @input="store.updateTitleBlock(block.id, { fontSize: parseInt(($event.target as HTMLInputElement).value) || undefined })"
            />
            <label>Інтервал:</label>
            <input
              type="number" min="1" max="3" step="0.5"
              class="small-number-input"
              :value="(block as TitleLineBlock).lineSpacing ?? ''"
              placeholder="авто"
              @input="store.updateTitleBlock(block.id, { lineSpacing: parseFloat(($event.target as HTMLInputElement).value) || undefined })"
            />
            <label>Колір:</label>
            <input
              type="color"
              class="style-color"
              :value="'#' + ((block as TitleLineBlock).color ?? '000000')"
              @input="store.updateTitleBlock(block.id, { color: ($event.target as HTMLInputElement).value.replace('#','').toUpperCase() })"
            />
          </div>
          </template>
        </template>

        <!-- CONTENT BLOCK (any body block embedded in the title) -->
        <template v-if="block.type === 'titleContent'">
          <div class="title-content-wrap">
            <div class="title-content-head">
              <span class="block-type-label">▣ Блок</span>
              <div class="block-actions">
                <button @click="store.moveTitleBlock(block.id, 'up')" title="Перемістити блок вгору" aria-label="Перемістити блок вгору">↑</button>
                <button @click="store.moveTitleBlock(block.id, 'down')" title="Перемістити блок вниз" aria-label="Перемістити блок вниз">↓</button>
                <button class="btn-danger" @click="store.removeTitleBlock(block.id)" title="Видалити блок" aria-label="Видалити блок">✕</button>
              </div>
            </div>
            <component
              :is="contentEditors[(block as TitleContentBlock).block.type]"
              :block="(block as TitleContentBlock).block"
              :index="1"
              :index-override="1"
              :context="'title'"
              @update="store.updateTitleContentBlock(block.id, $event)"
              @remove="store.removeTitleBlock(block.id)"
              @duplicate="store.duplicateTitleContentBlock(block.id)"
              @move-up="store.moveTitleBlock(block.id, 'up')"
              @move-down="store.moveTitleBlock(block.id, 'down')"
            />
          </div>
        </template>
        </div>
      </div>
      </template>
    </div>

    <!-- Add at end -->
    <div class="add-title-block-row">
      <button class="btn-add-item" @click="store.addTitleBlock('titleLine')">+ Рядок</button>
      <button class="btn-add-item" @click="store.addTitleBlock('titleSpacer')">+ Відступ</button>
    </div>
    <div class="add-title-block-row">
      <span class="add-label">+ Блок:</span>
      <button class="btn-add-item" @click="store.addTitleContentBlock('paragraph')">¶ Абзац</button>
      <button class="btn-add-item" @click="store.addTitleContentBlock('heading')">H Заголовок</button>
      <button class="btn-add-item" @click="store.addTitleContentBlock('image')">🖼 Рисунок</button>
      <button class="btn-add-item" @click="store.addTitleContentBlock('table')">⊞ Таблиця</button>
      <button class="btn-add-item" @click="store.addTitleContentBlock('formula')">∑ Формула</button>
      <button class="btn-add-item" @click="store.addTitleContentBlock('list')">≡ Список</button>
      <button class="btn-add-item" @click="store.addTitleContentBlock('columns')">▥ Стовпці</button>
      <button class="btn-add-item" @click="store.addTitleContentBlock('group')" title="Група блоків, що згортається" aria-label="Група блоків, що згортається">▤ Група</button>
    </div>
  </div>
</template>
