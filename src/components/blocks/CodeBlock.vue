<script setup lang="ts">
import type { CodeBlock } from '../../types/document'
import MarkerHint from './MarkerHint.vue'
import RefLabelField from './RefLabelField.vue'
import NumberInput from './NumberInput.vue'

const props = defineProps<{ block: CodeBlock; index: number }>()
const emit = defineEmits<{
  update: [data: Partial<CodeBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()

const languages = ['typescript', 'javascript', 'python', 'java', 'c', 'cpp', 'csharp', 'sql', 'bash', 'html', 'css']
</script>

<template>
  <div class="block code-block">
    <div class="block-toolbar">
      <span class="block-type-label">{ } Код (Лістинг {{ props.index }})</span>
      <div class="block-actions">
        <button @click="emit('duplicate')" title="Копіювати" aria-label="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору" aria-label="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз" aria-label="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити" aria-label="Видалити">✕</button>
      </div>
    </div>

    <RefLabelField :label="props.block.label" @update="emit('update', { label: $event })" />

    <label class="ref-toggle">
      <input
        type="checkbox"
        :checked="props.block.referenceText !== ''"
        @change="emit('update', { referenceText: ($event.target as HTMLInputElement).checked ? 'Код програми подано у лістингу {no}.' : '' })"
      />
      <span>Показувати посилання в тексті</span>
    </label>
    <template v-if="props.block.referenceText !== ''">
      <div class="block-field-row">
        <label>Текст посилання:</label>
        <input
          class="block-input"
          :value="props.block.referenceText"
          @input="emit('update', { referenceText: ($event.target as HTMLInputElement).value })"
          placeholder="Код програми подано у лістингу {no}."
        />
      </div>
      <p class="block-hint">{no} — підставиться номер лістингу</p>
      <label class="ref-toggle">
        <input
          type="checkbox"
          :checked="!!props.block.inlineReference"
          @change="emit('update', { inlineReference: ($event.target as HTMLInputElement).checked })"
        />
        <span>Продовжити попередній абзац (без нового рядка)</span>
      </label>
    </template>

    <div class="block-field-row">
      <label>Підпис лістингу:</label>
      <input
        class="block-input"
        :value="props.block.caption"
        @input="emit('update', { caption: ($event.target as HTMLInputElement).value })"
        placeholder="Назва лістингу"
      />
    </div>
    <MarkerHint />

    <div class="block-field-row">
      <label>Мова:</label>
      <select
        class="block-select"
        :value="props.block.language"
        @change="emit('update', { language: ($event.target as HTMLSelectElement).value })"
      >
        <option v-for="lang in languages" :key="lang" :value="lang">{{ lang }}</option>
      </select>
    </div>

    <div class="block-style-row">
      <select class="style-select"
        :value="props.block.fontFamily ?? 'Courier New'"
        @change="emit('update', { fontFamily: ($event.target as HTMLSelectElement).value || undefined })"
        title="Шрифт"
      >
        <option value="Courier New">Courier New</option>
        <option value="Consolas">Consolas</option>
        <option value="Times New Roman">Times New Roman</option>
        <option value="Arial">Arial</option>
        <option value="Calibri">Calibri</option>
      </select>
      <span class="style-label">Розмір:</span>
      <NumberInput
        :model-value="props.block.fontSize ?? 12"
        :default-value="12"
        :min="8" :max="24" :step="1"
        title="Розмір шрифту (pt)"
        aria-label="Розмір шрифту коду"
        @update:model-value="emit('update', { fontSize: $event ?? 12 })"
      />
      <span class="style-unit">pt</span>
      <span class="style-label">Інтервал:</span>
      <NumberInput
        :model-value="props.block.lineSpacing ?? 1.0"
        :default-value="1.0"
        :min="1" :max="3" :step="0.5"
        title="Міжрядковий інтервал"
        aria-label="Міжрядковий інтервал коду"
        @update:model-value="emit('update', { lineSpacing: $event ?? 1.0 })"
      />
      <button :class="['style-btn', { active: props.block.bold }]"
        @click="emit('update', { bold: !props.block.bold })" title="Жирний" aria-label="Жирний"><b>B</b></button>
      <input type="color" class="style-color"
        :value="'#' + (props.block.color ?? '000000')"
        @input="emit('update', { color: ($event.target as HTMLInputElement).value.replace('#','').toUpperCase() })"
        title="Колір тексту"
      />
    </div>
    <label class="ref-toggle">
      <input type="checkbox" :checked="!!props.block.noTrailingSpace"
        @change="emit('update', { noTrailingSpace: ($event.target as HTMLInputElement).checked })" />
      <span>Без порожнього рядка знизу</span>
    </label>
    <div class="space-after-row" v-if="props.block.referenceText">
      <span class="style-label">Рядків після посилання в тексті:</span>
      <NumberInput
        :model-value="props.block.spaceAfterReference ?? (props.block as { spaceAfterCaption?: number }).spaceAfterCaption ?? 1"
        :default-value="1"
        :min="0" :max="5" :step="1"
        title="Кількість порожніх рядків між посиланням у тексті та лістингом"
        aria-label="Рядків після посилання в тексті"
        @update:model-value="emit('update', { spaceAfterReference: $event ?? 1 })"
      />
    </div>

    <textarea
      class="block-textarea code-textarea"
      :value="props.block.code"
      @input="emit('update', { code: ($event.target as HTMLTextAreaElement).value })"
      rows="10"
      spellcheck="false"
      placeholder="// Код програми..."
    />
  </div>
</template>
