<script setup lang="ts">
import { ref, watch } from 'vue'

// Числове поле, яке не заважає вводити:
// - поки юзер стирає/друкує, локальний текст не перезаписується стором;
// - дефолт підставляється лише на blur, коли поле лишилось порожнім/невалідним;
// - порожнє поле під час вводу емітить undefined (батько нічого не пише поверх).
const props = withDefaults(
  defineProps<{
    modelValue?: number
    defaultValue: number
    min?: number
    max?: number
    step?: number | string
    placeholder?: string
    title?: string
    ariaLabel?: string
    inputClass?: string
    allowEmpty?: boolean // true = на blur лишити порожнім (undefined), не підставляти дефолт
  }>(),
  { step: 1, inputClass: 'style-number', allowEmpty: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: number | undefined]
}>()

const draft = ref(props.modelValue !== undefined ? String(props.modelValue) : props.allowEmpty ? '' : String(props.defaultValue))
const focused = ref(false)

// Синхронізація ззовні — але НЕ під час фокусу, щоб не перебивати ввід
// (саме це ламало поле ширини 400: стер → стор одразу повернув 400).
watch(
  () => props.modelValue,
  (v) => {
    if (focused.value) return
    if (v !== undefined) draft.value = String(v)
    else draft.value = props.allowEmpty ? '' : String(props.defaultValue)
  },
)
watch(
  () => props.defaultValue,
  (v) => {
    if (!focused.value && props.modelValue === undefined && !props.allowEmpty) draft.value = String(v)
  },
)

function parseDraft(): number | undefined {
  const t = draft.value.trim().replace(',', '.')
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

function clamp(n: number): number {
  let v = n
  if (props.min !== undefined) v = Math.max(props.min, v)
  if (props.max !== undefined) v = Math.min(props.max, v)
  return v
}

function onInput(e: Event) {
  draft.value = (e.target as HTMLInputElement).value
  const parsed = parseDraft()
  if (parsed === undefined) {
    // Порожньо/невалідно під час вводу — повідомляємо undefined,
    // батько НЕ має одразу писати дефолт поверх.
    emit('update:modelValue', undefined)
    return
  }
  emit('update:modelValue', clamp(parsed))
}

function onBlur() {
  focused.value = false
  const parsed = parseDraft()
  if (parsed === undefined) {
    if (props.allowEmpty) {
      emit('update:modelValue', undefined)
      return
    }
    // Юзер нічого не ввів і поле втратило фокус — лише тут підставляємо дефолт.
    draft.value = String(props.defaultValue)
    emit('update:modelValue', props.defaultValue)
    return
  }
  const c = clamp(parsed)
  draft.value = String(c)
  if (c !== props.modelValue) emit('update:modelValue', c)
}

function onFocus() {
  focused.value = true
}
</script>

<template>
  <input
    type="number"
    :class="props.inputClass"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    :placeholder="props.placeholder"
    :title="props.title"
    :aria-label="props.ariaLabel"
    v-model="draft"
    @input="onInput"
    @blur="onBlur"
    @focus="onFocus"
  />
</template>
