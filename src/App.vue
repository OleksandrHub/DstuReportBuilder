<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import DocumentManager from './components/DocumentManager.vue'
import Toast from './components/Toast.vue'
import { RouterView } from 'vue-router'
import { useReportStore } from './stores/report'
import { useMobilePane } from './composables/useMobilePane'
import { useTheme } from './composables/useTheme'

const sidebarOpen = ref(false)
const store = useReportStore()
const { mobilePane, show } = useMobilePane()
const { theme, toggle } = useTheme()

// Global undo/redo shortcuts. Skipped inside editable fields so native
// text undo keeps working there.
function onGlobalKeydown(e: KeyboardEvent) {
  if (!e.ctrlKey && !e.metaKey) return
  const t = e.target as HTMLElement | null
  if (t && t.closest('input, textarea, select, [contenteditable="true"]')) return
  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    store.undo()
  } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
    e.preventDefault()
    store.redo()
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeydown))
</script>

<template>
  <div class="root-layout">
    <nav class="top-nav">
      <button class="nav-menu-btn" @click="sidebarOpen = !sidebarOpen" title="Мої роботи" aria-label="Мої роботи">
        ☰
      </button>
      <span class="nav-title">ДСТУ Конструктор звітів</span>
      <button
        class="nav-icon-btn"
        :disabled="!store.ready || !store.canUndo"
        @click="store.undo()"
        title="Скасувати (Ctrl+Z)"
        aria-label="Скасувати останню дію"
      >↶</button>
      <button
        class="nav-icon-btn"
        :disabled="!store.ready || !store.canRedo"
        @click="store.redo()"
        title="Повернути (Ctrl+Shift+Z)"
        aria-label="Повернути скасовану дію"
      >↷</button>
      <button
        class="nav-icon-btn"
        @click="toggle()"
        :title="theme === 'dark' ? 'Світла тема' : 'Темна тема'"
        :aria-label="theme === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'"
      >{{ theme === 'dark' ? '☀' : '☾' }}</button>
      <span class="nav-spacer"></span>
      <span v-if="!store.ready" class="nav-status" title="Завантаження даних зі сховища">⏳ Завантаження…</span>
      <span
        v-else-if="!store.storageError"
        class="nav-status nav-status-ok"
        :title="store.storageBackend === 'indexeddb'
          ? 'Дані зберігаються в IndexedDB (ліміт — сотні МБ)'
          : 'IndexedDB недоступний, дані зберігаються в localStorage (ліміт ~5 МБ)'"
      >💾 {{ store.storageBackend === 'indexeddb' ? 'IndexedDB' : 'localStorage' }}</span>
    </nav>

    <div v-if="store.storageError" class="storage-error-banner" role="alert">
      <span>⚠ {{ store.storageError }}</span>
      <button class="btn-sm" @click="store.saveNow()">Спробувати знову</button>
    </div>

    <!-- Narrow screens only (see media query): switch editor/preview panes. -->
    <div class="mobile-pane-switch" role="tablist" aria-label="Вибір панелі">
      <button
        :class="['pane-btn', { active: mobilePane === 'editor' }]"
        role="tab"
        :aria-selected="mobilePane === 'editor'"
        @click="show('editor')"
      >✎ Редактор</button>
      <button
        :class="['pane-btn', { active: mobilePane === 'preview' }]"
        role="tab"
        :aria-selected="mobilePane === 'preview'"
        @click="show('preview')"
      >👁 Перегляд</button>
    </div>

    <div class="root-body">
      <transition name="slide">
        <div v-if="sidebarOpen" class="doc-sidebar">
          <DocumentManager />
        </div>
      </transition>

      <div class="main-content" :class="{ 'sidebar-open': sidebarOpen }">
        <RouterView />
      </div>
    </div>

    <Toast />
  </div>
</template>
