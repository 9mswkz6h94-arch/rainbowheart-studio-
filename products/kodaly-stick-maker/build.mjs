// Builds the Kodály Stick Sheet Maker workbook (.xlsx) — the sellable TPT product.
//
//   node build.mjs                  → dist/kodaly-stick-sheet-maker.xlsx      (full)
//   node build.mjs --sampler        → dist/kodaly-stick-sheet-maker-FREE.xlsx (free funnel)
//   node build.mjs --with-generator → adds the auto-generated practice-set tabs (possible
//                                     future "deluxe" SKU; not shipped by default)
//
// THE PRODUCT IS A BUILDER: the teacher writes their own rhythms as syllables
// (ta, ti-ti, ta-a…) on the Builder tab — dropdowns in each beat box — and the
// Master tab renders them as print-ready stick notation. Song rhythms, lesson
// sequences, assessments: whatever the teacher writes becomes a master copy.
//
// The .xlsx is designed to be IMPORTED INTO GOOGLE SHEETS (File → Import) and sold
// as a force-copy link; the xlsx itself ships in the ZIP as a bonus for Excel 365
// users. Everything regenerates from this script — never hand-edit the dist files.
// Reusable conventions live in products/STYLEGUIDE.md.

import ExcelJS from 'exceljs'
import { ELEMENTS } from '../glyphs/kodaly/glyphs.mjs'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SAMPLER = process.argv.includes('--sampler')
const WITH_GENERATOR = process.argv.includes('--with-generator')
const here = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------- brand tokens
// Mirrors src/index.css — keep in sync (STYLEGUIDE.md is the authority).
const C = {
  purple: 'FF6C5CE7', red: 'FFFF6B6B', orange: 'FFFF9F43', yellow: 'FFFECA57',
  teal: 'FF1DD1A1', blue: 'FF54A0FF', pink: 'FFFD79A8',
  text: 'FF2D3436', muted: 'FF636E72', border: 'FFE9ECEF', bgSubtle: 'FFF8F9FA',
  white: 'FFFFFFFF', black: 'FF000000',
}
const F = {
  heading: (size, color = C.text, bold = true) => ({ name: 'Fraunces', size, bold, color: { argb: color } }),
  body: (size = 11, color = C.text, bold = false) => ({ name: 'Inter', size, bold, color: { argb: color } }),
  mono: (size = 14, color = C.text) => ({ name: 'Space Mono', size, color: { argb: color } }),
}
const BASE_URL = 'https://rainbowheart.studio/glyphs/kodaly/'
const SITE = 'rainbowheart.studio'

const elements = SAMPLER
  ? ELEMENTS.filter((e) => ['ta', 'titi', 'rest'].includes(e.id))
  : ELEMENTS
// Builder vocabulary = elements + the continuation dash for two-beat figures.
const hasTwoBeat = elements.some((e) => e.beats === 2)
const vocab = [
  ...elements.map((e) => ({ id: e.id, syllable: e.syllable, name: e.name })),
  ...(hasTwoBeat ? [{ id: 'cont', syllable: '–', name: '– (second beat of a long element)' }] : []),
]
const TITLE = SAMPLER
  ? 'Kodály Stick Sheet Maker — Free Sampler'
  : 'Kodály Stick Sheet Maker'

// Builder/Master geometry
const LINES = 10          // rhythm lines per sheet
const BEATS = 8           // beat boxes per line (two 4-beat measures)
const B_ROW0 = 8          // first Builder entry row
const B_COL0 = 3          // first Builder beat column (C)

// ENGINE geometry
const E_ROW0 = 4
const E_LAST = E_ROW0 + vocab.length - 1
const SYL_RANGE = `ENGINE!$C$${E_ROW0}:$C$${E_LAST}`
const ID_RANGE = `ENGINE!$A$${E_ROW0}:$A$${E_LAST}`

const wb = new ExcelJS.Workbook()
wb.creator = 'Rainbow Hearts Studio'

const thin = { style: 'thin', color: { argb: C.black } }
const box = { top: thin, left: thin, bottom: thin, right: thin }
const center = { vertical: 'middle', horizontal: 'center' }

const pageSetup = {
  paperSize: 1, orientation: 'portrait',
  margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  fitToPage: true, fitToWidth: 1, fitToHeight: 1,
}

