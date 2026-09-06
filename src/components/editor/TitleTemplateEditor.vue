<script setup lang="ts">
import { ref, computed } from 'vue'
import { useReportStore } from '../../stores/report'
import { useToast } from '../../composables/useToast'
import type { TitleLineBlock, TitleSpacerBlock, TitleContentBlock } from '../../types/document'
import ParagraphBlock from '../blocks/ParagraphBlock.vue'
import HeadingBlock from '../blocks/HeadingBlock.vue'
import ImageBlock from '../blocks/ImageBlock.vue'
import TableBlock from '../blocks/TableBlock.vue'
import FormulaBlock from '../blocks/FormulaBlock.vue'
import ListBlock from '../blocks/ListBlock.vue'
import ColumnsBlock from '../blocks/ColumnsBlock.vue'

const store = useReportStore()
const toast = useToast()
const doc = computed(() => store.activeDocument)

const newTemplateName = ref('')
const showSavePrompt = ref(false)
const showTemplates = ref(false)

function saveTpl() {
  const name = newTemplateName.value.trim()
  if (!name) return
  store.saveAsTemplate(name)
  newTemplateName.value = ''
  showSavePrompt.value = false
}

const VARS = [
  '{{ministry}}', '{{university}}', '{{department}}',
  '{{workType}}', '{{workNumber}}', '{{topic}}', '{{discipline}}',
  '{{studentGroup}}', '{{studentName}}',
  '{{teacherTitle}}', '{{teacherName}}',
  '{{city}}', '{{year}}',
]

function insertVar(blockId: string, v: string, currentText: string) {
  store.updateTitleBlock(blockId, { text: currentText + v } as Partial<TitleLineBlock>)
}

// Map a content block type to its editor component.
const contentEditors: Record<string, unknown> = {
  paragraph: ParagraphBlock, heading: HeadingBlock, image: ImageBlock,
  table: TableBlock, formula: FormulaBlock, list: ListBlock, columns: ColumnsBlock,
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
    <div class="tpl-toolbar">
      <button class="btn-sm" @click="store.resetTitleTemplate()" title="Скинути до стандарту">↺ Скинути</button>
      <button class="btn-sm btn-accent" @click="showSavePrompt = !showSavePrompt">💾 Зберегти шаблон</button>
      <button class="btn-sm" @click="showTemplates = !showTemplates">📂 Шаблони ({{ store.titleTemplates.length }})</button>
      <button class="btn-sm" @click="exportTpls" title="Експорт шаблонів у файл">⬇ Експорт</button>
      <button class="btn-sm" @click="importInput?.click()" title="Імпорт шаблонів із файлу">⬆ Імпорт</button>
      <input ref="importInput" type="file" accept="application/json,.json" style="display:none" @change="onImportFile" />
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

    <!-- Vars hint -->
    <div class="vars-hint">
      <span class="vars-label">Змінні:</span>
      <div class="vars-list">
        <code v-for="v in VARS" :key="v" class="var-chip">{{ v }}</code>
      </div>
    </div>

    <!-- Title blocks -->
    <div class="title-blocks-list">
      <div
        v-for="block in doc.titleTemplate"
        :key="block.id"
        class="title-block-item"
        :class="block.type === 'titleSpacer' ? 'spacer-block' : 'line-block'"
      >
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
              <button @click="store.moveTitleBlock(block.id, 'up')">↑</button>
              <button @click="store.moveTitleBlock(block.id, 'down')">↓</button>
              <button @click="store.addTitleBlock('titleLine', block.id)">+рядок</button>
              <button @click="store.addTitleBlock('titleSpacer', block.id)">+відступ</button>
              <button class="btn-danger" @click="store.removeTitleBlock(block.id)">✕</button>
            </div>
          </div>
        </template>

        <!-- LINE -->
        <template v-else>
          <div class="line-row">
            <div class="line-controls">
              <div class="align-btns">
                <button
                  v-for="a in ['left','center','right']"
                  :key="a"
                  :class="['align-btn', { active: (block as TitleLineBlock).align === a }]"
                  @click="store.updateTitleBlock(block.id, { align: a as 'left'|'center'|'right' })"
                >{{ a === 'left' ? '⇤' : a === 'center' ? '⇔' : '⇥' }}</button>
              </div>
              <button
                :class="['bold-btn', { active: (block as TitleLineBlock).bold }]"
                @click="store.updateTitleBlock(block.id, { bold: !(block as TitleLineBlock).bold })"
              >B</button>
            </div>

            <input
              class="block-input line-text-input"
              :value="(block as TitleLineBlock).text"
              @input="store.updateTitleBlock(block.id, { text: ($event.target as HTMLInputElement).value })"
              placeholder="Текст рядка або {{змінна}}"
            />

            <div class="block-actions">
              <button @click="store.moveTitleBlock(block.id, 'up')" title="Вгору">↑</button>
              <button @click="store.moveTitleBlock(block.id, 'down')" title="Вниз">↓</button>
              <button @click="store.addTitleBlock('titleLine', block.id)" title="Рядок після">+L</button>
              <button @click="store.addTitleBlock('titleSpacer', block.id)" title="Відступ після">+S</button>
              <button class="btn-danger" @click="store.removeTitleBlock(block.id)">✕</button>
            </div>
          </div>

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

        <!-- CONTENT BLOCK (any body block embedded in the title) -->
        <template v-if="block.type === 'titleContent'">
          <div class="title-content-wrap">
            <div class="title-content-head">
              <span class="block-type-label">▣ Блок</span>
              <div class="block-actions">
                <button @click="store.moveTitleBlock(block.id, 'up')">↑</button>
                <button @click="store.moveTitleBlock(block.id, 'down')">↓</button>
                <button class="btn-danger" @click="store.removeTitleBlock(block.id)">✕</button>
              </div>
            </div>
            <component
              :is="contentEditors[(block as TitleContentBlock).block.type]"
              :block="(block as TitleContentBlock).block"
              :index="1"
              @update="store.updateTitleContentBlock(block.id, $event)"
              @remove="store.removeTitleBlock(block.id)"
              @duplicate="store.addTitleContentBlock((block as TitleContentBlock).block.type, block.id)"
              @move-up="store.moveTitleBlock(block.id, 'up')"
              @move-down="store.moveTitleBlock(block.id, 'down')"
            />
          </div>
        </template>
      </div>
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
    </div>
  </div>
</template>
