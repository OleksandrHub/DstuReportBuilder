<script setup lang="ts">
import type { SpacerBlock } from '../../types/document'

const props = defineProps<{ block: SpacerBlock }>()
const emit = defineEmits<{
  update: [data: Partial<SpacerBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()
</script>

<template>
  <div class="block simple-block">
    <div class="block-toolbar">
      <span class="block-type-label">↵ Порожній рядок</span>
      <div class="block-actions">
        <button @click="emit('duplicate')" title="Копіювати" aria-label="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору" aria-label="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз" aria-label="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити" aria-label="Видалити">✕</button>
      </div>
    </div>
    <div class="block-style-row">
      <span class="style-label">Рядків:</span>
      <input
        type="number" min="1" max="20" step="1" class="style-number"
        :value="props.block.lines ?? 1"
        @input="emit('update', { lines: parseInt(($event.target as HTMLInputElement).value) || 1 })"
      />
    </div>
  </div>
</template>