// Builder cell address for line L (1-based), beat b (1-based)
const builderCell = (L, b) =>
  `Builder!$${String.fromCharCode(64 + B_COL0 + b - 1)}$${B_ROW0 + (L - 1) * 2}`

// ================================================================ Start Here
{
  const ws = wb.addWorksheet('Start Here', { properties: { tabColor: { argb: C.purple } } })
  ws.getColumn(1).width = 3
  ws.getColumn(2).width = 100
  const lines = [
    ['title', TITLE],
    ['sub', 'Write a rhythm in syllables — print it in stick notation. By Rainbow Hearts Studio.'],
    ['gap'],
    ['h', 'Quick start'],
    ['p', '1.  Open the Builder tab and give your sheet a title.'],
    ['p', '2.  Click any beat box and pick a syllable from the dropdown (ta, ti-ti, rest…).'],
    ['p', '    Type it if that’s faster — the dropdown list shows the exact spellings.'],
    ['p', '3.  Leave boxes empty for shorter lines. Skip whole lines for white space.'],
    ['p', '4.  Open the Master tab — your rhythm is rendered in stick notation, ready to'],
    ['p', '    print or photocopy (File → Print; the print area is already set).'],
    ['gap'],
    ['h', 'Long elements (ta-a, syncopa, tam-ti, ti-tam)'],
    ['p', 'These sounds last two beats. Put the element in its first beat box and the'],
    ['p', '“–” from the dropdown in the next box, so students can track the beat through'],
    ['p', 'the long sound.'],
    ['gap'],
    ['h', 'Answer keys & assessments'],
    ['p', 'On the Builder tab, “Show syllables under the sticks” = Yes prints the syllables'],
    ['p', 'under every line (teaching master / answer key). Set it to No for a clean'],
    ['p', 'reading or assessment master of the same sheet.'],
    ['gap'],
    ['h', 'No internet?'],
    ['p', 'Stick pictures load from the web. For offline use, switch Display (Builder tab)'],
    ['p', 'to “Syllables (text only)” — the Master re-renders with syllables instead.'],
    ['gap'],
    ['h', 'License'],
    ['p', 'Single-teacher license: print unlimited copies for your own classroom and students.'],
    ['p', 'Please don’t share this file or your copy link — send colleagues to the store instead.'],
    ['gap'],
    ['h', 'More free tools for your music room'],
    ['p', `Free tuner, metronome, and chord & scale explorer at ${SITE} — no account needed.`],
  ]
  let r = 2
  for (const [kind, text] of lines) {
    const cell = ws.getCell(r, 2)
    if (kind === 'title') { cell.value = text; cell.font = F.heading(20, C.purple); ws.getRow(r).height = 30 }
    else if (kind === 'sub') { cell.value = text; cell.font = F.body(11, C.muted) }
    else if (kind === 'h') { cell.value = text; cell.font = F.heading(13); ws.getRow(r).height = 22 }
    else if (kind === 'p') { cell.value = text; cell.font = F.body(11) }
    r++
  }
  ws.pageSetup = pageSetup
}

