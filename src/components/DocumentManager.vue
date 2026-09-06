<script setup lang="ts">
import { ref } from 'vue'
import { useReportStore } from '../stores/report'

const store = useReportStore()
const newDocName = ref('')
const renamingId = ref<string | null>(null)
const renameValue = ref('')

function startCreate() {
  if (!store.ready) return
  const name = newDocName.value.trim() || `Лабораторна робота №${store.documents.length + 1}`
  store.createNewDocument(name)
  newDocName.value = ''
}

function startRename(id: string, currentName: string) {
  renamingId.value = id
  renameValue.value = currentName
}

function confirmRename() {
  if (renamingId.value) {
    store.renameDocument(renamingId.value, renameValue.value.trim() || 'Без назви')
    renamingId.value = null
  }
}

function confirmDelete(id: string, name: string) {
  if (confirm(`Видалити «${name}»?`)) {
    store.deleteDocument(id)
  }
}
</script>

<template>
  <div class="doc-manager">
    <h3 class="section-title">Мої роботи</h3>

    <div v-if="!store.ready" class="empty-blocks-hint">⏳ Завантаження…</div>
    <div v-else class="doc-list">
      <div
        v-for="doc in store.documents"
        :key="doc.id"
        :class="['doc-item', { active: store.activeDocumentId === doc.id }]"
        @click="store.setActiveDocument(doc.id)"
      >
        <div class="doc-item-info">
          <template v-if="renamingId === doc.id">
            <input
              class="rename-input"
              v-model="renameValue"
              @keydown.enter="confirmRename"
              @keydown.escape="renamingId = null"
              @blur="confirmRename"
              autofocus
              @click.stop
            />
          </template>
          <template v-else>
            <span class="doc-item-name">{{ doc.name }}</span>
            <span class="doc-item-date">{{ new Date(doc.updatedAt).toLocaleDateString('uk-UA') }}</span>
          </template>
        </div>
        <div class="doc-item-actions" @click.stop>
          <button class="btn-icon" @click="startRename(doc.id, doc.name)" title="Перейменувати">✎</button>
          <button class="btn-icon" @click="store.duplicateDocument(doc.id)" title="Дублювати">⎘</button>
          <button class="btn-icon btn-danger" @click="confirmDelete(doc.id, doc.name)" title="Видалити">✕</button>
        </div>
      </div>
    </div>

    <div class="new-doc-row">
      <input
        class="field-input"
        v-model="newDocName"
        placeholder="Назва нової роботи..."
        :disabled="!store.ready"
        @keydown.enter="startCreate"
      />
      <button class="btn-primary" :disabled="!store.ready" @click="startCreate">+ Нова</button>
    </div>
  </div>
</template>
