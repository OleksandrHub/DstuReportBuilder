<script setup lang="ts">
import { useReportStore } from '../../stores/report'
import { computed, ref } from 'vue'

const store = useReportStore()
const t = computed(() => store.activeDocument?.titlePage)

function update(field: string, value: string) {
  store.updateTitlePage({ [field]: value } as never)
}

const showTemplates = ref(false)
const newTemplateName = ref('')
const renamingId = ref<string | null>(null)
const renameValue = ref('')

function saveTemplate() {
  const name = newTemplateName.value.trim()
  if (!name) return
  store.saveAsDataTemplate(name)
  newTemplateName.value = ''
}

function startRename(id: string, name: string) {
  renamingId.value = id
  renameValue.value = name
}

function confirmRename() {
  if (renamingId.value) {
    store.renameDataTemplate(renamingId.value, renameValue.value.trim() || 'Без назви')
    renamingId.value = null
  }
}
</script>

<template>
  <div v-if="t" class="title-page-editor">
    <h3 class="section-title">🅼 Титульна сторінка</h3>

    <section class="macro-section">
      <h4 class="subsection-title">Робота</h4>
      <div class="field-group">
        <label>Тип роботи</label>
        <input class="field-input" :value="t.workType" @input="update('workType', ($event.target as HTMLInputElement).value)" placeholder="лабораторної роботи" />
      </div>
      <div class="field-row-two">
        <div class="field-group">
          <label>Номер</label>
          <input class="field-input" :value="t.workNumber" @input="update('workNumber', ($event.target as HTMLInputElement).value)" placeholder="1" />
        </div>
        <div class="field-group">
          <label>Дисципліна</label>
          <input class="field-input" :value="t.discipline" @input="update('discipline', ($event.target as HTMLInputElement).value)" />
        </div>
      </div>
      <div class="field-group">
        <label>Тема</label>
        <input class="field-input" :value="t.topic" @input="update('topic', ($event.target as HTMLInputElement).value)" />
      </div>
    </section>

    <section class="macro-section">
      <h4 class="subsection-title">Заклад</h4>
      <div class="field-group">
        <label>Міністерство</label>
        <input class="field-input" :value="t.ministry" @input="update('ministry', ($event.target as HTMLInputElement).value)" />
      </div>
      <div class="field-group">
        <label>Університет</label>
        <input class="field-input" :value="t.university" @input="update('university', ($event.target as HTMLInputElement).value)" />
      </div>
      <div class="field-group">
        <label>Кафедра</label>
        <input class="field-input" :value="t.department" @input="update('department', ($event.target as HTMLInputElement).value)" />
      </div>
    </section>

    <section class="macro-section">
      <h4 class="subsection-title">Виконавець / керівник</h4>
      <div class="field-row-two">
        <div class="field-group">
          <label>Група</label>
          <input class="field-input" :value="t.studentGroup" @input="update('studentGroup', ($event.target as HTMLInputElement).value)" placeholder="ХХ-11" />
        </div>
        <div class="field-group">
          <label>ПІБ студента</label>
          <input class="field-input" :value="t.studentName" @input="update('studentName', ($event.target as HTMLInputElement).value)" placeholder="Прізвище І. П." />
        </div>
      </div>
      <div class="field-row-two">
        <div class="field-group">
          <label>Звання керівника</label>
          <input class="field-input" :value="t.teacherTitle" @input="update('teacherTitle', ($event.target as HTMLInputElement).value)" placeholder="PhD" />
        </div>
        <div class="field-group">
          <label>ПІБ керівника</label>
          <input class="field-input" :value="t.teacherName" @input="update('teacherName', ($event.target as HTMLInputElement).value)" placeholder="Прізвище І. П." />
        </div>
      </div>
    </section>

    <section class="macro-section">
      <h4 class="subsection-title">Місце і рік</h4>
      <div class="field-row-two">
        <div class="field-group">
          <label>Місто</label>
          <input class="field-input" :value="t.city" @input="update('city', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="field-group">
          <label>Рік</label>
          <input class="field-input" :value="t.year" @input="update('year', ($event.target as HTMLInputElement).value)" />
        </div>
      </div>
    </section>

    <section class="macro-section">
      <h4 class="subsection-title">Шаблони даних</h4>
      <div class="template-toolbar">
        <button class="btn-save-tpl" @click="showTemplates = !showTemplates">
          {{ showTemplates ? '✕ Закрити' : `📋 Шаблони (${store.titleDataTemplates.length})` }}
        </button>
        <div class="save-tpl-row">
          <input
            class="field-input tpl-name-input"
            v-model="newTemplateName"
            placeholder="Назва нового шаблону…"
            @keydown.enter="saveTemplate"
          />
          <button class="btn-primary" @click="saveTemplate">💾 Зберегти</button>
        </div>
      </div>

      <div v-if="showTemplates && store.titleDataTemplates.length" class="data-templates-list">
        <div v-for="tpl in store.titleDataTemplates" :key="tpl.id" class="data-tpl-item">
          <template v-if="renamingId === tpl.id">
            <input
              class="field-input rename-input"
              v-model="renameValue"
              @keydown.enter="confirmRename"
              @keydown.escape="renamingId = null"
              @blur="confirmRename"
              autofocus
            />
          </template>
          <template v-else>
            <span class="data-tpl-name">{{ tpl.name }}</span>
          </template>
          <div class="data-tpl-actions">
            <button class="btn-small" @click="store.applyDataTemplate(tpl.id)" title="Застосувати" aria-label="Застосувати">↩ Застосувати</button>
            <button class="btn-icon" @click="startRename(tpl.id, tpl.name)" title="Перейменувати" aria-label="Перейменувати">✎</button>
            <button class="btn-icon btn-danger" @click="store.deleteDataTemplate(tpl.id)" title="Видалити" aria-label="Видалити">✕</button>
          </div>
        </div>
      </div>
      <div v-else-if="showTemplates" class="empty-blocks-hint">Немає збережених шаблонів</div>
    </section>
  </div>
</template>

<style scoped>
.title-page-editor { display: flex; flex-direction: column; gap: 4px; }
.macro-section { display: flex; flex-direction: column; gap: 8px; }
</style>