// ================================================================ Builder
{
  const ws = wb.addWorksheet('Builder', { properties: { tabColor: { argb: C.blue } } })
  const widths = [3, 5, ...Array(BEATS).fill(11), 3]
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w))

  ws.getCell('B2').value = 'Builder'
  ws.getCell('B2').font = F.heading(18, C.purple)
  ws.getCell('C2').value = 'Pick a syllable in each beat box. The Master tab renders it as stick notation.'
  ws.getCell('C2').font = F.body(10, C.muted)
  ws.mergeCells(2, 3, 2, 2 + BEATS)

  // Controls
  ws.getCell('B4').value = 'Title'
  ws.getCell('B4').font = F.body(11, C.text, true)
  ws.mergeCells(4, 3, 4, 6)
  const title = ws.getCell(4, 3)
  title.value = 'Our Rhythms'
  title.font = F.mono(12)
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.bgSubtle } }
  title.border = box

  // Controls live in column E (merged E:F) — Master reads Builder!$E$5 / $E$6.
  const control = (row, label, value, options, note) => {
    ws.getCell(row, 2).value = label
    ws.getCell(row, 2).font = F.body(10, C.text, true)
    ws.mergeCells(row, 5, row, 6)
    const c = ws.getCell(row, 5)
    c.value = value
    c.font = F.mono(10)
    c.alignment = center
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.bgSubtle } }
    c.border = box
    c.dataValidation = { type: 'list', allowBlank: false, formulae: [`"${options.join(',')}"`] }
    if (note) { const n = ws.getCell(row, 8); n.value = note; n.font = F.body(9, C.muted) }
  }
  control(5, 'Syllables under sticks', 'No', ['Yes', 'No'], '← Yes = teaching master / answer key. No = clean assessment master.')
  control(6, 'Display', 'Stick pictures (online)', ['Stick pictures (online)', 'Syllables (text only)'], '← Pictures need internet. Syllables mode works offline.')

  // Entry grid: LINES lines, each an entry row (dropdowns) + a small gap row.
  for (let L = 1; L <= LINES; L++) {
    const r = B_ROW0 + (L - 1) * 2
    ws.getRow(r).height = 24
    ws.getRow(r + 1).height = 6
    ws.getCell(r, 2).value = `${L}.`
    ws.getCell(r, 2).font = F.body(10, C.muted)
    for (let b = 1; b <= BEATS; b++) {
      const c = ws.getCell(r, B_COL0 + b - 1)
      c.font = F.mono(10)
      c.alignment = center
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.bgSubtle } }
      c.border = box
      c.dataValidation = {
        type: 'list', allowBlank: true, formulae: [SYL_RANGE],
        showErrorMessage: true, error: 'Pick a syllable from the dropdown (or leave the box empty).',
      }
    }
  }

  // Legend: every syllable with its glyph, so the vocabulary is visible while writing.
  const legendR = B_ROW0 + LINES * 2 + 1
  ws.getCell(legendR, 2).value = 'Vocabulary'
  ws.getCell(legendR, 2).font = F.heading(12)
  const perRow = BEATS
  vocab.forEach((v, i) => {
    const row = legendR + 1 + Math.floor(i / perRow) * 2
    const col = B_COL0 + (i % perRow)
    ws.getRow(row).height = 34
    const g = ws.getCell(row, col)
    g.value = { formula: `IMAGE(ENGINE!$H$4&"${v.id}.png")` }
    g.alignment = center
    const s = ws.getCell(row + 1, col)
    s.value = v.syllable
    s.alignment = center
    s.font = F.mono(9, C.muted)
  })
  ws.pageSetup = pageSetup
}

// ================================================================ Master (the printable)
{
  const ws = wb.addWorksheet('Master', { properties: { tabColor: { argb: C.red } } })
  const widths = [3, 5, ...Array(BEATS).fill(11), 3]
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w))

  ws.mergeCells(2, 2, 2, 2 + BEATS)
  const t = ws.getCell(2, 2)
  t.value = { formula: `IF(Builder!$C$4="","Rhythm Master",Builder!$C$4)` }
  t.font = F.heading(17)
  t.alignment = center
  ws.getRow(2).height = 28
  ws.mergeCells(3, 2, 3, 2 + BEATS)
  const nameLine = ws.getCell(3, 2)
  nameLine.value = 'Name: ______________________________          Date: ________________'
  nameLine.font = F.body(10, C.muted)
  ws.getRow(3).height = 18

  for (let L = 1; L <= LINES; L++) {
    const glyphR = 5 + (L - 1) * 3
    const sylR = glyphR + 1
    ws.getRow(glyphR).height = 52
    ws.getRow(sylR).height = 14
    ws.getRow(glyphR + 2).height = 8
    // Line number only prints when the line has content.
    const entryRow = B_ROW0 + (L - 1) * 2
    ws.getCell(glyphR, 2).value = {
      formula: `IF(COUNTA(Builder!$C$${entryRow}:$J$${entryRow})=0,"","${L}.")`,
    }
    ws.getCell(glyphR, 2).font = F.body(10, C.text, true)
    for (let b = 1; b <= BEATS; b++) {
      const src = builderCell(L, b)
      const id = `INDEX(${ID_RANGE},MATCH(${src},${SYL_RANGE},0))`
      const g = ws.getCell(glyphR, B_COL0 + b - 1)
      g.value = {
        formula:
          `IF(${src}="","",` +
          `IF(Builder!$E$6="Syllables (text only)",${src},` +
          `IFERROR(IMAGE(ENGINE!$H$4&${id}&".png"),${src})))`,
      }
      g.alignment = center
      g.font = F.mono(13)
      // Syllable line under the sticks (teaching master / answer key mode).
      const s = ws.getCell(sylR, B_COL0 + b - 1)
      s.value = {
        formula:
          `IF(AND(Builder!$E$5="Yes",Builder!$E$6<>"Syllables (text only)"),` +
          `IF(${src}="","",${src}),"")`,
      }
      s.alignment = center
      s.font = F.mono(9, C.muted)
    }
  }
  const footerR = 5 + LINES * 3
  ws.getCell(footerR, 2).value = `${SITE} · Kodály Stick Sheet Maker`
  ws.getCell(footerR, 2).font = F.body(8, C.muted)
  ws.pageSetup = { ...pageSetup, printArea: `A1:${String.fromCharCode(66 + BEATS + 1)}${footerR}` }
}

