<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { SuperDoc } from '@harbour-enterprises/superdoc'
import '@harbour-enterprises/superdoc/style.css'
import { useReportStore } from '../stores/report'
import { useReport } from '../composables/useReport'
import { useDocxExport } from '../composables/useDocxExport'
import { useToast } from '../composables/useToast'
import { useMobilePane } from '../composables/useMobilePane'
import { downloadJsonFile } from '../stores/document-io'

import BlockRenderer from '../components/blocks/BlockRenderer.vue'
import MoveToMenu from '../components/blocks/MoveToMenu.vue'
import TextToolsBar from '../components/blocks/TextToolsBar.vue'
import BlockInserter from '../components/blocks/BlockInserter.vue'
import TitlePageEditor from '../components/editor/TitlePageEditor.vue'
import TitleTemplateEditor from '../components/editor/TitleTemplateEditor.vue'
import SettingsEditor from '../components/editor/SettingsEditor.vue'

import type { ReportBlock } from '../types/document'
import { blockTypeName, blockSummary } from '../utils/block-labels'

const store = useReportStore()
const { doc } = useReport()
const { exportToDocx, getPreviewBlob } = useDocxExport()
const toast = useToast()
const { mobilePane } = useMobilePane()

type LeftTab = 'titlepage' | 'titleblocks' | 'blocks' | 'tools' | 'settings'
const leftTab = ref<LeftTab>('titlepage')

interface TabMeta {
  key: LeftTab
  icon: string
  label: string
  hint: string
}

// Tab presentation: icon + full name + a one-line explanation under the bar,
// so similarly-named tabs (Макроси vs Титулки) are unambiguous.
const TABS: TabMeta[] = [
  {
    key: 'titlepage',
    icon: '{{ }}',
    label: 'Макроси',
    hint: 'Значення змінних {{…}} для титульної сторінки',
  },
  {
    key: 'titleblocks',
    icon: '📰',
    label: 'Титулки',
    hint: 'Макет титульної сторінки: рядки, відступи, блоки',
  },
  {
    key: 'blocks',
    icon: '📄',
    label: 'Основний контент',
    hint: 'Розділи, текст, рисунки, таблиці, формули, джерела',
  },
  {
    key: 'tools',
    icon: '🛠',
    label: 'Інструменти',
    hint: 'Пошук і заміна, тире, регістр тексту',
  },
  {
    key: 'settings',
    icon: '⚙',
    label: 'Налаштування документу',
    hint: 'Стилі, поля, шрифти, колонтитули, нумерація',
  },
]

const activeTabHint = computed(() => TABS.find(t => t.key === leftTab.value)?.hint ?? '')

async function handleExport() {
  if (!doc.value) return
  await exportToDocx(doc.value)
}

function handleJsonExport() {
  if (!doc.value) return
  const res = store.exportDocumentFile(doc.value.id)
  if (!res) return
  downloadJsonFile(res.filename, res.json)
  toast.success(`Документ збережено в ${res.filename}`)
}

function formatSavedTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function onUpdateBlock(id: string, data: Partial<ReportBlock>) {
  store.updateBlock(id, data)
}

// --- Collapsible content outline (endless-scroll relief for long docs) ---
// UI-only state: which blocks are folded. Body stays mounted (v-show),
// so inputs keep focus and state.
const collapsedBlocks = ref<Record<string, boolean>>({})

function toggleBlockCollapse(id: string) {
  collapsedBlocks.value[id] = !collapsedBlocks.value[id]
}

function setAllBlocksCollapsed(value: boolean) {
  if (!doc.value) return
  for (const b of doc.value.blocks) {
    collapsedBlocks.value[b.id] = value
    // Groups have no outer header (their own head serves as the header),
    // so collapse-all drives their persisted flag instead.
    if (b.type === 'group' && b.collapsed !== value) {
      store.updateBlock(b.id, { collapsed: value })
    }
  }
}

