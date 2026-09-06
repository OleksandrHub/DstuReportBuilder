<script setup lang="ts">
import { useReportStore } from '../../stores/report'
import { computed, ref, watch, nextTick } from 'vue'
import type { NumberingSchemes } from '../../types/document'
import { resolveHeadingStyle, resolveBodyStyle } from '../../types/document'
import TextStyleCard from './TextStyleCard.vue'
import SettingsSection from './SettingsSection.vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import { useToast } from '../../composables/useToast'

const store = useReportStore()
const toast = useToast()
const s = computed(() => store.activeDocument?.settings)

// Effective global styles (with inheritance fallbacks) for the cards.
const h1 = computed(() => resolveHeadingStyle(s.value, 1))
const h2 = computed(() => resolveHeadingStyle(s.value, 2))
const h3 = computed(() => resolveHeadingStyle(s.value, 3))
const body = computed(() => resolveBodyStyle(s.value))

const showResetStyles = ref(false)
const showApplyStyles = ref(false)

function doResetStyles() {
  store.resetGlobalStyles()
  showResetStyles.value = false
  toast.success('Глобальні стилі скинуто до ДСТУ')
}

function doApplyStyles() {
  const n = store.inheritGlobalStylesEverywhere()
  showApplyStyles.value = false
  toast.success(
    n > 0
      ? `Знято ручні оверрайди з ${n} блоків — тепер вони йдуть за глобальними стилями`
      : 'Усі блоки вже йдуть за глобальними стилями',
  )
}

function update(field: string, value: string | number) {
  store.updateSettings({ [field]: value } as never)
}

const numberingTypes: { key: keyof NumberingSchemes; label: string }[] = [
  { key: 'image', label: 'Рисунки' },
  { key: 'table', label: 'Таблиці' },
  { key: 'code', label: 'Лістинги' },
  { key: 'formula', label: 'Формули' },
]

function updateNumbering(key: keyof NumberingSchemes, value: string) {
  if (!s.value) return
  store.updateSettings({ numbering: { ...s.value.numbering, [key]: value } } as never)
}

function updateHF(which: 'header' | 'footer', field: string, value: string | number) {
  const cur = s.value?.[which]
  if (!cur) return
  store.updateSettings({ [which]: { ...cur, [field]: value } } as never)
}

const fontSizes = [10, 11, 12, 13, 14, 15, 16, 17, 18, 20]
// Common Ukrainian academic fonts for technical reports
const fontFamilies = [
  'Times New Roman',
  'Arial',
  'Calibri',
  'Georgia',
  'Verdana',
  'Courier New',
  'Consolas',
  'Source Code Pro',
  'Roboto',
  'Open Sans',
]
const lineSpacings = [1.0, 1.15, 1.5, 2.0]

const hfModes = [
  { value: 'none', label: 'Немає' },
  { value: 'text', label: 'Текст' },
  { value: 'pageNumber', label: 'Номер сторінки' },
  { value: 'textAndPage', label: 'Текст + номер' },
] as const

// --- Section navigation: collapsible groups + anchor chips + search ---

interface SectionMeta {
  id: string
  title: string
  keywords: string
}

const SECTION_DEFS: SectionMeta[] = [
  { id: 'styles', title: 'Стилі заголовків і тексту', keywords: 'стилі заголовки h1 h2 h3 текст шрифт колір розмір жирний вирівнювання інтервал абзац дсту' },
  { id: 'base', title: 'Шрифт і абзац', keywords: 'шрифт розмір кегль інтервал міжрядковий абзац відступ times' },
  { id: 'margins', title: 'Поля сторінки', keywords: 'поля сторінки межі ліве праве верхнє нижнє см сантиметри' },
  { id: 'prefixes', title: 'Префікси підписів', keywords: 'префікси підписи рисунок лістинг таблиця формула назви captions' },
  { id: 'numbering', title: 'Нумерація', keywords: 'нумерація номери розділи глави рисунки таблиці' },
  { id: 'headerfooter', title: 'Колонтитули', keywords: 'колонтитули header footer верхній нижній номер сторінки перша титулка' },
]

const openSections = ref<Record<string, boolean>>({
  styles: true,
  base: true,
  margins: true,
  prefixes: true,
  numbering: true,
  headerfooter: true,
})
const sectionSearch = ref('')

