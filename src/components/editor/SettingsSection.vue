<script setup lang="ts">
defineProps<{
  sectionId: string
  title: string
  open: boolean
  visible: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <section v-show="visible" :id="`set-${sectionId}`" class="set-section">
    <button
      class="set-section-head"
      @click="emit('toggle')"
      :aria-expanded="open"
      :aria-controls="`set-body-${sectionId}`"
    >
      <span class="set-chevron" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
      <span class="set-section-title">{{ title }}</span>
    </button>
    <div v-show="open" :id="`set-body-${sectionId}`" class="set-section-body">
      <slot />
    </div>
  </section>
</template>