// Relocation menu: which top-level block's "move to…" picker is open.
const moveMenuFor = ref<string | null>(null)

// Multi-select for grouping: ids of top-level non-group blocks.
// UI-only state (cleared after grouping).
const selectedIds = ref<Set<string>>(new Set())

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function clearSelection() {
  selectedIds.value = new Set()
}

function groupSelection() {
  const id = store.groupSelectedBlocks([...selectedIds.value])
  clearSelection()
  if (id) toast.success('Блоки згруповано — задай групі назву')
  else toast.info('Вибери щонайменше 2 блоки')
}

// ===== Live docx preview (SuperDoc) =====
const previewRef = ref<HTMLElement | null>(null)
const previewError = ref<string | null>(null)
const previewLoading = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let renderToken = 0
let superdoc: SuperDoc | null = null

function destroySuperdoc() {
  if (superdoc) {
    try { (superdoc as unknown as { destroy?: () => void }).destroy?.() } catch { /* ignore */ }
    superdoc = null
  }
}

async function renderPreview() {
  if (!doc.value || !previewRef.value) return
  const token = ++renderToken
  previewLoading.value = true
  previewError.value = null
  try {
    const blob = await getPreviewBlob(doc.value)
    if (token !== renderToken || !previewRef.value) return // superseded
    const file = new File([blob], `${doc.value.name || 'document'}.docx`, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    destroySuperdoc()
    // Clear the mount node between renders.
    previewRef.value.innerHTML = ''

    superdoc = new SuperDoc({
      selector: previewRef.value,
      document: file,
      documentMode: 'viewing',
      role: 'viewer',
      disablePiniaDevtools: false,
      onReady: () => {
        if (token === renderToken) previewLoading.value = false
      },
      onContentError: ({ error }) => {
        if (token === renderToken) {
          previewError.value = (error as Error)?.message ?? 'Помилка рендеру документа'
          previewLoading.value = false
        }
      },
    })
  } catch (e) {
    if (token === renderToken) {
      previewError.value = (e as Error)?.message ?? 'Помилка рендеру'
      previewLoading.value = false
    }
  }
}

function scheduleRender() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(renderPreview, 500)
}

onMounted(async () => {
  await nextTick()
  renderPreview()
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  destroySuperdoc()
})

// Re-render whenever the active document changes (deep).
watch(doc, scheduleRender, { deep: true })

// A hidden pane has zero size, so SuperDoc renders blank into it.
// Re-render after switching to the preview pane (DOM is visible by then).
watch(mobilePane, (pane) => {
  if (pane === 'preview') nextTick(() => renderPreview())
})
</script>

