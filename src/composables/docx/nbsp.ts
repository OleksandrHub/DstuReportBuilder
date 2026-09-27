// Non-breaking spaces that keep typographic pairs on one line: "рис. 5",
// "№ 3", "5 кг", "Т. Г. Шевченко", "слово – слово". Applied to text before
// inline parsing; `code` spans are left untouched.

const NBSP = '\u00A0'

const ABBREVIATIONS = 'рис|табл|див|розд|підрозд|п|пп|с|т|ст|гл|вип|вид|кн|арк'
const UNITS = [
  'кг', 'г', 'мг', 'т', 'км', 'м', 'см', 'мм', 'мкм', 'нм', 'л', 'мл',
  'год', 'хв', 'с', 'мс', 'мкс', 'нс', 'Гц', 'кГц', 'МГц', 'ГГц',
  'В', 'мВ', 'кВ', 'А', 'мА', 'Вт', 'кВт', 'МВт', 'Ом', 'кОм', 'МОм',
  'Дж', 'кДж', 'Н', 'Па', 'кПа', 'МПа', 'К', '°C', '°С', '%',
  'Б', 'КБ', 'МБ', 'ГБ', 'ТБ', 'Кб', 'Мб', 'Гб', 'біт', 'байт', 'px', 'пт',
  'грн', 'шт', 'тис', 'млн', 'млрд', 'р', 'рр', 'ст',
].join('|')

// Lookbehind (not a consumed group) so back-to-back pairs like "див. рис. 5" both match.
const AFTER_ABBR = new RegExp(`(?<=^|[\\s(«"\u00A0])((?:${ABBREVIATIONS})\\.|№|§)[ \\t]+(?=\\S)`, 'giu')
const NUMBER_UNIT = new RegExp(`(\\d)[ \\t]+(?=(?:${UNITS})(?![\\p{L}\\d]))`, 'gu')
const INITIAL_INITIAL = /(\p{Lu}\.)[ \t]+(?=\p{Lu}\.)/gu          // "Т. Г."
const INITIALS_SURNAME = /(\p{Lu}\.)[ \t]+(?=\p{Lu}\p{Ll})/gu      // "Г. Шевченко"
const SURNAME_INITIALS = /(\p{Lu}\p{Ll}+)[ \t]+(?=\p{Lu}\.)/gu     // "Шевченко Т."
const BEFORE_DASH = /[ \t]+(?=[–—])/g

function apply(s: string): string {
  return s
    .replace(AFTER_ABBR, `$1${NBSP}`)
    .replace(NUMBER_UNIT, `$1${NBSP}`)
    .replace(INITIAL_INITIAL, `$1${NBSP}`)
    .replace(INITIALS_SURNAME, `$1${NBSP}`)
    .replace(SURNAME_INITIALS, `$1${NBSP}`)
    .replace(BEFORE_DASH, NBSP)
}

export function addNbsp(text: string): string {
  // Odd parts are `mono` spans (backtick-delimited) — keep them verbatim.
  return text
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 ? part : apply(part)))
    .join('')
}
