<script setup lang="ts">
import { ref } from 'vue'
import type { GroupBlock, ReportBlock } from '../../types/document'
import { useReportStore } from '../../stores/report'
import { useToast } from '../../composables/useToast'
import { blockTypeName, blockSummary } from '../../utils/block-labels'
import BlockRenderer from './BlockRenderer.vue'
import BlockInserter from './BlockInserter.vue'
import MoveToMenu from './MoveToMenu.vue'

const props = withDefaults(
  defineProps<{
    block: GroupBlock
    // Title layout embeds groups via titleContent: relocation across body
    // groups makes no sense there, so the move UI is hidden.
    context?: 'body' | 'title'
    // Fixed caption number forwarded to inner figures (title shows №1).
    indexOverride?: number
  }>(),
  { context: 'body' },
)
const emit = defineEmits<{
  update: [data: Partial<GroupBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()

const store = useReportStore()
const toast = useToast()
const addType = ref<ReportBlock['type']>('paragraph')
// Relocation menu: which inner block's "move to…" picker is open.
const innerMoveFor = ref<string | null>(null)
// UI-only folding of inner blocks (same outline pattern as the document).
const innerCollapsed = ref<Record<string, boolean>>({})

function toggleInner(innerId: string) {
  innerCollapsed.value[innerId] = !innerCollapsed.value[innerId]
}

function ungroup() {
  if (store.ungroupGroup(props.block.id)) toast.success('Групу розформовано — блоки лишилися на місці')
  else toast.error('Не вдалося розформувати групу')
}

// Every body-block type except 'group' itself (no nesting).
const innerTypes: { type: ReportBlock['type']; label: string }[] = [
  { type: 'paragraph', label: 'Абзац' },
  { type: 'heading', label: 'Заголовок' },
  { type: 'text', label: 'Текст' },
  { type: 'list', label: 'Список' },
  { type: 'code', label: 'Код' },
  { type: 'image', label: 'Рисунок' },
  { type: 'table', label: 'Таблиця' },
  { type: 'formula', label: 'Формула' },
  { type: 'toc', label: 'Зміст' },
  { type: 'sources', label: 'Джерела' },
  { type: 'columns', label: 'Стовпці' },
  { type: 'pageBreak', label: 'Нова сторінка' },
  { type: 'spacer', label: 'Відступ' },
]

function addInner(afterId?: string) {
  store.addGroupBlock(props.block.id, addType.value, afterId)
}
</script>

<template>
  <div class="block group-block">
    <div class="group-head">
      <button
        :class="['group-toggle', { collapsed: props.block.collapsed }]"
        @click="emit('update', { collapsed: !props.block.collapsed })"
        :aria-expanded="!props.block.collapsed"
        :title="props.block.collapsed ? 'Розгорнути групу' : 'Згорнути групу'"
      >{{ props.block.collapsed ? '▸' : '▾' }}</button>
      <input
        class="block-input group-title-input"
        :value="props.block.title"
        @input="emit('update', { title: ($event.target as HTMLInputElement).value })"
        placeholder="Назва групи"
        title="Назва групи — лише для орієнтації, в .docx не друкується"
      />
      <span class="group-count" :title="`${props.block.blocks.length} блоків у групі`">
        {{ props.block.blocks.length }}
      </span>
      <div class="block-actions">
        <button @click="ungroup()" title="Розформувати групу (блоки лишаться на місці)" aria-label="Розформувати групу (блоки лишаться на місці)">⤴</button>
        <button @click="emit('duplicate')" title="Копіювати" aria-label="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору" aria-label="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз" aria-label="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити" aria-label="Видалити">✕</button>
      </div>
    </div>

    <div v-show="!props.block.collapsed" class="group-body">
      <div v-if="props.block.blocks.length === 0" class="empty-blocks-hint">
        Група порожня. Додай блоки нижче.
      </div>
      <template v-for="inner in props.block.blocks" :key="inner.id">
        <div class="group-inner-fold" :class="{ collapsed: !!innerCollapsed[inner.id] }">
          <div class="collapse-head">
            <button
              class="collapse-toggle"
              @click="toggleInner(inner.id)"
              :aria-expanded="!innerCollapsed[inner.id]"
              :title="innerCollapsed[inner.id] ? 'Розгорнути блок' : 'Згорнути блок'"
            >
              <span class="collapse-chevron" aria-hidden="true">{{ innerCollapsed[inner.id] ? '▸' : '▾' }}</span>
              <span class="collapse-title">{{ blockTypeName(inner) }}</span>
              <span class="collapse-summary">{{ blockSummary(inner) }}</span>
            </button>
          </div>
          <div v-show="!innerCollapsed[inner.id]" class="collapse-body">
            <BlockRenderer
              :block="inner"
              :index-override="indexOverride"
              @update="store.updateGroupBlock(props.block.id, inner.id, $event)"
              @remove="store.removeGroupBlock(props.block.id, inner.id)"
              @duplicate="store.duplicateGroupBlock(props.block.id, inner.id)"
              @move-up="store.moveGroupBlock(props.block.id, inner.id, 'up')"
              @move-down="store.moveGroupBlock(props.block.id, inner.id, 'down')"
            />
          </div>
        </div>
        <BlockInserter :exclude="['group']" @add="store.addGroupBlock(props.block.id, $event, inner.id)" />
        <button
          v-if="props.context !== 'title' && innerMoveFor !== inner.id"
          class="btn-add-item move-toggle-full"
          @click="innerMoveFor = inner.id"
          title="Перенести блок в іншу групу або назовні" aria-label="Перенести блок в іншу групу або назовні"
        >⤵ Перенести…</button>
        <MoveToMenu
          v-else-if="props.context !== 'title'"
          :block-id="inner.id"
          :source-group-id="props.block.id"
          @done="innerMoveFor = null"
        />
      </template>
      <div class="group-add-row">
        <select v-model="addType" class="block-select" title="Тип блока">
          <option v-for="t in innerTypes" :key="t.type" :value="t.type">{{ t.label }}</option>
        </select>
        <button class="btn-small" @click="addInner()">+ Додати в групу</button>
      </div>
    </div>
  </div>
</template>