const visibleSectionIds = computed(() => {
  const q = sectionSearch.value.trim().toLowerCase()
  if (!q) return new Set(SECTION_DEFS.map(d => d.id))
  return new Set(
    SECTION_DEFS.filter(d => `${d.title} ${d.keywords}`.toLowerCase().includes(q)).map(d => d.id),
  )
})
const navSections = computed(() => SECTION_DEFS.filter(d => visibleSectionIds.value.has(d.id)))

// While searching, auto-expand matches so results are immediately visible.
watch(sectionSearch, () => {
  if (!sectionSearch.value.trim()) return
  for (const d of SECTION_DEFS) {
    if (visibleSectionIds.value.has(d.id)) openSections.value[d.id] = true
  }
})

function toggleSection(id: string) {
  openSections.value[id] = !openSections.value[id]
}

function goToSection(id: string) {
  openSections.value[id] = true
  nextTick(() => {
    document.getElementById(`set-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
</script>

<template>
  <div v-if="s" class="settings-editor">
    <h3 class="section-title">Налаштування документа</h3>

    <div class="set-nav">
      <div class="set-search-row">
        <input
          class="field-input set-search"
          v-model="sectionSearch"
          placeholder="🔍 Пошук налаштувань…"
          aria-label="Пошук налаштувань"
        />
        <button v-if="sectionSearch" class="btn-sm" @click="sectionSearch = ''" title="Очистити пошук" aria-label="Очистити пошук">✕</button>
      </div>
      <div class="set-chips">
        <button
          v-for="sec in navSections"
          :key="sec.id"
          class="set-chip"
          @click="goToSection(sec.id)"
          :title="`Перейти: ${sec.title}`"
        >{{ sec.title }}</button>
      </div>
      <p v-if="sectionSearch && navSections.length === 0" class="block-hint">Нічого не знайдено</p>
    </div>

    <SettingsSection
      section-id="styles"
      title="Стилі заголовків і тексту"
      :open="!!openSections.styles"
      :visible="visibleSectionIds.has('styles')"
      @toggle="toggleSection('styles')"
    >
    <div class="global-styles">
      <TextStyleCard
        title="Заголовок першого рівня" badge="H1"
        sample="Розділ 1. Назва розділу"
        :model-value="h1" :base-font-family="s.fontFamily"
        @update="store.updateHeadingStyle(1, $event)"
      />
      <TextStyleCard
        title="Заголовок другого рівня" badge="H2"
        sample="1.1 Назва підрозділу"
        :model-value="h2" :base-font-family="s.fontFamily"
        @update="store.updateHeadingStyle(2, $event)"
      />
      <TextStyleCard
        title="Заголовок третього рівня" badge="H3"
        sample="1.1.1 Назва пункту"
        :model-value="h3" :base-font-family="s.fontFamily"
        @update="store.updateHeadingStyle(3, $event)"
      />
      <TextStyleCard
        title="Основний текст" badge="¶"
        sample="Основний текст звіту набирається шрифтом Times New Roman розміром 14 пунктів з міжрядковим інтервалом 1,5 та абзацним відступом 1,25 см."
        :model-value="body" :base-font-family="s.fontFamily"
        @update="store.updateBodyText($event)"
      />
      <div class="style-actions-row">
        <button
          class="btn-sm btn-accent" @click="showApplyStyles = true"
          title="Зняти ручні оверрайди шрифту/розміру/кольору з абзаців і заголовків, щоб вони йшли за цими стилями" aria-label="Зняти ручні оверрайди шрифту/розміру/кольору з абзаців і заголовків, щоб вони йшли за цими стилями"
        >✔ Застосувати до всіх блоків</button>
        <button class="btn-sm" @click="showResetStyles = true">⟲ Скинути стилі до ДСТУ</button>
      </div>
    </div>

    <ConfirmDialog
      v-if="showApplyStyles"
      title="Застосувати стилі до всіх блоків?"
      message="Буде знято ручні налаштування шрифту, розміру, інтервалу, відступу і кольору з абзаців та заголовків (вирівнювання і жирність збережуться)."
      confirm-label="Застосувати"
      @confirm="doApplyStyles"
      @cancel="showApplyStyles = false"
    />
    <ConfirmDialog
      v-if="showResetStyles"
      title="Скинути стилі до ДСТУ?"
      message="H1/H2 — Times New Roman 14, інтервал 1,5, абзац 1,25, жирний, по центру; H3 — так само, але зліва. Ручні оверрайди блоків не чіпаються."
      confirm-label="Скинути"
      danger
      @confirm="doResetStyles"
      @cancel="showResetStyles = false"
    />
    </SettingsSection>

    <SettingsSection
      section-id="base"
      title="Шрифт і абзац"
      :open="!!openSections.base"
      :visible="visibleSectionIds.has('base')"
      @toggle="toggleSection('base')"
    >
    <div class="field-group">
      <label>Шрифт</label>
      <select class="field-input" :value="s.fontFamily" @change="update('fontFamily', ($event.target as HTMLSelectElement).value)">
        <option v-for="f in fontFamilies" :key="f" :value="f">{{ f }}</option>
      </select>
    </div>

    <div class="field-group">
      <label>Розмір (pt)</label>
      <div class="btn-group">
        <button
          v-for="size in fontSizes"
          :key="size"
          :class="['size-btn', { active: s.fontSize === size }]"
          @click="update('fontSize', size)"
        >{{ size }}</button>
      </div>
    </div>

    <div class="field-group">
      <label>Міжрядковий інтервал</label>
      <div class="btn-group">
        <button
          v-for="sp in lineSpacings"
          :key="sp"
          :class="['size-btn', { active: s.lineSpacing === sp }]"
          @click="update('lineSpacing', sp)"
        >{{ sp }}</button>
      </div>
    </div>

    <div class="field-group">
      <label>Абзацний відступ (см)</label>
      <input
        class="field-input"
        style="width: 80px"
        type="number"
        step="0.25"
        min="0"
        max="3"
        :value="s.paragraphIndent"
        @input="update('paragraphIndent', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    </SettingsSection>

    <SettingsSection
      section-id="margins"
      title="Поля сторінки (см)"
      :open="!!openSections.margins"
      :visible="visibleSectionIds.has('margins')"
      @toggle="toggleSection('margins')"
    >
    <div class="field-row-two">
      <div class="field-group">
        <label>Ліве</label>
        <input class="field-input" type="number" step="0.5" min="0" :value="s.marginLeft" @input="update('marginLeft', parseFloat(($event.target as HTMLInputElement).value))" />
      </div>
      <div class="field-group">
        <label>Праве</label>
        <input class="field-input" type="number" step="0.5" min="0" :value="s.marginRight" @input="update('marginRight', parseFloat(($event.target as HTMLInputElement).value))" />
      </div>
      <div class="field-group">
        <label>Верхнє</label>
        <input class="field-input" type="number" step="0.5" min="0" :value="s.marginTop" @input="update('marginTop', parseFloat(($event.target as HTMLInputElement).value))" />
      </div>
      <div class="field-group">
        <label>Нижнє</label>
        <input class="field-input" type="number" step="0.5" min="0" :value="s.marginBottom" @input="update('marginBottom', parseFloat(($event.target as HTMLInputElement).value))" />
      </div>
    </div>

    </SettingsSection>

    <SettingsSection
      section-id="prefixes"
      title="Префікси підписів"
      :open="!!openSections.prefixes"
      :visible="visibleSectionIds.has('prefixes')"
      @toggle="toggleSection('prefixes')"
    >
    <div class="field-group">
      <label>Рисунки</label>
      <input class="field-input" :value="s.imagePrefix" @input="update('imagePrefix', ($event.target as HTMLInputElement).value)" />
    </div>
    <div class="field-group">
      <label>Лістинги</label>
      <input class="field-input" :value="s.listingPrefix" @input="update('listingPrefix', ($event.target as HTMLInputElement).value)" />
    </div>
    <div class="field-group">
      <label>Таблиці</label>
      <input class="field-input" :value="s.tablePrefix" @input="update('tablePrefix', ($event.target as HTMLInputElement).value)" />
    </div>
    <div class="field-group">
      <label>Формули</label>
      <input class="field-input" :value="s.formulaPrefix" @input="update('formulaPrefix', ($event.target as HTMLInputElement).value)" />
    </div>

    </SettingsSection>

    <SettingsSection
      section-id="numbering"
      title="Нумерація"
      :open="!!openSections.numbering"
      :visible="visibleSectionIds.has('numbering')"
      @toggle="toggleSection('numbering')"
    >
    <div v-for="nt in numberingTypes" :key="nt.key" class="field-group">
      <label>{{ nt.label }}</label>
      <select
        class="field-input"
        :value="s.numbering[nt.key]"
        @change="updateNumbering(nt.key, ($event.target as HTMLSelectElement).value)"
      >
        <option value="plain">1, 2, 3 (ігнорувати розділи)</option>
        <option value="perSection">1.1, 1.2, 1.3 (без зміни глави)</option>
        <option value="sectioned">1.1 … 2.1 (H2 = розділ)</option>
      </select>
    </div>

    </SettingsSection>

    <SettingsSection
      section-id="headerfooter"
      title="Колонтитули"
      :open="!!openSections.headerfooter"
      :visible="visibleSectionIds.has('headerfooter')"
      @toggle="toggleSection('headerfooter')"
    >
    <label class="checkbox-row">
      <input
        type="checkbox"
        :checked="s.differentFirstPage"
        @change="store.updateSettings({ differentFirstPage: ($event.target as HTMLInputElement).checked })"
      />
      <span>Інша перша сторінка (титулка без колонтитула)</span>
    </label>

    <div class="field-group">
      <label>Початковий номер сторінки</label>
      <input
        class="field-input"
        style="width: 80px"
        type="number"
        min="0"
        step="1"
        :value="s.pageNumberStart"
        @input="store.updateSettings({ pageNumberStart: parseInt(($event.target as HTMLInputElement).value) || 1 })"
      />
    </div>

    <h4 class="subsection-title">Верхній колонтитул</h4>
    <div class="field-group">
      <label>Вміст</label>
      <select class="field-input" :value="s.header.mode" @change="updateHF('header', 'mode', ($event.target as HTMLSelectElement).value)">
        <option v-for="m in hfModes" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
    </div>
    <template v-if="s.header.mode !== 'none'">
      <div v-if="s.header.mode === 'text' || s.header.mode === 'textAndPage'" class="field-group">
        <label>Текст</label>
        <input class="field-input" :value="s.header.text" @input="updateHF('header', 'text', ($event.target as HTMLInputElement).value)" placeholder="Текст колонтитула" />
      </div>
      <div class="field-row-two">
        <div class="field-group">
          <label>Вирівнювання</label>
          <select class="field-input" :value="s.header.align" @change="updateHF('header', 'align', ($event.target as HTMLSelectElement).value)">
            <option value="left">Зліва</option>
            <option value="center">По центру</option>
            <option value="right">Справа</option>
          </select>
        </div>
        <div class="field-group">
          <label>Шрифт</label>
          <select class="field-input" :value="s.header.fontFamily" @change="updateHF('header', 'fontFamily', ($event.target as HTMLSelectElement).value)">
            <option v-for="f in fontFamilies" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>
        <div class="field-group">
          <label>Розмір (pt)</label>
          <input class="field-input" type="number" min="8" max="20" step="1" :value="s.header.fontSize" @input="updateHF('header', 'fontSize', parseInt(($event.target as HTMLInputElement).value) || 12)" />
        </div>
      </div>
    </template>

    <h4 class="subsection-title">Нижній колонтитул</h4>
    <div class="field-group">
      <label>Вміст</label>
      <select class="field-input" :value="s.footer.mode" @change="updateHF('footer', 'mode', ($event.target as HTMLSelectElement).value)">
        <option v-for="m in hfModes" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
    </div>
    <template v-if="s.footer.mode !== 'none'">
      <div v-if="s.footer.mode === 'text' || s.footer.mode === 'textAndPage'" class="field-group">
        <label>Текст</label>
        <input class="field-input" :value="s.footer.text" @input="updateHF('footer', 'text', ($event.target as HTMLInputElement).value)" placeholder="Текст колонтитула" />
      </div>
      <div class="field-row-two">
        <div class="field-group">
          <label>Вирівнювання</label>
          <select class="field-input" :value="s.footer.align" @change="updateHF('footer', 'align', ($event.target as HTMLSelectElement).value)">
            <option value="left">Зліва</option>
            <option value="center">По центру</option>
            <option value="right">Справа</option>
          </select>
        </div>
        <div class="field-group">
          <label>Шрифт</label>
          <select class="field-input" :value="s.footer.fontFamily" @change="updateHF('footer', 'fontFamily', ($event.target as HTMLSelectElement).value)">
            <option v-for="f in fontFamilies" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>
        <div class="field-group">
          <label>Розмір (pt)</label>
          <input class="field-input" type="number" min="8" max="20" step="1" :value="s.footer.fontSize" @input="updateHF('footer', 'fontSize', parseInt(($event.target as HTMLInputElement).value) || 12)" />
        </div>
      </div>
    </template>
    </SettingsSection>
  </div>
</template>
