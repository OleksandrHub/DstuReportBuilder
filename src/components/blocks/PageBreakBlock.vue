<script setup lang="ts">
import type { PageBreakBlock } from '../../types/document'

defineProps<{ block: PageBreakBlock }>()
const emit = defineEmits<{
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()
</script>

<template>
  <div class="block simple-block">
    <div class="block-toolbar">
      <span class="block-type-label">⤓ Розрив сторінки</span>
      <div class="block-actions">
        <button @click="emit('duplicate')" title="Копіювати" aria-label="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору" aria-label="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз" aria-label="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити" aria-label="Видалити">✕</button>
      </div>
    </div>
    <p class="block-hint">Наступний блок почнеться з нової сторінки.</p>
  </div>
</template>
