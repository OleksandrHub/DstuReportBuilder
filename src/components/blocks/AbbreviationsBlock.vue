<script setup lang="ts">
import { ref } from 'vue'
import type { AbbreviationsBlock, AbbreviationEntry } from '../../types/document'
import { DEFAULT_ABBREVIATIONS_TITLE } from '../../types/document'
import { generateId } from '../../stores/factories'
import BlockStyleRow from './BlockStyleRow.vue'

const props = defineProps<{ block: AbbreviationsBlock }>()
const emit = defineEmits<{
  update: [data: Partial<AbbreviationsBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()

function setEntries(entries: AbbreviationEntry[]) {
  emit('update', { entries })
}

function updEntry(id: string, data: Partial<AbbreviationEntry>) {
  setEntries(props.block.entries.map(e => (e.id === id ? { ...e, ...data } : e)))
}

function addEntry() {
  setEntries([...props.block.entries, { id: generateId(), term: '', definition: '' }])
}

function removeEntry(id: string) {
  setEntries(props.block.entries.filter(e => e.id !== id))
}

function moveEntry(id: string, dir: -1 | 1) {
  const list = [...props.block.entries]
  const i = list.findIndex(e => e.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j]!, list[i]!]
  setEntries(list)
}

// Bulk paste: one entry per line, "ТЕРМІН – розшифрування" (also "—", "-", ":"
// or a tab as the separator). Pasted entries are appended; empty rows dropped.
const pasteOpen = ref(false)
const pasteText = ref('')
function applyPaste() {
  const parsed = pasteText.value
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const m = /^(.+?)(?:\s+[–—-]\s+|\s*:\s+|\t+)(.+)$/.exec(l)
      return { id: generateId(), term: (m ? m[1]! : l).trim(), definition: (m ? m[2]! : '').trim() }
    })
  const kept = props.block.entries.filter(e => e.term.trim() || e.definition.trim())
  setEntries([...kept, ...parsed])
  pasteText.value = ''
  pasteOpen.value = false
}
</script>

<template>
  <div class="block abbreviations-block">
    <div class="block-toolbar">
      <span class="block-type-label">🔤 Скорочення й позначення</span>
      <div class="block-actions">
        <button @click="emit('duplicate')" title="Копіювати" aria-label="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору" aria-label="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз" aria-label="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити" aria-label="Видалити">✕</button>
      </div>
    </div>

    <div class="block-field-row">
      <label>Заголовок:</label>
      <input
        class="block-input"
        :value="props.block.title"
        @input="emit('update', { title: ($event.target as HTMLInputElement).value })"
        :placeholder="DEFAULT_ABBREVIATIONS_TITLE"
      />
    </div>
    <label class="ref-toggle">
      <input
        type="checkbox"
        :checked="props.block.sorted !== false"
        @change="emit('update', { sorted: ($event.target as HTMLInputElement).checked })"
      />
      <span>За абеткою (у документі)</span>
    </label>

    <div v-for="e in props.block.entries" :key="e.id" class="abbr-row">
      <input
        class="block-input abbr-term"
        :value="e.term"
        @input="updEntry(e.id, { term: ($event.target as HTMLInputElement).value })"
        placeholder="ДСТУ"
        aria-label="Скорочення або позначення"
      />
      <span class="abbr-dash">–</span>
      <input
        class="block-input"
        :value="e.definition"
        @input="updEntry(e.id, { definition: ($event.target as HTMLInputElement).value })"
        placeholder="державний стандарт України"
        aria-label="Розшифрування"
      />
      <button class="btn-icon" @click="moveEntry(e.id, -1)" title="Вгору" aria-label="Вгору">↑</button>
      <button class="btn-icon" @click="moveEntry(e.id, 1)" title="Вниз" aria-label="Вниз">↓</button>
      <button class="btn-icon btn-danger" @click="removeEntry(e.id)" title="Видалити" aria-label="Видалити">✕</button>
    </div>

    <div class="tool-actions">
      <button class="btn-add-item" @click="addEntry">+ Додати</button>
      <button class="btn-sm" @click="pasteOpen = !pasteOpen">⇩ Вставити списком</button>
    </div>
    <template v-if="pasteOpen">
      <textarea
        class="block-textarea"
        v-model="pasteText"
        rows="4"
        placeholder="ДСТУ – державний стандарт України&#10;ПЗ – програмне забезпечення"
      />
      <button class="btn-sm btn-accent" @click="applyPaste" :disabled="!pasteText.trim()">Додати з тексту</button>
    </template>

    <BlockStyleRow :block="props.block" default-align="justify" :show-indent="false" @update="emit('update', $event)" />
  </div>
</template>

<style scoped>
.abbr-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.abbr-term { flex: 0 0 28%; min-width: 0; }
.abbr-dash { color: var(--color-text-muted); }
.tool-actions { display: flex; gap: 6px; flex-wrap: wrap; margin: 4px 0; }
</style>
