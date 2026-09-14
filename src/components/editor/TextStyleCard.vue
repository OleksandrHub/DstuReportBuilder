<script setup lang="ts">
import { computed } from 'vue'
import type { TextStyle, TextAlign } from '../../types/document'
import NumberInput from '../blocks/NumberInput.vue'

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
        <NumberInput
          input-class="field-input"
          :model-value="modelValue.fontSize"
          :default-value="14"
          :min="8" :max="36" :step="1"
          title="Розмір шрифту (pt)"
          aria-label="Розмір шрифту"
          @update:model-value="set('fontSize', $event ?? 14)"
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
        <NumberInput
          input-class="field-input"
          :model-value="modelValue.lineSpacing"
          :default-value="1.5"
          :min="1" :max="3" :step="0.25"
          title="Міжрядковий інтервал"
          aria-label="Міжрядковий інтервал"
          @update:model-value="set('lineSpacing', $event ?? 1.5)"
        />
      </div>
      <div class="field-group">
        <label>Абзац (см)</label>
        <NumberInput
          input-class="field-input"
          :model-value="modelValue.indent"
          :default-value="1.25"
          :min="0" :max="5" :step="0.25"
          title="Абзацний відступ (см)"
          aria-label="Абзацний відступ"
          @update:model-value="set('indent', $event ?? 1.25)"
        />
      </div>
    </div>

    <label class="checkbox-row style-card-bold">
      <input type="checkbox" :checked="modelValue.bold" @change="set('bold', ($event.target as HTMLInputElement).checked)" />
      <span>Жирний</span>
    </label>
  </div>
</template>
