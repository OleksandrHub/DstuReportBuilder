<script setup lang="ts">
import type { ImageBlock } from '../../types/document'
import { ref } from 'vue'
import MarkerHint from './MarkerHint.vue'
import BlockStyleRow from './BlockStyleRow.vue'

const props = defineProps<{ block: ImageBlock; index: number }>()
const emit = defineEmits<{
  update: [data: Partial<ImageBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const imageError = ref<string | null>(null)

// Camera photos (4000px+, several MB as base64) used to blow up the storage.
// Downscale to a sane max dimension and re-encode; small images pass through
// untouched to avoid needless quality loss.
const MAX_IMAGE_DIM = 1600
const PASSTHROUGH_MAX_BYTES = 1024 * 1024 // 1 MB

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Не вдалося прочитати файл'))
    reader.readAsDataURL(file)
  })
}

async function compressImage(file: File): Promise<string> {
  const original = await readAsDataURL(file)
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return original // e.g. unsupported format — keep as is
  }
  try {
    const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size <= PASSTHROUGH_MAX_BYTES) return original
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(bitmap, 0, 0, w, h)
    // Keep PNG as PNG (transparency); photos → JPEG 0.85.
    return file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    bitmap.close()
  }
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  imageError.value = null
  try {
    emit('update', { src: await compressImage(file) })
  } catch {
    imageError.value = 'Не вдалося завантажити зображення'
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <div class="block image-block">
    <div class="block-toolbar">
      <span class="block-type-label">🖼 Рисунок {{ props.index }}</span>
      <div class="block-actions">
        <button @click="emit('duplicate')" title="Копіювати" aria-label="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору" aria-label="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз" aria-label="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити" aria-label="Видалити">✕</button>
      </div>
    </div>

    <label class="ref-toggle">
      <input
        type="checkbox"
        :checked="props.block.referenceText !== ''"
        @change="emit('update', { referenceText: ($event.target as HTMLInputElement).checked ? 'Результат роботи програми наведено на рисунку {no}.' : '' })"
      />
      <span>Показувати посилання в тексті</span>
    </label>
    <template v-if="props.block.referenceText !== ''">
      <div class="block-field-row">
        <label>Текст посилання:</label>
        <input
          class="block-input"
          :value="props.block.referenceText"
          @input="emit('update', { referenceText: ($event.target as HTMLInputElement).value })"
          placeholder="Результат роботи програми наведено на рисунку {no}."
        />
      </div>
      <p class="block-hint">{no} — підставиться номер рисунка</p>
      <label class="ref-toggle">
        <input
          type="checkbox"
          :checked="!!props.block.inlineReference"
          @change="emit('update', { inlineReference: ($event.target as HTMLInputElement).checked })"
        />
        <span>Продовжити попередній абзац (без нового рядка)</span>
      </label>
    </template>

    <div class="block-field-row">
      <label>Підпис:</label>
      <input
        class="block-input"
        :value="props.block.caption"
        @input="emit('update', { caption: ($event.target as HTMLInputElement).value })"
        placeholder="Назва рисунка"
      />
    </div>
    <MarkerHint />

    <div v-if="imageError" class="preview-error">{{ imageError }}</div>
    <div class="image-upload-area" @click="fileInputRef?.click()">
      <img v-if="props.block.src" :src="props.block.src" class="image-preview" alt="preview" />
      <div v-else class="image-placeholder">
        <span>Клікни щоб завантажити зображення</span>
        <span class="image-hint">(PNG, JPG)</span>
      </div>
    </div>
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      style="display: none"
      @change="onFileChange"
    />

    <div class="block-style-row">
      <span class="style-label">Ширина:</span>
      <input type="number" min="50" max="900" step="10" class="style-number"
        :value="props.block.width ?? 400"
        @input="emit('update', { width: parseInt(($event.target as HTMLInputElement).value) || 400 })"
        title="Ширина (px)" />
      <span class="style-unit">px</span>
      <span class="style-label">Висота:</span>
      <input type="number" min="0" max="900" step="10" class="style-number"
        :value="props.block.height ?? ''"
        @input="emit('update', { height: parseInt(($event.target as HTMLInputElement).value) || undefined })"
        title="Висота (px), 0 = авто" />
      <span class="style-unit">px</span>
    </div>
    <label class="ref-toggle">
      <input type="checkbox" :checked="!!props.block.noTrailingSpace"
        @change="emit('update', { noTrailingSpace: ($event.target as HTMLInputElement).checked })" />
      <span>Без порожнього рядка знизу</span>
    </label>
    <div class="space-after-row">
      <span class="style-label">Рядків після підпису:</span>
      <input
        type="number"
        class="style-number"
        min="0" max="5" step="1"
        :value="props.block.spaceAfterCaption ?? 1"
        @input="emit('update', { spaceAfterCaption: parseInt(($event.target as HTMLInputElement).value) || 1 })"
        title="Кількість порожніх рядків між підписом і рисунком"
        aria-label="Рядків після підпису"
      />
    </div>

    <p class="block-hint">Форматування підпису:</p>
    <BlockStyleRow :block="props.block" default-align="center" :show-indent="false" @update="emit('update', $event)" />
  </div>
</template>
