<script setup lang="ts">
import { computed, ref } from 'vue'

// Label for cross-references: writing {ref:<label>} in any text field puts
// this object's number there (see inlineRuns in docx/text-runs.ts).
const props = defineProps<{ label?: string; placeholder?: string }>()
const emit = defineEmits<{ update: [label: string] }>()

const token = computed(() => (props.label?.trim() ? `{ref:${props.label.trim()}}` : ''))
const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(token.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch { /* ignore */ }
}
</script>

<template>
  <div class="block-field-row">
    <label>Мітка:</label>
    <input
      class="block-input"
      :value="props.label"
      @input="emit('update', ($event.target as HTMLInputElement).value)"
      :placeholder="props.placeholder ?? 'напр. схема (для посилань з тексту)'"
    />
    <button v-if="token" class="btn-sm" @click="copy" :title="`Скопіювати ${token}`" :aria-label="`Скопіювати ${token}`">
      {{ copied ? '✓' : '⎘' }}
    </button>
  </div>
  <p v-if="token" class="block-hint">
    У будь-якому тексті пиши <code>{{ token }}</code> — підставиться номер, навіть після перестановки блоків.
  </p>
</template>
