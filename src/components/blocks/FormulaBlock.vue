<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import type { FormulaBlock } from '../../types/document'
import MarkerHint from './MarkerHint.vue'
import BlockStyleRow from './BlockStyleRow.vue'

const props = defineProps<{ block: FormulaBlock; index: number }>()
const emit = defineEmits<{
  update: [data: Partial<FormulaBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()

const previewHtml = ref('')
const previewError = ref('')

function renderPreview() {
  previewError.value = ''
  try {
    previewHtml.value = katex.renderToString(props.block.latex || '', {
      throwOnError: true, displayMode: true, output: 'html',
    })
  } catch (e) {
    previewError.value = (e as Error)?.message ?? 'Помилка формули'
    previewHtml.value = ''
  }
}

onMounted(renderPreview)
watch(() => props.block.latex, renderPreview)
</script>

<template>
  <div class="block formula-block">
    <div class="block-toolbar">
      <span class="block-type-label">∑ Формула {{ props.index }}</span>
      <div class="block-actions">
        <button @click="emit('duplicate')" title="Копіювати" aria-label="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору" aria-label="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз" aria-label="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити" aria-label="Видалити">✕</button>
      </div>
    </div>

    <textarea
      class="block-textarea code-textarea"
      :value="props.block.latex"
      @input="emit('update', { latex: ($event.target as HTMLTextAreaElement).value })"
      rows="3"
      spellcheck="false"
      placeholder="LaTeX, напр. \frac{-b \pm \sqrt{b^2-4ac}}{2a}"
    />
    <p class="block-hint">Мова LaTeX: \frac{a}{b}, x^2, \sqrt{x}, \sum, \int, \alpha …</p>

    <div class="formula-preview">
      <div v-if="previewError" class="block-hint md-error">{{ previewError }}</div>
      <div v-else v-html="previewHtml"></div>
    </div>

    <label class="ref-toggle">
      <input
        type="checkbox"
        :checked="props.block.numbered !== false"
        @change="emit('update', { numbered: ($event.target as HTMLInputElement).checked })"
      />
      <span>Нумерувати формулу (номер справа)</span>
    </label>
    <label class="ref-toggle">
      <input type="checkbox" :checked="!!props.block.noTrailingSpace"
        @change="emit('update', { noTrailingSpace: ($event.target as HTMLInputElement).checked })" />
      <span>Без порожнього рядка знизу</span>
    </label>

    <div class="block-field-row">
      <label>Підпис (необов'язково):</label>
      <input
        class="block-input"
        :value="props.block.caption"
        @input="emit('update', { caption: ($event.target as HTMLInputElement).value })"
        placeholder="Назва формули"
      />
    </div>

    <label class="ref-toggle">
      <input
        type="checkbox"
        :checked="props.block.referenceText !== '' && props.block.referenceText != null"
        @change="emit('update', { referenceText: ($event.target as HTMLInputElement).checked ? 'Розрахунок виконано за формулою {no}.' : '' })"
      />
      <span>Показувати посилання в тексті</span>
    </label>
    <template v-if="props.block.referenceText">
      <div class="block-field-row">
        <label>Текст посилання:</label>
        <input
          class="block-input"
          :value="props.block.referenceText"
          @input="emit('update', { referenceText: ($event.target as HTMLInputElement).value })"
          placeholder="Розрахунок виконано за формулою {no}."
        />
      </div>
      <p class="block-hint">{no} — підставиться номер формули</p>
      <label class="ref-toggle">
        <input
          type="checkbox"
          :checked="!!props.block.inlineReference"
          @change="emit('update', { inlineReference: ($event.target as HTMLInputElement).checked })"
        />
        <span>Продовжити попередній абзац (без нового рядка)</span>
      </label>
    </template>

    <MarkerHint />

    <p class="block-hint">Форматування підпису / посилання:</p>
    <BlockStyleRow :block="props.block" default-align="left" :show-indent="false" @update="emit('update', $event)" />
  </div>
</template>
