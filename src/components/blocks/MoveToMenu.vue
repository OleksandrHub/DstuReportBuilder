<script setup lang="ts">
import { computed } from 'vue'
import type { GroupBlock } from '../../types/document'
import { useReportStore } from '../../stores/report'
import { useToast } from '../../composables/useToast'

// Destination picker for relocating a block across containers.
// sourceGroupId === null → the block sits at the body top level;
// otherwise it sits inside that group. Title-embedded groups are out of
// scope (the title layout is edited in place).
const props = defineProps<{
  blockId: string
  sourceGroupId: string | null
}>()

const emit = defineEmits<{
  done: []
}>()

const store = useReportStore()
const toast = useToast()

const groups = computed(() =>
  (store.activeDocument?.blocks ?? []).filter((b): b is GroupBlock => b.type === 'group'),
)
const destinations = computed(() => groups.value.filter(g => g.id !== props.sourceGroupId))

function moveToGroup(id: string) {
  const g = groups.value.find(x => x.id === id)
  const ok = props.sourceGroupId
    ? store.moveInnerBlockToGroup(props.sourceGroupId, props.blockId, id)
    : store.moveBlockToGroup(props.blockId, id)
  if (ok) toast.success(`Переміщено в групу «${g?.title || 'Без назви'}»`)
  else toast.error('Не вдалося перемістити блок')
  emit('done')
}

function moveOut() {
  if (!props.sourceGroupId) return
  const ok = store.moveInnerBlockOut(props.sourceGroupId, props.blockId)
  if (ok) toast.success('Блок винесено з групи (після неї)')
  else toast.error('Не вдалося перемістити блок')
  emit('done')
}
</script>

<template>
  <div class="move-menu" role="menu" aria-label="Перенести блок в…">
    <div class="move-menu-title">Перенести в…</div>
    <button v-if="sourceGroupId" class="move-menu-item" @click="moveOut()">
      ⤴ Назовні (після групи)
    </button>
    <button
      v-for="g in destinations"
      :key="g.id"
      class="move-menu-item"
      @click="moveToGroup(g.id)"
    >
      ▤ {{ g.title || 'Без назви' }} ({{ g.blocks.length }})
    </button>
    <div v-if="destinations.length === 0 && !sourceGroupId" class="block-hint">
      Немає груп — створи групу кнопкою «▤ Група».
    </div>
    <button class="move-menu-item move-menu-cancel" @click="emit('done')">✕ Скасувати</button>
  </div>
</template>
