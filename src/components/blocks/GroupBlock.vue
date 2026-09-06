<script setup lang="ts">
import { ref } from 'vue'
import type { GroupBlock, ReportBlock } from '../../types/document'
import { useReportStore } from '../../stores/report'
import BlockRenderer from './BlockRenderer.vue'
import BlockInserter from './BlockInserter.vue'

const props = defineProps<{ block: GroupBlock }>()
const emit = defineEmits<{
  update: [data: Partial<GroupBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()

const store = useReportStore()
const addType = ref<ReportBlock['type']>('paragraph')

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
        <button @click="emit('duplicate')" title="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити">✕</button>
      </div>
    </div>

    <div v-show="!props.block.collapsed" class="group-body">
      <div v-if="props.block.blocks.length === 0" class="empty-blocks-hint">
        Група порожня. Додай блоки нижче.
      </div>
      <template v-for="inner in props.block.blocks" :key="inner.id">
        <BlockRenderer
          :block="inner"
          @update="store.updateGroupBlock(props.block.id, inner.id, $event)"
          @remove="store.removeGroupBlock(props.block.id, inner.id)"
          @duplicate="store.duplicateGroupBlock(props.block.id, inner.id)"
          @move-up="store.moveGroupBlock(props.block.id, inner.id, 'up')"
          @move-down="store.moveGroupBlock(props.block.id, inner.id, 'down')"
        />
        <BlockInserter :exclude="['group']" @add="store.addGroupBlock(props.block.id, $event, inner.id)" />
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
