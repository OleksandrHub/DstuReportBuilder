<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { SuperDoc } from '@harbour-enterprises/superdoc'
import '@harbour-enterprises/superdoc/style.css'
import { useReportStore } from '../stores/report'
import { useReport } from '../composables/useReport'
import { useDocxExport } from '../composables/useDocxExport'

import ParagraphBlock from '../components/blocks/ParagraphBlock.vue'
import TextBlock from '../components/blocks/TextBlock.vue'
import HeadingBlock from '../components/blocks/HeadingBlock.vue'
import ListBlockEditor from '../components/blocks/ListBlock.vue'
import CodeBlockEditor from '../components/blocks/CodeBlock.vue'
import ImageBlockEditor from '../components/blocks/ImageBlock.vue'
import TableBlockEditor from '../components/blocks/TableBlock.vue'
import FormulaBlockEditor from '../components/blocks/FormulaBlock.vue'
import PageBreakBlock from '../components/blocks/PageBreakBlock.vue'
import SpacerBlock from '../components/blocks/SpacerBlock.vue'
import TocBlock from '../components/blocks/TocBlock.vue'
import SourcesBlock from '../components/blocks/SourcesBlock.vue'
import ColumnsBlock from '../components/blocks/ColumnsBlock.vue'
import TextToolsBar from '../components/blocks/TextToolsBar.vue'
import BlockInserter from '../components/blocks/BlockInserter.vue'
import TitlePageEditor from '../components/editor/TitlePageEditor.vue'
import TitleTemplateEditor from '../components/editor/TitleTemplateEditor.vue'
import SettingsEditor from '../components/editor/SettingsEditor.vue'

import type { ReportBlock } from '../types/document'

const store = useReportStore()
const { doc } = useReport()
const { exportToDocx, getPreviewBlob } = useDocxExport()

type LeftTab = 'titlepage' | 'titleblocks' | 'blocks' | 'settings'
const leftTab = ref<LeftTab>('titlepage')

async function handleExport() {
  if (!doc.value) return
  await exportToDocx(doc.value)
}

function onUpdateBlock(id: string, data: Partial<ReportBlock>) {
  store.updateBlock(id, data)
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
</script>

<template>
  <div class="app-layout">
    <!-- LEFT: Editor panel -->
    <aside class="editor-panel">
      <div class="panel-header">
        <div class="doc-name-row">
          <input
            class="doc-name-input"
            :value="doc?.name"
            @input="store.renameDocument(doc!.id, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="tab-bar">
          <button :class="['tab', { active: leftTab === 'titlepage' }]" @click="leftTab = 'titlepage'">Дані</button>
          <button :class="['tab', { active: leftTab === 'titleblocks' }]" @click="leftTab = 'titleblocks'">Макет</button>
          <button :class="['tab', { active: leftTab === 'blocks' }]" @click="leftTab = 'blocks'">Блоки</button>
          <button :class="['tab', { active: leftTab === 'settings' }]" @click="leftTab = 'settings'">Стиль</button>
        </div>
      </div>

      <div class="panel-body">
        <div v-if="!store.ready" class="empty-blocks-hint">⏳ Завантаження даних зі сховища…</div>
        <template v-else>
        <TitlePageEditor v-if="leftTab === 'titlepage'" />
        <TitleTemplateEditor v-else-if="leftTab === 'titleblocks'" />
        <SettingsEditor v-else-if="leftTab === 'settings'" />

        <div v-else-if="leftTab === 'blocks'" class="blocks-editor">
          <TextToolsBar />
          <div v-if="doc && doc.blocks.length === 0" class="empty-blocks-hint">
            Документ порожній. Додай перший блок нижче.
          </div>

          <template v-if="doc">
            <BlockInserter v-if="doc.blocks.length" @add="store.addBlock($event, undefined, 'start')" />
            <template v-for="block in doc.blocks" :key="block.id">
              <ParagraphBlock
                v-if="block.type === 'paragraph'"
                :block="block"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @duplicate="store.duplicateBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <TextBlock
                v-else-if="block.type === 'text'"
                :block="block"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @duplicate="store.duplicateBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <HeadingBlock
                v-else-if="block.type === 'heading'"
                :block="block"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @duplicate="store.duplicateBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <ListBlockEditor
                v-else-if="block.type === 'list'"
                :block="block"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @duplicate="store.duplicateBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <CodeBlockEditor
                v-else-if="block.type === 'code'"
                :block="block"
                :index="store.getBlockIndex(block.id, 'code')"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @duplicate="store.duplicateBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <ImageBlockEditor
                v-else-if="block.type === 'image'"
                :block="block"
                :index="store.getBlockIndex(block.id, 'image')"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @duplicate="store.duplicateBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <TableBlockEditor
                v-else-if="block.type === 'table'"
                :block="block"
                :index="store.getBlockIndex(block.id, 'table')"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @duplicate="store.duplicateBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <FormulaBlockEditor
                v-else-if="block.type === 'formula'"
                :block="block"
                :index="store.getBlockIndex(block.id, 'formula')"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @duplicate="store.duplicateBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <PageBreakBlock
                v-else-if="block.type === 'pageBreak'"
                :block="block"
                @remove="store.removeBlock(block.id)"
                @duplicate="store.duplicateBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <SpacerBlock
                v-else-if="block.type === 'spacer'"
                :block="block"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @duplicate="store.duplicateBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <TocBlock
                v-else-if="block.type === 'toc'"
                :block="block"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @duplicate="store.duplicateBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <SourcesBlock
                v-else-if="block.type === 'sources'"
                :block="block"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @duplicate="store.duplicateBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
              <ColumnsBlock
                v-else-if="block.type === 'columns'"
                :block="block"
                @update="onUpdateBlock(block.id, $event)"
                @remove="store.removeBlock(block.id)"
                @duplicate="store.duplicateBlock(block.id)"
                @move-up="store.moveBlock(block.id, 'up')"
                @move-down="store.moveBlock(block.id, 'down')"
              />
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
              <button @click="store.addBlock('pageBreak')">⤓ Нова сторінка</button>
              <button @click="store.addBlock('spacer')">↵ Порожній рядок</button>
            </div>
            <button class="btn-intro-blocks" @click="store.addIntroBlocks()">
              + Тема / Мета / Висновки / Виконання / Варіант
            </button>
          </div>
        </div>
        </template>
      </div>

      <div class="panel-footer">
        <div v-if="store.storageError" class="footer-storage-error" role="alert">⚠ Не вдалося зберегти. Дані лише в памʼяті.</div>
        <button class="btn-export" :disabled="!store.ready" @click="handleExport">⬇ Завантажити .docx</button>
      </div>
    </aside>

    <!-- RIGHT: Live .docx preview (SuperDoc) -->
    <main class="preview-panel">
      <div class="preview-toolbar">
        <span class="preview-label">Перегляд .docx</span>
        <span v-if="previewLoading" class="preview-status">оновлення…</span>
        <button class="preview-refresh" @click="renderPreview" title="Оновити перегляд">⟳</button>
      </div>
      <div class="preview-scroll superdoc-scroll">
        <div v-if="previewError" class="preview-error">⚠ {{ previewError }}</div>
        <div ref="previewRef" class="superdoc-root"></div>
      </div>
    </main>
  </div>
</template>
