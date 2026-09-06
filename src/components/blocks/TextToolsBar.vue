<script setup lang="ts">
import { ref } from 'vue'
import { useReportStore } from '../../stores/report'

const store = useReportStore()
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

const inputText = ref('')
const outputText = ref('')
const copied = ref(false)

function toUpper() {
  outputText.value = inputText.value.toUpperCase()
}

function toLower() {
  outputText.value = inputText.value.toLowerCase()
}

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

<style scoped>
.text-tools { display: flex; flex-direction: column; gap: 6px; }
.tool-section { display: flex; flex-direction: column; gap: 10px; }
.tool-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.ref-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
  cursor: pointer;
}
</style>

<template>
  <div class="text-tools">
    <h3 class="section-title">🛠 Інструменти тексту</h3>

    <section class="tool-section">
      <h4 class="subsection-title">Пошук і заміна</h4>
      <div class="field-group">
        <label>Знайти</label>
        <input class="field-input" v-model="findText" placeholder="Текст для пошуку…" />
      </div>
      <div class="field-group">
        <label>Замінити на</label>
        <input class="field-input" v-model="replaceText" placeholder="Новий текст…" />
      </div>
      <label class="ref-toggle">
        <input type="checkbox" v-model="caseSensitive" />
        <span>Враховувати регістр</span>
      </label>
      <div class="tool-actions">
        <button class="btn-sm btn-accent" @click="doReplace">↻ Замінити в документі</button>
        <button class="btn-sm" @click="doDash" title="— → –" aria-label="— → –">— → –</button>
      </div>
      <p v-if="status" class="block-hint">{{ status }}</p>
    </section>

    <section class="tool-section">
      <h4 class="subsection-title">Регістр</h4>
      <div class="field-group">
        <label>Вхідний текст</label>
        <textarea
          class="field-textarea"
          v-model="inputText"
          rows="4"
          placeholder="Вставте текст сюди…"
        />
      </div>
      <div class="tool-actions">
        <button class="btn-sm" @click="toUpper">Усі великі</button>
        <button class="btn-sm" @click="toLower">Усі малі</button>
        <button class="btn-sm" @click="escapeMarkers">Екранувати * _ { }</button>
      </div>
      <div class="field-group">
        <label>Результат</label>
        <textarea
          class="field-textarea"
          :value="outputText"
          rows="4"
          readonly
          placeholder="Результат зʼявиться тут…"
        />
      </div>
      <div class="tool-actions">
        <button class="btn-sm" @click="copyOutput" :disabled="!outputText">
          {{ copied ? '✓ Скопійовано' : '⎘ Копіювати' }}
        </button>
      </div>
    </section>
  </div>
</template>