<template>
  <div class="app-layout">
    <!-- LEFT: Editor panel -->
    <aside class="editor-panel" :class="{ 'mobile-hidden': mobilePane !== 'editor' }">
      <div class="panel-header">
        <div class="doc-name-row">
          <input
            class="doc-name-input"
            :value="doc?.name"
            @input="store.renameDocument(doc!.id, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="tab-bar" role="tablist" aria-label="Розділи редактора">
          <button
            v-for="t in TABS"
            :key="t.key"
            :class="['tab', { active: leftTab === t.key }]"
            role="tab"
            :aria-selected="leftTab === t.key"
            :title="`${t.label} — ${t.hint}`"
            :aria-label="`${t.label} — ${t.hint}`"
            @click="leftTab = t.key"
          >
            <span class="tab-icon" aria-hidden="true">{{ t.icon }}</span>
            <span class="tab-label">{{ t.label }}</span>
          </button>
        </div>
        <div class="tab-hint" aria-hidden="true">{{ activeTabHint }}</div>
      </div>

      <div class="panel-body">
        <div v-if="!store.ready" class="empty-blocks-hint">⏳ Завантаження даних зі сховища…</div>
        <template v-else>
        <TitlePageEditor v-if="leftTab === 'titlepage'" />
        <TitleTemplateEditor v-else-if="leftTab === 'titleblocks'" />
        <SettingsEditor v-else-if="leftTab === 'settings'" />

        <div v-else-if="leftTab === 'blocks'" class="blocks-editor">
          <div v-if="doc && doc.blocks.length === 0" class="empty-blocks-hint">
            Документ порожній. Додай перший блок нижче.
          </div>

          <template v-if="doc">
            <div v-if="doc.blocks.length > 1" class="collapse-all-row">
              <span class="collapse-count">Блоків: {{ doc.blocks.length }}</span>
              <span class="collapse-all-spacer"></span>
              <button class="btn-sm" @click="setAllBlocksCollapsed(true)" title="Згорнути всі блоки до заголовків" aria-label="Згорнути всі блоки до заголовків">Згорнути все</button>
              <button class="btn-sm" @click="setAllBlocksCollapsed(false)" title="Розгорнути всі блоки" aria-label="Розгорнути всі блоки">Розгорнути все</button>
            </div>
            <BlockInserter v-if="doc.blocks.length" @add="store.addBlock($event, undefined, 'start')" />
            <div v-if="selectedIds.size > 0" class="selection-bar" role="status">
              <span>Вибрано: {{ selectedIds.size }}</span>
              <button
                class="btn-sm btn-accent"
                :disabled="selectedIds.size < 2"
                :title="selectedIds.size < 2 ? 'Вибери щонайменше 2 блоки' : 'Обʼєднати вибрані блоки в нову групу'"
                @click="groupSelection()"
              >▤ Згрупувати</button>
              <button class="btn-sm" @click="clearSelection()" title="Скасувати вибір" aria-label="Скасувати вибір">✕</button>
            </div>
            <template v-for="block in doc.blocks" :key="block.id">
              <!-- Groups render with their own head (no outer outline header —
                   it would duplicate the group's title bar). -->
              <BlockRenderer
                v-if="block.type === 'group'"
                :block="block"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @duplicate="store.duplicateBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <div v-else class="content-block-wrap" :class="{ collapsed: !!collapsedBlocks[block.id] }">
                <div class="collapse-head">
                  <input
                    type="checkbox"
                    class="select-checkbox"
                    :checked="selectedIds.has(block.id)"
                    @change="toggleSelect(block.id)"
                    title="Вибрати для групування"
                    aria-label="Вибрати блок для групування"
                  />
                  <button
                    class="collapse-toggle"
                    @click="toggleBlockCollapse(block.id)"
                    :aria-expanded="!collapsedBlocks[block.id]"
                    :title="collapsedBlocks[block.id] ? 'Розгорнути блок' : 'Згорнути блок'"
                  >
                    <span class="collapse-chevron" aria-hidden="true">{{ collapsedBlocks[block.id] ? '▸' : '▾' }}</span>
                    <span class="collapse-title">{{ blockTypeName(block) }}</span>
                    <span class="collapse-summary">{{ blockSummary(block) }}</span>
                  </button>
                  <div class="collapse-mini">
                    <button @click="store.moveBlock(block.id, 'up')" title="Перемістити вгору" aria-label="Перемістити вгору">↑</button>
                    <button @click="store.moveBlock(block.id, 'down')" title="Перемістити вниз" aria-label="Перемістити вниз">↓</button>
                    <button
                      :class="{ toggled: moveMenuFor === block.id }"
                      @click="moveMenuFor = moveMenuFor === block.id ? null : block.id"
                      title="Перенести блок у групу" aria-label="Перенести блок у групу"
                    >⤵</button>
                  </div>
                </div>
                <MoveToMenu
                  v-if="moveMenuFor === block.id"
                  :block-id="block.id"
                  :source-group-id="null"
                  @done="moveMenuFor = null"
                />
                <div v-show="!collapsedBlocks[block.id]" class="collapse-body">
                  <BlockRenderer
                    :block="block"
                    @update="onUpdateBlock(block.id, $event)"
                    @remove="store.removeBlock(block.id)"
                    @duplicate="store.duplicateBlock(block.id)"
                    @move-up="store.moveBlock(block.id, 'up')"
                    @move-down="store.moveBlock(block.id, 'down')"
                  />
                </div>
              </div>
              <BlockInserter @add="store.addBlock($event, block.id)" />
            </template>
          </template>

          <div class="add-block-panel">
            <span class="add-label">Додати блок:</span>
            <div class="add-block-buttons">
              <button @click="store.addBlock('paragraph')">¶ Абзац</button>
              <button @click="store.addBlock('text')">↳ Текст</button>
              <button @click="store.addBlock('heading')">H Заголовок</button>
              <button @click="store.addBlock('list')">≡ Список</button>
              <button @click="store.addBlock('code')">{ } Код</button>
              <button @click="store.addBlock('image')">🖼 Рисунок</button>
              <button @click="store.addBlock('table')">⊞ Таблиця</button>
              <button @click="store.addBlock('formula')">∑ Формула</button>
              <button @click="store.addBlock('toc')">☰ Зміст</button>
              <button @click="store.addBlock('sources')">📚 Джерела</button>
              <button @click="store.addBlock('columns')">▥ Стовпці</button>
              <button @click="store.addBlock('group')">▤ Група</button>
              <button @click="store.addBlock('pageBreak')">⤓ Нова сторінка</button>
              <button @click="store.addBlock('spacer')">↵ Порожній рядок</button>
            </div>
            <button class="btn-intro-blocks" @click="store.addIntroBlocks()">
              + Тема / Мета / Висновки / Виконання / Варіант
            </button>
          </div>
        </div>
        <div v-else-if="leftTab === 'tools'" class="tools-tab">
          <h3 class="section-title">Інструменти тексту</h3>
          <TextToolsBar expanded />
        </div>
        </template>
      </div>

      <div class="panel-footer">
        <div v-if="store.storageError" class="footer-storage-error" role="alert">⚠ Не вдалося зберегти. Дані лише в памʼяті.</div>
        <div
          v-else class="footer-saved"
          :title="store.lastSavedAt ? `Останнє збереження: ${store.lastSavedAt}` : 'Очікування першого збереження'"
        >
          <template v-if="!store.ready">⏳ Завантаження…</template>
          <template v-else-if="store.lastSavedAt">
            💾 Збережено {{ formatSavedTime(store.lastSavedAt) }} · {{ store.storageBackend === 'indexeddb' ? 'IndexedDB' : 'localStorage' }}
          </template>
          <template v-else>💾 Готується…</template>
        </div>
        <div class="footer-btn-row">
          <button class="btn-export" :disabled="!store.ready" @click="handleExport">⬇ Завантажити .docx</button>
          <button
            class="btn-json"
            :disabled="!store.ready || !doc"
            @click="handleJsonExport"
            title="Зберегти поточний документ у JSON-файл (повний бекап — у «Мої роботи»)" aria-label="Зберегти поточний документ у JSON-файл (повний бекап — у «Мої роботи»)"
          >⬇ JSON</button>
        </div>
      </div>
    </aside>

    <!-- RIGHT: Live .docx preview (SuperDoc) -->
    <main class="preview-panel" :class="{ 'mobile-hidden': mobilePane !== 'preview' }">
      <div class="preview-toolbar">
        <span class="preview-label">Перегляд .docx</span>
        <span v-if="previewLoading" class="preview-status">оновлення…</span>
        <button class="preview-refresh" @click="renderPreview" title="Оновити перегляд" aria-label="Оновити перегляд">⟳</button>
      </div>
      <div class="preview-scroll superdoc-scroll">
        <div v-if="previewError" class="preview-error">⚠ {{ previewError }}</div>
        <div ref="previewRef" class="superdoc-root"></div>
      </div>
    </main>
  </div>
</template>
