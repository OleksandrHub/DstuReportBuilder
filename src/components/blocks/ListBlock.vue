<script setup lang="ts">
import type { ListBlock } from '../../types/document'
import { useReportStore } from '../../stores/report'
import MarkerHint from './MarkerHint.vue'
import ListItemRow from './ListItemRow.vue'
import BlockStyleRow from './BlockStyleRow.vue'

const BULLET_PRESETS = ['•', '◦', '▪', '–', '—', '*', '·', '‣', '●', '○']

const props = defineProps<{ block: ListBlock }>()
const emit = defineEmits<{
  update: [data: Partial<ListBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()

const store = useReportStore()
</script>

<template>
  <div class="block list-block">
    <div class="block-toolbar">
      <span class="block-type-label">≡ Список</span>
      <div class="list-type-toggle">
        <button
          :class="['level-btn', { active: !props.block.ordered }]"
          @click="emit('update', { ordered: false })"
        >• Марков.</button>
        <button
          :class="['level-btn', { active: props.block.ordered }]"
          @click="emit('update', { ordered: true })"
        >1. Нумер.</button>
      </div>
      <div class="block-actions">
        <button @click="emit('duplicate')" title="Копіювати" aria-label="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору" aria-label="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз" aria-label="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити" aria-label="Видалити">✕</button>
      </div>
    </div>

    <BlockStyleRow :block="props.block" default-align="justify" :show-indent="false" @update="emit('update', $event)" />

    <div v-if="!props.block.ordered" class="block-field-row bullet-field">
      <label>Маркер:</label>
      <input
        class="block-input bullet-input"
        :value="props.block.bulletChar ?? '•'"
        maxlength="3"
        @input="emit('update', { bulletChar: ($event.target as HTMLInputElement).value })"
        placeholder="•"
      />
      <div class="bullet-presets">
        <button
          v-for="b in BULLET_PRESETS"
          :key="b"
          type="button"
          :class="['bullet-preset', { active: (props.block.bulletChar ?? '•') === b }]"
          @click="emit('update', { bulletChar: b })"
          :title="`Маркер списку: ${b}`"
          :aria-label="`Маркер списку: ${b}`"
        >{{ b }}</button>
      </div>
    </div>

    <input
      class="block-input"
      :value="props.block.introText"
      @input="emit('update', { introText: ($event.target as HTMLInputElement).value })"
      placeholder="Вступний текст (необов'язково): "
    />

    <div class="list-items">
      <ListItemRow
        v-for="item in props.block.items"
        :key="item.id"
        :block-id="props.block.id"
        :item="item"
        :depth="0"
        :bullet="props.block.ordered ? undefined : (props.block.bulletChar ?? '•')"
      />
    </div>

    <button class="btn-add-item" @click="store.addListItem(props.block.id)">
      + Додати елемент
    </button>
    <p class="block-hint">⤵ — додати підпункт</p>
    <MarkerHint />
  </div>
</template>

<style scoped>
.bullet-field {
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.bullet-input {
  flex: 0 0 auto;
  width: 48px;
  height: 36px;
  text-align: center;
  font-size: 20px;
  line-height: 1;
  padding: 0;
}
.bullet-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.bullet-preset {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border, #ccc);
  border-radius: 4px;
  background: var(--surface, #fff);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}
.bullet-preset:hover {
  border-color: var(--accent, #4a90d9);
}
.bullet-preset.active {
  border-color: var(--accent, #4a90d9);
  background: var(--accent-soft, #e8f1fb);
}
</style>
