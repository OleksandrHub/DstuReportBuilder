<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="toast-stack" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" :class="['toast', `toast-${t.kind}`]" role="status">
      <span class="toast-text">{{ t.text }}</span>
      <button class="toast-close" @click="dismiss(t.id)" title="Закрити">✕</button>
    </div>
  </div>
</template>
