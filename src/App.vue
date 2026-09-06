<script setup lang="ts">
import { ref } from 'vue'
import DocumentManager from './components/DocumentManager.vue'
import { RouterView } from 'vue-router'
import { useReportStore } from './stores/report'

const sidebarOpen = ref(false)
const store = useReportStore()
</script>

<template>
  <div class="root-layout">
    <nav class="top-nav">
      <button class="nav-menu-btn" @click="sidebarOpen = !sidebarOpen" title="Мої роботи">
        ☰
      </button>
      <span class="nav-title">ДСТУ Конструктор звітів</span>
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
  </div>
</template>
