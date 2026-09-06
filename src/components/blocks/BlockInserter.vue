<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ReportBlock } from '../../types/document'

// Renders a thin "+" line that, when clicked, reveals block-type buttons and
// emits the chosen type. The parent passes afterId to control insert position.
const props = withDefaults(defineProps<{ exclude?: ReportBlock['type'][] }>(), {
  exclude: () => [],
})
const emit = defineEmits<{ add: [type: ReportBlock['type']] }>()
const open = ref(false)

const types: { type: ReportBlock['type']; label: string }[] = [
  { type: 'paragraph', label: '¶ Абзац' },
  { type: 'text', label: '↳ Текст' },
  { type: 'heading', label: 'H Заголовок' },
  { type: 'list', label: '≡ Список' },
  { type: 'code', label: '{ } Код' },
  { type: 'image', label: '🖼 Рисунок' },
  { type: 'table', label: '⊞ Таблиця' },
  { type: 'formula', label: '∑ Формула' },
  { type: 'toc', label: '☰ Зміст' },
  { type: 'sources', label: '📚 Джерела' },
  { type: 'columns', label: '▥ Стовпці' },
  { type: 'group', label: '▤ Група' },
  { type: 'pageBreak', label: '⤓ Сторінка' },
  { type: 'spacer', label: '↵ Рядок' },
]

const visibleTypes = computed(() => types.filter(t => !props.exclude.includes(t.type)))

function pick(t: ReportBlock['type']) {
  emit('add', t)
  open.value = false
}
</script>

<template>
  <div class="block-inserter">
    <button v-if="!open" class="inserter-line" @click="open = true" title="Вставити блок тут" aria-label="Вставити блок тут">
      <span class="inserter-plus">+</span>
    </button>
    <div v-else class="inserter-menu">
      <button v-for="t in visibleTypes" :key="t.type" class="inserter-btn" @click="pick(t.type)">{{ t.label }}</button>
      <button class="inserter-btn inserter-cancel" @click="open = false">✕</button>
    </div>
  </div>
</template>
