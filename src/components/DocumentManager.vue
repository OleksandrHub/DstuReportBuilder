<script setup lang="ts">
import { ref } from 'vue'
import { useReportStore } from '../stores/report'
import ConfirmDialog from './ConfirmDialog.vue'
import { useToast } from '../composables/useToast'
import { downloadJsonFile, type ImportMode } from '../stores/document-io'

const store = useReportStore()
const toast = useToast()
const newDocName = ref('')
const renamingId = ref<string | null>(null)
const renameValue = ref('')

const backupInput = ref<HTMLInputElement | null>(null)
const pendingImportText = ref<string | null>(null)
const showImportDialog = ref(false)
const pendingDeleteId = ref<string | null>(null)
const pendingDeleteName = ref('')

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
  pendingDeleteId.value = id
  pendingDeleteName.value = name
}

function doDelete() {
  if (pendingDeleteId.value) {
    store.deleteDocument(pendingDeleteId.value)
    toast.success(`Документ «${pendingDeleteName.value}» видалено`)
    pendingDeleteId.value = null
  }
}

// --- Full backup export / import (JSON) ---

function handleBackup() {
  const { filename, json } = store.exportBackupFile()
  downloadJsonFile(filename, json)
  toast.success(`Бекап збережено: ${filename}`)
}

function onRestoreFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 4 * 1024 * 1024) {
    toast.info('Великий файл — імпорт може тривати кілька секунд')
  }
  const reader = new FileReader()
  reader.onload = () => {
    pendingImportText.value = String(reader.result ?? '')
    showImportDialog.value = true
  }
  reader.onerror = () => toast.error('Не вдалося прочитати файл')
  reader.readAsText(file)
  input.value = ''
}

function doImport(mode: ImportMode) {
  if (pendingImportText.value == null) return
  const res = store.importBackupFile(pendingImportText.value, mode)
  pendingImportText.value = null
  showImportDialog.value = false
  if (res.error) {
    toast.error(res.error)
    return
  }
  const parts = [
    `документів: ${res.addedDocs}`,
    `макетів: ${res.addedLayouts}`,
    `наборів даних: ${res.addedData}`,
  ]
  if (res.skippedDocs) parts.push(`пропущено: ${res.skippedDocs}`)
  toast.success(`Імпорт (${mode === 'replace' ? 'заміна' : 'додано'}): ${parts.join(', ')}`)
  res.warnings.forEach(w => toast.info(w))
}

function cancelImport() {
  pendingImportText.value = null
  showImportDialog.value = false
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

    <div class="io-row">
      <button class="btn-sm" :disabled="!store.ready" @click="handleBackup" title="Зберегти всі документи і шаблони в JSON-файл">⬇ Бекап</button>
      <button class="btn-sm" :disabled="!store.ready" @click="backupInput?.click()" title="Відновити документи з JSON-файлу">⬆ Відновити</button>
      <input ref="backupInput" type="file" accept="application/json,.json" style="display: none" @change="onRestoreFile" />
    </div>

    <div v-if="showImportDialog" class="modal-overlay" @click.self="cancelImport">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Імпорт бекапа">
        <h3 class="modal-title">Імпорт бекапа</h3>
        <p class="modal-message">Додати документи до існуючих чи замінити весь поточний вміст?</p>
        <div class="modal-actions modal-actions-col">
          <button class="btn-sm btn-accent" @click="doImport('merge')">➕ Додати до існуючих</button>
          <button class="btn-sm btn-danger-solid" @click="doImport('replace')">⟲ Замінити все</button>
          <button class="btn-sm" @click="cancelImport">Скасувати</button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-if="pendingDeleteId"
      title="Видалити документ?"
      :message="`«${pendingDeleteName}» буде видалено без можливості відновлення.`"
      confirm-label="Видалити"
      danger
      @confirm="doDelete"
      @cancel="pendingDeleteId = null"
    />
  </div>
</template>
