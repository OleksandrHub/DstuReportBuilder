<script setup lang="ts">
import type { TextBlock } from '../../types/document'
import MarkerHint from './MarkerHint.vue'

const props = defineProps<{ block: TextBlock }>()
const emit = defineEmits<{
  update: [data: Partial<TextBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()
</script>

<template>
  <div class="block text-block">
    <div class="block-toolbar">
      <span class="block-type-label">↳ Текст (без абзацу)</span>
      <div class="block-actions">
        <button @click="emit('duplicate')" title="Копіювати" aria-label="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору" aria-label="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз" aria-label="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити" aria-label="Видалити">✕</button>
      </div>
    </div>
    <textarea
      class="block-textarea"
      :value="props.block.text"
      @input="emit('update', { text: ($event.target as HTMLTextAreaElement).value })"
      rows="2"
      placeholder="Текст, що дописується в кінець попереднього абзацу…"
    />
    <MarkerHint />
  </div>
</template>
