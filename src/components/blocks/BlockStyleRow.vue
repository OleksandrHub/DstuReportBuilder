<script setup lang="ts">
import { useReportStore } from '../../stores/report'
import { resolveHeadingStyle, resolveBodyStyle } from '../../types/document'
import type { TextStyle } from '../../types/document'

interface StyleProps {
  align?: 'left' | 'center' | 'right' | 'justify'
  bold?: boolean
  fontSize?: number
  fontFamily?: string
  lineSpacing?: number
  indent?: number
  color?: string
}

const store = useReportStore()
const props = withDefaults(
  defineProps<{
    block: StyleProps
    defaultAlign?: 'left' | 'center' | 'right' | 'justify'
    showIndent?: boolean
    /** Which global style this row inherits from when block fields are unset. */
    styleKind?: 'paragraph' | 'heading' | 'base'
    headingLevel?: 1 | 2 | 3
  }>(),
  { showIndent: true, styleKind: 'base' },
)
const emit = defineEmits<{ update: [data: Partial<StyleProps>] }>()

const s = () => store.activeDocument?.settings

// Effective fallback: global heading/body style, or base document settings
// for caption-like usages (image, code, table, …).
function fallback(): TextStyle {
  const st = s()
  if (props.styleKind === 'heading') return resolveHeadingStyle(st, props.headingLevel ?? 1)
  if (props.styleKind === 'paragraph') return resolveBodyStyle(st)
  return {
    fontFamily: st?.fontFamily ?? 'Times New Roman',
    fontSize: st?.fontSize ?? 14,
    color: '000000',
    bold: false,
    align: props.defaultAlign ?? 'justify',
    lineSpacing: st?.lineSpacing ?? 1.5,
    indent: st?.paragraphIndent ?? 1.25,
  }
}

const fontSize = () => props.block.fontSize ?? fallback().fontSize
const lineSpacing = () => props.block.lineSpacing ?? fallback().lineSpacing
const fontFamily = () => props.block.fontFamily ?? fallback().fontFamily
const indent = () => props.block.indent ?? fallback().indent
const color = () => '#' + (props.block.color ?? fallback().color)
const effAlign = () => props.block.align ?? fallback().align

function setColor(hex: string) {
  emit('update', { color: hex.replace('#', '').toUpperCase() })
}
</script>

<template>
  <div class="block-style-row">
    <!-- Align -->
    <div class="style-group">
      <button
        v-for="a in (['left','center','right','justify'] as const)"
        :key="a"
        :class="['style-btn', { active: effAlign() === a }]"
        @click="emit('update', { align: a })"
        :title="a === 'left' ? 'Зліва' : a === 'center' ? 'По центру' : a === 'right' ? 'Справа' : 'По ширині'"
        :aria-label="a === 'left' ? 'Вирівняти зліва' : a === 'center' ? 'Вирівняти по центру' : a === 'right' ? 'Вирівняти справа' : 'Вирівняти по ширині'"
      >{{ a === 'left' ? '⇤' : a === 'center' ? '⇔' : a === 'right' ? '⇥' : '≡' }}</button>
    </div>

    <!-- Bold -->
    <button
      :class="['style-btn', { active: props.block.bold }]"
      @click="emit('update', { bold: !props.block.bold })"
      title="Жирний" aria-label="Жирний"
    ><b>B</b></button>

    <!-- Font family -->
    <select
      class="style-select"
      :value="fontFamily()"
      @change="emit('update', { fontFamily: ($event.target as HTMLSelectElement).value || undefined })"
      title="Шрифт"
    >
      <option value="">авто</option>
      <option value="Times New Roman">Times New Roman</option>
      <option value="Courier New">Courier New</option>
      <option value="Arial">Arial</option>
      <option value="Calibri">Calibri</option>
    </select>

    <!-- Font size -->
    <input
      type="number" min="8" max="36" step="1"
      class="style-number"
      :value="fontSize()"
      @input="emit('update', { fontSize: parseInt(($event.target as HTMLInputElement).value) || undefined })"
      title="Розмір шрифту (pt)"
    />
    <span class="style-unit">pt</span>

    <!-- Line spacing -->
    <input
      type="number" min="1" max="3" step="0.5"
      class="style-number"
      :value="lineSpacing()"
      @input="emit('update', { lineSpacing: parseFloat(($event.target as HTMLInputElement).value) || undefined })"
      title="Міжрядковий інтервал"
    />
    <span class="style-unit">інт</span>

    <!-- First-line indent (only for block types that support it) -->
    <template v-if="props.showIndent">
      <input
        type="number" min="0" max="5" step="0.25"
        class="style-number"
        :value="indent()"
        @input="emit('update', { indent: parseFloat(($event.target as HTMLInputElement).value) })"
        title="Абзацний відступ (см)"
      />
      <span class="style-unit">см</span>
    </template>

    <!-- Text color -->
    <input
      type="color"
      class="style-color"
      :value="color()"
      @input="setColor(($event.target as HTMLInputElement).value)"
      title="Колір тексту"
    />

    <!-- Reset to global style / doc defaults -->
    <button
      class="style-btn"
      @click="emit('update', { fontSize: undefined, fontFamily: undefined, lineSpacing: undefined, indent: undefined, color: undefined })"
      :title="props.styleKind === 'base' ? 'Скинути до налаштувань документа' : 'Скинути до глобального стилю'"
    >↺</button>
  </div>
</template>
