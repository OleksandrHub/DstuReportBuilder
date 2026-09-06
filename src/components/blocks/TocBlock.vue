<script setup lang="ts">
import type { TocBlock } from '../../types/document'
import BlockStyleRow from './BlockStyleRow.vue'

const props = defineProps<{ block: TocBlock }>()
const emit = defineEmits<{
  update: [data: Partial<TocBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()
</script>

<template>
  <div class="block simple-block">
    <div class="block-toolbar">
      <span class="block-type-label">☰ Зміст</span>
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
        placeholder="Зміст"
      />
    </div>
    <BlockStyleRow :block="props.block" default-align="center" :show-indent="false" @update="emit('update', $event)" />
    <p class="block-hint">
      Збирається автоматично із заголовків (H1–H3).
      Номери сторінок — це поля: <b>Word</b> оновлює сам при відкритті;
      у <b>OnlyOffice</b> натисніть ПКМ по номеру → «Оновити поле» (або Ctrl+A, F9).
    </p>
  </div>
</template>
