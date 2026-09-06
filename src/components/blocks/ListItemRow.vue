<script setup lang="ts">
import type { ListItem } from '../../types/document'
import { useReportStore } from '../../stores/report'

// Recursive editor for one list item and its nested sub-items.
const props = defineProps<{ blockId: string; item: ListItem; depth: number; bullet?: string }>()
const store = useReportStore()
</script>

<template>
  <div class="list-item-tree" :style="{ marginLeft: props.depth ? '16px' : '0' }">
    <div class="list-item-row">
      <span class="list-marker">{{ props.depth ? '◦' : (props.bullet || '•') }}</span>
      <input
        class="block-input list-item-input"
        :value="props.item.text"
        @input="store.updateListItem(props.blockId, props.item.id, ($event.target as HTMLInputElement).value)"
        placeholder="елемент списку…"
      />
      <button class="btn-icon" @click="store.addSiblingListItem(props.blockId, props.item.id)" title="Додати пункт поруч" aria-label="Додати пункт поруч">＋</button>
      <button class="btn-icon" @click="store.addSubListItem(props.blockId, props.item.id)" title="Додати підпункт" aria-label="Додати підпункт">⤵</button>
      <button class="btn-icon btn-danger" @click="store.removeListItem(props.blockId, props.item.id)" title="Видалити пункт" aria-label="Видалити пункт">✕</button>
    </div>
    <ListItemRow
      v-for="child in props.item.children"
      :key="child.id"
      :block-id="props.blockId"
      :item="child"
      :depth="props.depth + 1"
    />
  </div>
</template>
