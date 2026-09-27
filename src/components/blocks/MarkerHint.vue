<script setup lang="ts">
// Shared hint listing the inline formatting markers supported in any text field.
const examples: Array<{ code: string; desc: string }> = [
  { code: '**жирний**', desc: 'жирний' },
  { code: '*курсив*', desc: 'курсив' },
  { code: '__підкреслення__', desc: 'підкреслений' },
  { code: '`моноширинний`', desc: 'шрифт Courier New' },
  { code: '{#FF0000|червоний текст}', desc: 'колір тексту (HEX: #RRGGBB або #RGB)' },
  { code: '==виділення==', desc: 'жовте виділення (як маркером)' },
  { code: '{!#00FF00|зелене тло}', desc: 'виділення будь-яким кольором' },
  { code: '{#F00|{!#FF0|**разом**}}', desc: 'усе можна поєднувати та вкладати' },
  { code: 'рис. {ref:схема}', desc: 'номер рисунка / таблиці / лістингу / формули з міткою «схема»' },
  { code: '{cite:knuth|с. 25}', desc: 'посилання на джерело з ключем «knuth» → [1, с. 25]' },
  { code: '\\* \\= \\{ \\\\', desc: 'зворотна скісна риска «\\» вимикає символ-маркер: пишеться як є' },
]
</script>

<template>
  <details class="marker-hint">
    <summary class="block-hint">
      **жирний** · *курсив* · __підкреслення__ · `моно` · {#FF0000|колір} · ==виділення== —
      <span class="marker-hint-more">докладніше</span>
    </summary>
    <table class="marker-hint-table">
      <tbody>
        <tr v-for="ex in examples" :key="ex.code">
          <td><code>{{ ex.code }}</code></td>
          <td>{{ ex.desc }}</td>
        </tr>
      </tbody>
    </table>
    <p class="block-hint">
      Колір — це HEX-код: #FF0000 червоний, #0000FF синій, #008000 зелений, #FFFF00 жовтий.
      Текст між <code>|</code> і <code>}</code> отримає цей колір.
    </p>
  </details>
</template>

<style scoped>
.marker-hint summary { cursor: pointer; list-style: none; }
.marker-hint summary::-webkit-details-marker { display: none; }
.marker-hint-more { text-decoration: underline; }
.marker-hint-table {
  border-collapse: collapse;
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: var(--font-ui);
  margin: 0 0 6px;
}
.marker-hint-table td { padding: 2px 10px 2px 0; vertical-align: top; }
.marker-hint code { white-space: nowrap; }
</style>
