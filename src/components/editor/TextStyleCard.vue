<script setup lang="ts">
import { computed } from 'vue'
import type { TextStyle, TextAlign } from '../../types/document'

const props = withDefaults(
  defineProps<{
    title: string
    badge: string
    sample: string
    modelValue: TextStyle
    baseFontFamily?: string
  }>(),
  { baseFontFamily: 'Times New Roman' },
)

const emit = defineEmits<{
  update: [data: Partial<TextStyle>]
}>()

const fontOptions = ['Times New Roman', 'Arial', 'Calibri', 'Georgia']
const alignOptions: { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'Зліва' },
  { value: 'center', label: 'По центру' },
  { value: 'right', label: 'Справа' },
  { value: 'justify', label: 'По ширині' },
]

const effFont = computed(() => props.modelValue.fontFamily || props.baseFontFamily)

const previewStyle = computed(() => ({
  fontFamily: effFont.value,
  fontSize: `${(props.modelValue.fontSize * 96) / 72}px`,
  color: `#${props.modelValue.color}`,
  fontWeight: props.modelValue.bold ? 700 : 400,
  textAlign: props.modelValue.align,
  lineHeight: props.modelValue.lineSpacing,
  textIndent: props.modelValue.align === 'center' || props.modelValue.align === 'right'
    ? undefined
    : `${props.modelValue.indent}cm`,
}))

function set<K extends keyof TextStyle>(key: K, value: TextStyle[K]) {
  emit('update', { [key]: value } as Partial<TextStyle>)
}

function num(e: Event): number | undefined {
  const v = parseFloat((e.target as HTMLInputElement).value)
  return Number.isFinite(v) ? v : undefined
}
</script>

<template>
  <div class="style-card">
    <div class="style-card-head">
      <span class="style-card-badge">{{ badge }}</span>
      <span class="style-card-title">{{ title }}</span>
    </div>

    <div class="style-card-preview" :style="previewStyle">{{ sample }}</div>

    <div class="style-card-grid">
      <div class="field-group">
        <label>Шрифт</label>
        <select class="field-input" :value="modelValue.fontFamily" @change="set('fontFamily', ($event.target as HTMLSelectElement).value)">
          <option value="">Основний ({{ baseFontFamily }})</option>
          <option v-for="f in fontOptions" :key="f" :value="f">{{ f }}</option>
        </select>
      </div>
      <div class="field-group">
        <label>Розмір (pt)</label>
        <input
          class="field-input" type="number" min="8" max="36" step="1"
          :value="modelValue.fontSize"
          @input="set('fontSize', num($event) ?? modelValue.fontSize)"
        />
      </div>
      <div class="field-group">
        <label>Колір</label>
        <div class="color-row">
          <input
            type="color" class="style-color"
            :value="'#' + modelValue.color"
            @input="set('color', ($event.target as HTMLInputElement).value.replace('#', '').toUpperCase())"
          />
          <span class="color-hex">#{{ modelValue.color }}</span>
        </div>
      </div>
      <div class="field-group">
        <label>Вирівнювання</label>
        <select class="field-input" :value="modelValue.align" @change="set('align', ($event.target as HTMLSelectElement).value as TextAlign)">
          <option v-for="a in alignOptions" :key="a.value" :value="a.value">{{ a.label }}</option>
        </select>
      </div>
      <div class="field-group">
        <label>Інтервал</label>
        <input
          class="field-input" type="number" min="1" max="3" step="0.25"
          :value="modelValue.lineSpacing"
          @input="set('lineSpacing', num($event) ?? modelValue.lineSpacing)"
        />
      </div>
      <div class="field-group">
        <label>Абзац (см)</label>
        <input
          class="field-input" type="number" min="0" max="5" step="0.25"
          :value="modelValue.indent"
          @input="set('indent', num($event) ?? modelValue.indent)"
        />
      </div>
    </div>

    <label class="checkbox-row style-card-bold">
      <input type="checkbox" :checked="modelValue.bold" @change="set('bold', ($event.target as HTMLInputElement).checked)" />
      <span>Жирний</span>
    </label>
  </div>
</template>
