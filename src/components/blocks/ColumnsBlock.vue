<script setup lang="ts">
import type { ColumnsBlock, ReportBlock, ParagraphBlock, HeadingBlock } from '../../types/document'
import { useReportStore } from '../../stores/report'
import BlockStyleRow from './BlockStyleRow.vue'

const props = defineProps<{ block: ColumnsBlock }>()
const emit = defineEmits<{
  update: [data: Partial<ColumnsBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()

const store = useReportStore()

function innerText(b: ReportBlock): string {
  return b.type === 'paragraph' || b.type === 'heading' ? b.text : ''
}

// A styleable inner block (paragraph/heading) exposes the same fields BlockStyleRow needs.
function styleable(b: ReportBlock): ParagraphBlock | HeadingBlock | null {
  return b.type === 'paragraph' || b.type === 'heading' ? b : null
}

function updInner(colId: string, innerId: string, data: Partial<ReportBlock>) {
  store.updateColumnBlock(props.block.id, colId, innerId, data)
}
</script>

<template>
  <div class="block columns-block">
    <div class="block-toolbar">
      <span class="block-type-label">▥ Стовпці ({{ props.block.columns.length }})</span>
      <div class="block-actions">
        <button @click="emit('duplicate')" title="Копіювати" aria-label="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору" aria-label="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз" aria-label="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити" aria-label="Видалити">✕</button>
      </div>
    </div>

    <div class="block-style-row">
      <span class="style-label">Кількість:</span>
      <button
        v-for="n in [2, 3, 4]"
        :key="n"
        :class="['style-btn', { active: props.block.columns.length === n }]"
        @click="store.setColumnCount(props.block.id, n)"
      >{{ n }}</button>
    </div>

    <div class="columns-editor">
      <div v-for="col in props.block.columns" :key="col.id" class="column-edit">
        <div class="column-head">
          <span class="style-label">Ширина %:</span>
          <input
            type="number" min="5" max="95" step="1" class="style-number"
            :value="col.width"
            @input="store.setColumnWidth(props.block.id, col.id, parseInt(($event.target as HTMLInputElement).value) || 50)"
          />
        </div>

        <div v-for="inner in col.blocks" :key="inner.id" class="column-inner">
          <template v-if="styleable(inner)">
            <textarea
              class="block-textarea"
              rows="2"
              :value="innerText(inner)"
              @input="updInner(col.id, inner.id, { text: ($event.target as HTMLTextAreaElement).value } as never)"
              :placeholder="inner.type === 'heading' ? 'Заголовок…' : 'Текст…'"
            />
            <BlockStyleRow
              :block="styleable(inner)!"
              :default-align="inner.type === 'heading' ? 'center' : 'left'"
              :style-kind="inner.type === 'heading' ? 'heading' : 'paragraph'"
              :heading-level="inner.type === 'heading' ? inner.level : undefined"
              @update="updInner(col.id, inner.id, $event)"
            />
          </template>
          <div v-else class="block-hint">[{{ inner.type }}]</div>
          <button class="btn-icon btn-danger column-inner-del" @click="store.removeColumnBlock(props.block.id, col.id, inner.id)" title="Видалити блок зі стовпця" aria-label="Видалити блок зі стовпця">✕</button>
        </div>

        <div class="column-add">
          <button class="btn-small" @click="store.addColumnBlock(props.block.id, col.id, 'paragraph')">+ Абзац</button>
          <button class="btn-small" @click="store.addColumnBlock(props.block.id, col.id, 'heading')">+ Заголовок</button>
        </div>
      </div>
    </div>
    <p class="block-hint">Стовпці рендеряться як таблиця без рамок. Підтримуються абзаци й заголовки.</p>
  </div>
</template>
