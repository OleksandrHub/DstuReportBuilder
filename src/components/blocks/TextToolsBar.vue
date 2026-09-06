<script setup lang="ts">
import { ref } from 'vue'
import { useReportStore } from '../../stores/report'

const props = withDefaults(defineProps<{ expanded?: boolean }>(), { expanded: false })

const store = useReportStore()
const open = ref(props.expanded)
const findText = ref('')
const replaceText = ref('')
const caseSensitive = ref(false)
const status = ref('')

function doReplace() {
  const n = store.replaceAllText(findText.value, replaceText.value, caseSensitive.value)
  status.value = n > 0 ? `Замінено в ${n} полях` : 'Збігів не знайдено'
}

function doDash() {
  const n = store.emDashToEnDash()
  status.value = n > 0 ? `Виправлено тире в ${n} полях` : 'Довгих тире не знайдено'
}

// --- Converter: input → output ---
const inputText = ref('')
const outputText = ref('')
const copied = ref(false)

function toUpper() {
  outputText.value = inputText.value.toUpperCase()
}

function toLower() {
  outputText.value = inputText.value.toLowerCase()
}

// Escape inline markers so they render literally (e.g. ___ → \_\_\_).
function escapeMarkers() {
  outputText.value = inputText.value.replace(/([*_`\\{}])/g, '\\$1')
}

async function copyOutput() {
  try {
    await navigator.clipboard.writeText(outputText.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch { /* ignore */ }
}
</script>

<template>
  <div class="text-tools">
    <button v-if="!expanded" class="text-tools-toggle" @click="open = !open">
      {{ open ? '✕ Інструменти тексту' : '🛠 Інструменти тексту' }}
    </button>
    <div v-if="open || expanded" class="text-tools-panel">
      <div class="text-tools-row">
        <input class="block-input" v-model="findText" placeholder="Знайти" />
        <input class="block-input" v-model="replaceText" placeholder="Замінити на" />
      </div>
      <label class="ref-toggle">
        <input type="checkbox" v-model="caseSensitive" />
        <span>Враховувати регістр</span>
      </label>
      <div class="text-tools-row">
        <button class="btn-small" @click="doReplace">Замінити в усьому документі</button>
        <button class="btn-small" @click="doDash" title="— → –" aria-label="— → –">— → – (тире)</button>
      </div>
      <p v-if="status" class="block-hint">{{ status }}</p>

      <hr class="text-tools-sep" />

      <label class="block-hint">Перетворювач (вставка → результат):</label>
      <textarea
        class="block-textarea"
        v-model="inputText"
        rows="4"
        placeholder="Вставте текст сюди…"
      />
      <div class="text-tools-row">
        <button class="btn-small" @click="toUpper" title="усі літери великі" aria-label="усі літери великі">текст → ВЕЛИКІ</button>
        <button class="btn-small" @click="toLower" title="усі літери малі" aria-label="усі літери малі">ТЕКСТ → малі</button>
        <button class="btn-small" @click="escapeMarkers" title="\\ перед * _ ` { }" aria-label="\\ перед * _ ` { }">Екранувати маркери</button>
      </div>
      <textarea
        class="block-textarea"
        :value="outputText"
        rows="4"
        readonly
        placeholder="Результат…"
      />
      <div class="text-tools-row">
        <button class="btn-small" @click="copyOutput" :disabled="!outputText">
          {{ copied ? '✓ Скопійовано' : '⎘ Копіювати результат' }}
        </button>
      </div>
    </div>
  </div>
</template>
