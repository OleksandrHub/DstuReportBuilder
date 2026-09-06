import type { DocumentSettings, TextStyle } from './document-settings'
import type { ReportBlock } from './blocks'
import type { TitlePageData, WorkIntro, TitleBlock, TitleLineBlock, TitleAlign } from './title'

export interface ReportDocument {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  titlePage: TitlePageData
  titleTemplate: TitleBlock[]
  settings: DocumentSettings
  blocks: ReportBlock[]
}

export const TITLE_TEMPLATES_STORAGE_KEY = 'dstu-title-templates'
export const TITLE_DATA_TEMPLATES_KEY = 'dstu-title-data-templates'

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

// ДСТУ-стилі за замовчуванням: H1/H2 — Times New Roman 14, інтервал 1.5,
// абзац 1.25, жирний, по центру; H3 — так само, але вирівнювання зліва.
// fontFamily: '' = наслідувати базовий шрифт документа (теж Times New Roman).
const DSTU_HEADING_BASE: TextStyle = {
  fontFamily: '',
  fontSize: 14,
  color: '000000',
  bold: true,
  align: 'center',
  lineSpacing: 1.5,
  indent: 1.25,
}

export const DEFAULT_HEADING_STYLES: Record<1 | 2 | 3, TextStyle> = {
  1: { ...DSTU_HEADING_BASE },
  2: { ...DSTU_HEADING_BASE },
  3: { ...DSTU_HEADING_BASE, align: 'left' },
}

export const DEFAULT_BODY_TEXT: TextStyle = {
  fontFamily: '',
  fontSize: 14,
  color: '000000',
  bold: false,
  align: 'justify',
  lineSpacing: 1.5,
  indent: 1.25,
}

export const DEFAULT_SETTINGS: DocumentSettings = {
  fontFamily: 'Times New Roman',
  fontSize: 14,
  lineSpacing: 1.5,
  paragraphIndent: 1.25,
  headingStyles: clone(DEFAULT_HEADING_STYLES),
  bodyText: { ...DEFAULT_BODY_TEXT },
  marginLeft: 3.0,
  marginRight: 1.5,
  marginTop: 2.0,
  marginBottom: 2.0,
  imagePrefix: 'Рисунок',
  listingPrefix: 'Лістинг',
  tablePrefix: 'Таблиця',
  header: { mode: 'none', text: '', align: 'right', fontSize: 12, fontFamily: 'Times New Roman' },
  footer: { mode: 'pageNumber', text: '', align: 'right', fontSize: 12, fontFamily: 'Times New Roman' },
  differentFirstPage: true,
  pageNumberStart: 1,
  numbering: { image: 'plain', table: 'plain', code: 'plain', formula: 'plain' },
  formulaPrefix: 'Формула',
}

export const DEFAULT_TITLE_PAGE: TitlePageData = {
  ministry: 'Міністерство освіти і науки України',
  university: 'Тернопільський національний технічний університет імені Івана Пулюя',
  department: 'Кафедра комп\'ютерних наук',
  workType: 'лабораторної роботи',
  workNumber: '1',
  topic: 'Тема роботи',
  discipline: 'Дисципліна',
  studentGroup: 'ХХ-11',
  studentName: 'Прізвище І. П.',
  teacherTitle: 'PhD',
  teacherName: 'Прізвище І. П.',
  city: 'Тернопіль',
  year: new Date().getFullYear().toString(),
}

export const DEFAULT_INTRO: WorkIntro = {
  topic: 'Тема роботи',
  goal: 'Мета роботи',
  variant: '1',
}

function tid(): string {
  return Math.random().toString(36).slice(2)
}

function line(text: string, align: TitleAlign, bold = false, paddingLeft = 0, paddingRight = 0): TitleLineBlock {
  return { id: tid(), type: 'titleLine', text, align, bold, spaceBefore: false, paddingLeft, paddingRight }
}

export const DEFAULT_TITLE_TEMPLATE: TitleBlock[] = [
  line('{{ministry}}', 'center'),
  line('{{university}}', 'center'),
  { id: tid(), type: 'titleSpacer', lines: 3 },
  line('{{department}}', 'right'),
  { id: tid(), type: 'titleSpacer', lines: 3 },
  line('ЗВІТ', 'center', true),
  line('про виконання {{workType}} №{{workNumber}}', 'center'),
  line('на тему: «{{topic}}»', 'center'),
  line('з дисципліни «{{discipline}}»', 'center'),
  { id: tid(), type: 'titleSpacer', lines: 3 },
  line('Виконав:', 'left', true, 11, 0),
  line('Студент групи {{studentGroup}}', 'left', false, 11, 0),
  line('{{studentName}}', 'left', false, 11, 0),
  line('Прийняв:', 'left', true, 11, 0),
  line('{{teacherTitle}}', 'left', false, 11, 0),
  line('{{teacherName}}', 'left', false, 11, 0),
  { id: tid(), type: 'titleSpacer', lines: 5 },
  line('{{city}} – {{year}}', 'center'),
]
