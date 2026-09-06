<script setup lang="ts">
import type { HeadingBlock } from '../../types/document'
import MarkerHint from './MarkerHint.vue'
import BlockStyleRow from './BlockStyleRow.vue'

const props = defineProps<{ block: HeadingBlock }>()
const emit = defineEmits<{
  update: [data: Partial<HeadingBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()
</script>

<template>
  <div class="block heading-block">
    <div class="block-toolbar">
      <span class="block-type-label">H Заголовок</span>
      <div class="heading-level-select">
        <button
          v-for="lvl in [1, 2, 3]"
          :key="lvl"
          :class="['level-btn', { active: props.block.level === lvl }]"
          @click="emit('update', { level: lvl as 1|2|3 })"
        >H{{ lvl }}</button>
      </div>
      <div class="block-actions">
        <button @click="emit('duplicate')" title="Копіювати" aria-label="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору" aria-label="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз" aria-label="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити" aria-label="Видалити">✕</button>
      </div>
    </div>
    <input
      class="block-input heading-input"
      :value="props.block.text"
      @input="emit('update', { text: ($event.target as HTMLInputElement).value })"
      placeholder="Текст заголовка"
    />
    <MarkerHint />

    <BlockStyleRow
      :block="props.block" default-align="center"
      style-kind="heading" :heading-level="props.block.level"
      @update="emit('update', $event)"
    />
  </div>
</template>
