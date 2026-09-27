<script setup lang="ts">
import { computed } from 'vue'
import type { AppendixBlock } from '../../types/document'
import { appendixLetter } from '../../types/document'
import MarkerHint from './MarkerHint.vue'
import RefLabelField from './RefLabelField.vue'

// index: 1-based position among the document's appendices.
const props = defineProps<{ block: AppendixBlock; index: number }>()
const emit = defineEmits<{
  update: [data: Partial<AppendixBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()

const letter = computed(() => appendixLetter(Math.max(0, props.index - 1)))
</script>

<template>
  <div class="block simple-block">
    <div class="block-toolbar">
      <span class="block-type-label">📎 Додаток {{ letter }}</span>
      <div class="block-actions">
        <button @click="emit('duplicate')" title="Копіювати" aria-label="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору" aria-label="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз" aria-label="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити" aria-label="Видалити">✕</button>
      </div>
    </div>
    <div class="block-field-row">
      <label>Заголовок:</label>
      <input
        class="block-input"
        :value="props.block.title"
        @input="emit('update', { title: ($event.target as HTMLInputElement).value })"
        placeholder="Лістинг програми"
      />
    </div>
    <MarkerHint />
    <RefLabelField
      :label="props.block.label"
      placeholder="напр. код (посилання дасть літеру додатка)"
      @update="emit('update', { label: $event })"
    />
    <p class="block-hint">
      Починається з нової сторінки. Усі блоки нижче (до наступного додатка) належать
      до нього: рисунки, таблиці, лістинги й формули нумеруються {{ letter }}.1, {{ letter }}.2…
    </p>
  </div>
</template>
