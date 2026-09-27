<script setup lang="ts">
import type { ImageBlock } from '../../types/document'
import { ref, watch, computed } from 'vue'
import MarkerHint from './MarkerHint.vue'
import RefLabelField from './RefLabelField.vue'
import BlockStyleRow from './BlockStyleRow.vue'
import NumberInput from './NumberInput.vue'

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

// Натуральний розмір завантаженого файлу — для автопропорцій.
// Беремо зі стору (naturalWidth/naturalHeight), або вимірюємо з src.
const measuredW = ref(0)
const measuredH = ref(0)

const naturalW = computed(() => props.block.naturalWidth || measuredW.value || 0)
const naturalH = computed(() => props.block.naturalHeight || measuredH.value || 0)
const ratio = computed(() =>
  naturalW.value > 0 && naturalH.value > 0 ? naturalW.value / naturalH.value : 0,
)
const keepRatio = computed(() => props.block.keepRatio !== false)

function measureFromSrc(src: string) {
  if (!src) {
    measuredW.value = 0
    measuredH.value = 0
    return
  }
  const img = new Image()
  img.onload = () => {
    measuredW.value = img.naturalWidth
    measuredH.value = img.naturalHeight
    // Якщо стор ще не має натуральних розмірів — зберегти для експорту.
    if (!props.block.naturalWidth || !props.block.naturalHeight) {
      emit('update', { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })
    }
  }
  img.src = src
}

watch(() => props.block.src, measureFromSrc, { immediate: true })

function onWidth(v: number | undefined) {
  const w = v ?? 400
  if (keepRatio.value && ratio.value > 0) {
    emit('update', { width: w, height: Math.max(1, Math.round(w / ratio.value)) })
  } else {
    emit('update', { width: w })
  }
}

function onHeight(v: number | undefined) {
  // Порожнє поле = авто (undefined) — висоту порахуємо з пропорції при експорті.
  if (v === undefined) {
    emit('update', { height: undefined })
    return
  }
  if (keepRatio.value && ratio.value > 0 && v > 0) {
    emit('update', { height: v, width: Math.max(1, Math.round(v * ratio.value)) })
  } else {
    emit('update', { height: v })
  }
}

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
    const dataUrl = await compressImage(file)
    // Натуральні розміри оригіналу — для автопропорцій і експорту.
    let nw = 0
    let nh = 0
    try {
      const bmp = await createImageBitmap(file)
      nw = bmp.width
      nh = bmp.height
      bmp.close()
    } catch { /* ignore */ }
    const patch: Partial<ImageBlock> = { src: dataUrl }
    if (nw > 0 && nh > 0) {
      patch.naturalWidth = nw
      patch.naturalHeight = nh
      // Одразу підганяємо висоту під поточну ширину за пропорцією.
      if (keepRatio.value) {
        const w = props.block.width ?? 400
        patch.height = Math.max(1, Math.round((w * nh) / nw))
      }
    }
    emit('update', patch)
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

    <RefLabelField :label="props.block.label" @update="emit('update', { label: $event })" />

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
      <NumberInput
        :model-value="props.block.width ?? 400"
        :default-value="400"
        :min="50" :max="900" :step="10"
        title="Ширина (px)"
        aria-label="Ширина зображення"
        @update:model-value="onWidth"
      />
      <span class="style-unit">px</span>
      <span class="style-label">Висота:</span>
      <NumberInput
        :model-value="props.block.height"
        :default-value="props.block.width ? Math.max(1, Math.round(props.block.width / (ratio || 4 / 3))) : 300"
        :min="0" :max="900" :step="10"
        :allow-empty="true"
        placeholder="авто"
        title="Висота (px), порожньо = авто за пропорцією"
        aria-label="Висота зображення"
        @update:model-value="onHeight"
      />
      <span class="style-unit">px</span>
    </div>
    <label class="ref-toggle">
      <input type="checkbox" :checked="keepRatio"
        @change="emit('update', { keepRatio: ($event.target as HTMLInputElement).checked })" />
      <span>Зберігати співвідношення сторін</span>
    </label>
    <p v-if="ratio > 0" class="block-hint">
      Оригінал: {{ naturalW }}×{{ naturalH }} (1:{{ (1 / ratio).toFixed(2) }})
      <template v-if="props.block.width && props.block.height">
        · зараз: {{ props.block.width }}×{{ props.block.height }}
      </template>
    </p>
    <label class="ref-toggle">
      <input type="checkbox" :checked="!!props.block.noTrailingSpace"
        @change="emit('update', { noTrailingSpace: ($event.target as HTMLInputElement).checked })" />
      <span>Без порожнього рядка знизу</span>
    </label>
    <div class="space-after-row" v-if="props.block.referenceText">
      <span class="style-label">Рядків після посилання в тексті:</span>
      <NumberInput
        :model-value="props.block.spaceAfterReference ?? (props.block as { spaceAfterCaption?: number }).spaceAfterCaption ?? 1"
        :default-value="1"
        :min="0" :max="5" :step="1"
        title="Кількість порожніх рядків між посиланням у тексті та рисунком"
        aria-label="Рядків після посилання в тексті"
        @update:model-value="emit('update', { spaceAfterReference: $event ?? 1 })"
      />
    </div>

    <p class="block-hint">Форматування підпису:</p>
    <BlockStyleRow :block="props.block" default-align="center" :show-indent="false" @update="emit('update', $event)" />
  </div>
</template>
