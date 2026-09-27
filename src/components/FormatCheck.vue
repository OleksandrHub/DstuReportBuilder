<script setup lang="ts">
import { computed, ref } from 'vue'
import { useReportStore } from '../stores/report'
import { checkDocument, FIXES, type FormatIssue, type IssueFix } from '../utils/format-check'

// "Перевірка оформлення": runs on demand (not live — long documents), lists
// issues; clicking one jumps to its block, typography issues have one-click
// document-wide fixes.
const emit = defineEmits<{ go: [blockId: string] }>()
const store = useReportStore()

const issues = ref<FormatIssue[] | null>(null)
const status = ref('')

function run() {
  const doc = store.activeDocument
  issues.value = doc ? checkDocument(doc) : []
  status.value = ''
}

const fixable = computed(() => {
  const kinds = new Set<IssueFix>()
  for (const i of issues.value ?? []) if (i.fix) kinds.add(i.fix)
  return [...kinds]
})

function fix(kind: IssueFix) {
  const n = store.transformAllText(FIXES[kind].apply, false)
  run()
  status.value = n > 0 ? `Виправлено в ${n} полях` : 'Нічого не змінено'
}
</script>

<template>
  <section class="format-check">
    <h3 class="section-title">✔ Перевірка оформлення</h3>
    <p class="block-hint">
      Шукає: рисунки/таблиці/лістинги без назви чи посилання в тексті, биті {ref:…} і {cite:…},
      прямі лапки, дефіс замість тире, подвійні пробіли, крапки після заголовків.
    </p>
    <div class="tool-actions">
      <button class="btn-sm btn-accent" @click="run">▶ Перевірити документ</button>
      <button v-for="k in fixable" :key="k" class="btn-sm" @click="fix(k)">Виправити: {{ FIXES[k].label }}</button>
    </div>
    <p v-if="status" class="block-hint">{{ status }}</p>

    <template v-if="issues">
      <p v-if="issues.length === 0" class="check-ok">Проблем не знайдено 🎉</p>
      <template v-else>
        <p class="block-hint">Знайдено: {{ issues.length }}. Натисни, щоб перейти до блоку.</p>
        <ul class="check-list">
          <li v-for="(i, n) in issues" :key="n">
            <button class="check-item" @click="emit('go', i.blockId)">
              <span class="check-where">{{ i.where }}</span>
              <span class="check-msg">{{ i.message }}</span>
            </button>
          </li>
        </ul>
      </template>
    </template>
  </section>
</template>

<style scoped>
.format-check { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.tool-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.check-ok { margin: 0; font-size: 13px; }
.check-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.check-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface2);
  color: var(--color-text);
  cursor: pointer;
}
.check-item:hover { border-color: var(--color-accent); }
.check-where { font-size: 11px; color: var(--color-text-muted); }
.check-msg { font-size: 12px; }
</style>
