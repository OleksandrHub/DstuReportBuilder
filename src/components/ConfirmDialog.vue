<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
  }>(),
  { confirmLabel: 'Підтвердити', cancelLabel: 'Скасувати', danger: false },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div class="modal-overlay" @click.self="emit('cancel')">
    <div class="modal" role="dialog" aria-modal="true" :aria-label="title">
      <h3 class="modal-title">{{ title }}</h3>
      <p class="modal-message">{{ message }}</p>
      <div class="modal-actions">
        <button class="btn-sm" @click="emit('cancel')">{{ cancelLabel }}</button>
        <button :class="['btn-sm', danger ? 'btn-danger-solid' : 'btn-accent']" @click="emit('confirm')" autofocus>
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