// ================================================================ ENGINE (hidden lookups)
{
  const ws = wb.addWorksheet('ENGINE')
  ws.state = 'hidden' // hidden (not veryHidden) so power users can peek
  ws.getCell('A1').value = 'Lookup tables — do not edit. Regenerated by products/kodaly-stick-maker/build.mjs'
  ws.getCell('A1').font = F.body(9, C.muted)
  ws.getCell('H4').value = BASE_URL

  ws.getRow(3).values = ['id', 'name', 'syllable']
  vocab.forEach((v, i) => {
    const r = E_ROW0 + i
    ws.getCell(r, 1).value = v.id
    ws.getCell(r, 2).value = v.name
    ws.getCell(r, 3).value = v.syllable
  })
}

// ================================================================ optional generator tabs
// The auto-generated practice sets (flashcards / worksheet / dictation, seeded by a
// deterministic Set #) live behind --with-generator as a possible future deluxe SKU.
// See git history (products/kodaly-stick-maker at commit 35c444a) for the full
// implementation with its Setup tab, element toggles, and pattern matrix.
if (WITH_GENERATOR) {
  console.warn('NOTE: --with-generator requested. The generator implementation was moved out of')
  console.warn('the default product; restore it from commit 35c444a and integrate behind this flag.')
}

// ================================================================ About
{
  const ws = wb.addWorksheet('About', { properties: { tabColor: { argb: C.pink } } })
  ws.getColumn(1).width = 3
  ws.getColumn(2).width = 100
  const lines = [
    ['title', 'Rainbow Hearts Studio'],
    ['p', 'Working tools for music teachers and performing musicians — Copperas Cove, TX.'],
    ['gap'],
    ['h', `Free at ${SITE} (no account needed)`],
    ['p', '·  Chromatic tuner — guitar, bass, ukulele'],
    ['p', '·  Metronome with tap tempo and visual pulse'],
    ['p', '·  Chord & Scale Explorer — uke, guitarlele, tenor guitar, guitar, bass'],
    ['gap'],
    ['h', 'In the studio (subscription)'],
    ['p', '·  Chord Chart Builder — print-ready charts, any key'],
    ['p', '·  Tab + Groove builders and printable sheets'],
    ['p', '·  Shows — set lists your whole band reads from a tablet, with remote control'],
    ['gap'],
    ['p', `Questions or ideas? We actually answer: hello@${SITE}`],
    ['p', `© ${new Date().getFullYear()} Rainbow Hearts Studio · Single-teacher license`],
  ]
  let r = 2
  for (const [kind, text] of lines) {
    const cell = ws.getCell(r, 2)
    if (kind === 'title') { cell.value = text; cell.font = F.heading(18, C.purple); ws.getRow(r).height = 28 }
    else if (kind === 'h') { cell.value = text; cell.font = F.heading(12) }
    else if (kind === 'p') { cell.value = text; cell.font = F.body(11) }
    r++
  }
}

// ================================================================ write file
const outDir = join(here, 'dist')
mkdirSync(outDir, { recursive: true })
const out = join(outDir, SAMPLER ? 'kodaly-stick-sheet-maker-FREE.xlsx' : 'kodaly-stick-sheet-maker.xlsx')
await wb.xlsx.writeFile(out)
console.log(`wrote ${out}`)
