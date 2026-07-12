// Builds the Kodály Stick Sheet Maker workbook (.xlsx) — the sellable TPT product.
//
//   node build.mjs           → dist/kodaly-stick-sheet-maker.xlsx      (full, $ product)
//   node build.mjs --sampler → dist/kodaly-stick-sheet-maker-FREE.xlsx (free funnel version)
//
// The .xlsx is designed to be IMPORTED INTO GOOGLE SHEETS (File → Import) and sold
// as a force-copy link; the xlsx itself ships in the ZIP as a bonus for Excel 365 users.
// Everything regenerates from this script — never hand-edit the dist files.
//
// Architecture (see products/STYLEGUIDE.md for the reusable conventions):
//   Setup      — teacher-facing controls (meter, set #, display mode, element checklist)
//   ENGINE     — hidden. Element table + deterministic pattern matrix. "Set #" seeds a
//                pure-formula pseudo-random stream, so Set 47 always prints the same
//                patterns and answer keys — no volatile RANDBETWEEN.
//   Flashcards / Worksheet / Dictation Key / Compose — output tabs, print-area configured.
//   Glyphs render via IMAGE(baseUrl & id & ".png") served from rainbowheart.studio.

import ExcelJS from 'exceljs'
import { ELEMENTS } from '../glyphs/kodaly/glyphs.mjs'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SAMPLER = process.argv.includes('--sampler')
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
const TITLE = SAMPLER
  ? 'Kodály Stick Sheet Maker — Free Sampler'
  : 'Kodály Stick Sheet Maker'

// ENGINE geometry
const E_ROW0 = 4                       // first element table row
const E_LAST = E_ROW0 + elements.length - 1
const S_ROW0 = 14                      // first Setup checklist row
const P_ROW0 = 16                      // first pattern matrix row
const N_PATTERNS = 24                  // 8 flashcards + 8 worksheet + 8 dictation
const TBL = `$A$${E_ROW0}:$D$${E_LAST}`

const wb = new ExcelJS.Workbook()
wb.creator = 'Rainbow Hearts Studio'

const thin = { style: 'thin', color: { argb: C.black } }
const box = { top: thin, left: thin, bottom: thin, right: thin }
const center = { vertical: 'middle', horizontal: 'center' }

// Outline a rectangular cell range with thin black borders (card frames etc.)
function frame(ws, r1, c1, r2, c2) {
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
    const b = {}
    if (r === r1) b.top = thin
    if (r === r2) b.bottom = thin
    if (c === c1) b.left = thin
    if (c === c2) b.right = thin
    ws.getCell(r, c).border = { ...ws.getCell(r, c).border, ...b }
  }
}

// Formula fragment: rendered content for ENGINE final cell at (col,row) —
// picture mode → IMAGE(), syllable mode → text lookup ("cont" renders as a dash).
function displayFormula(engineCell) {
  return (
    `IF(ENGINE!${engineCell}="","",` +
    `IF(ENGINE!$H$3="Syllables (text only)",` +
    `IFERROR(VLOOKUP(ENGINE!${engineCell},ENGINE!$A$${E_ROW0}:$C$${E_LAST},3,0),"–"),` +
    `IMAGE(ENGINE!$H$4&ENGINE!${engineCell}&".png")))`
  )
}
function syllableFormula(engineCell) {
  return (
    `IF(ENGINE!${engineCell}="","",` +
    `IFERROR(VLOOKUP(ENGINE!${engineCell},ENGINE!$A$${E_ROW0}:$C$${E_LAST},3,0),"–"))`
  )
}
// ENGINE final-cell address for pattern p (1-based), beat b (1..4)
const finalCell = (p, b) => `${'GHIJ'[b - 1]}${P_ROW0 + p - 1}`

const pageSetup = {
  paperSize: 1, orientation: 'portrait',
  margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  fitToPage: true, fitToWidth: 1, fitToHeight: 1,
}

// ================================================================ Start Here
{
  const ws = wb.addWorksheet('Start Here', { properties: { tabColor: { argb: C.purple } } })
  ws.getColumn(1).width = 3
  ws.getColumn(2).width = 100
  const lines = [
    ['title', TITLE],
    ['sub', 'Infinite rhythm masters for the Kodály classroom · by Rainbow Hearts Studio'],
    ['gap'],
    ['h', 'Quick start'],
    ['p', '1.  Open the Setup tab.'],
    ['p', '2.  Pick your meter, and switch ON only the rhythm elements your class knows.'],
    ['p', '3.  Type any Set # (1–999). Every set is a complete, matching collection:'],
    ['p', '      flashcards, reading worksheet, and dictation key all come from that one number.'],
    ['p', '4.  Open a tab and print (File → Print). Print areas are already configured.'],
    ['p', '5.  Next week, type a new Set # — brand-new materials, zero prep.'],
    ['gap'],
    ['h', 'Why Set numbers instead of a shuffle button?'],
    ['p', 'Set 47 is always Set 47. Reprint a lost worksheet in June and it still matches the'],
    ['p', 'answer key you used in September. Write the Set # on anything you print.'],
    ['gap'],
    ['h', 'Long elements (ta-a, syncopa, tam-ti, ti-tam)'],
    ['p', 'Two-beat elements show a — in their second beat box, so students can track the beat'],
    ['p', 'through the long sound. Switch them ON only after you have introduced them.'],
    ['gap'],
    ['h', 'No internet? '],
    ['p', 'Stick pictures load from the web. For offline use, switch Display (Setup tab) to'],
    ['p', '"Syllables (text only)" — every page re-renders with rhythm syllables instead.'],
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

// ================================================================ Setup
{
  const ws = wb.addWorksheet('Setup', { properties: { tabColor: { argb: C.blue } } })
  ;[3, 34, 14, 10, 44].forEach((w, i) => (ws.getColumn(i + 1).width = w))

  ws.getCell('B2').value = 'Setup'
  ws.getCell('B2').font = F.heading(18, C.purple)
  ws.getCell('B3').value = 'Everything below updates every tab instantly.'
  ws.getCell('B3').font = F.body(10, C.muted)

  const control = (row, label, value, validation, note) => {
    ws.getCell(row, 2).value = label
    ws.getCell(row, 2).font = F.body(11, C.text, true)
    const c = ws.getCell(row, 3)
    c.value = value
    c.font = F.mono(12)
    c.alignment = center
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.bgSubtle } }
    c.border = box
    if (validation) c.dataValidation = validation
    if (note) { ws.getCell(row, 5).value = note; ws.getCell(row, 5).font = F.body(9, C.muted) }
    ws.getRow(row).height = 20
  }
  control(7, 'Meter', '4/4',
    { type: 'list', allowBlank: false, formulae: ['"2/4,3/4,4/4"'] },
    'How many beats per pattern.')
  control(8, 'Set #', 1,
    { type: 'whole', operator: 'between', formulae: [1, 999], showErrorMessage: true, error: 'Pick a whole number from 1 to 999.' },
    'Each number is a different complete set. Same number = same pages, forever.')
  control(9, 'Display', 'Stick pictures (online)',
    { type: 'list', allowBlank: false, formulae: ['"Stick pictures (online),Syllables (text only)"'] },
    'Pictures need internet. Syllables mode works offline.')

  ws.getCell('B12').value = 'Rhythm elements (in teaching order — switch ON what your class knows)'
  ws.getCell('B12').font = F.heading(12)
  elements.forEach((el, i) => {
    const r = S_ROW0 + i
    ws.getCell(r, 2).value = `${el.name}   ·   “${el.syllable}”`
    ws.getCell(r, 2).font = F.body(11)
    const c = ws.getCell(r, 3)
    if (el.locked) {
      c.value = 'ON'
      c.dataValidation = { type: 'list', allowBlank: false, formulae: ['"ON"'] }
      ws.getCell(r, 5).value = 'Always on — every pattern needs ta.'
      ws.getCell(r, 5).font = F.body(9, C.muted)
    } else {
      c.value = i < 2 ? 'ON' : 'OFF'
      c.dataValidation = { type: 'list', allowBlank: false, formulae: ['"ON,OFF"'] }
    }
    c.font = F.mono(11)
    c.alignment = center
    c.border = box
    // Tiny glyph preview so teachers see what each toggle controls.
    ws.getCell(r, 4).value = { formula: `IMAGE(ENGINE!$H$4&"${el.id}.png")` }
    ws.getRow(r).height = 26
  })
  ws.pageSetup = pageSetup
}

// ================================================================ ENGINE (hidden)
{
  const ws = wb.addWorksheet('ENGINE')
  ws.state = 'hidden' // hidden (not veryHidden) so power users can peek
  ws.getCell('A1').value = 'Deterministic pattern engine — do not edit. Regenerated by products/kodaly-stick-maker/build.mjs'
  ws.getCell('A1').font = F.body(9, C.muted)
  ws.getCell('B1').value = { formula: `F${E_LAST}` } // enabled element count

  // Constants block
  ws.getCell('H1').value = { formula: 'Setup!$C$8' }                                   // Set #
  ws.getCell('H2').value = { formula: 'IF(Setup!$C$7="2/4",2,IF(Setup!$C$7="3/4",3,4))' } // beats/pattern
  ws.getCell('H3').value = { formula: 'Setup!$C$9' }                                   // display mode
  ws.getCell('H4').value = BASE_URL                                                    // glyph base URL

  // Element table: id | name | syllable | beats | enabled | cumulative | rank
  ws.getRow(3).values = ['id', 'name', 'syllable', 'beats', 'enabled', 'cum', 'rank']
  elements.forEach((el, i) => {
    const r = E_ROW0 + i
    ws.getCell(r, 1).value = el.id
    ws.getCell(r, 2).value = el.name
    ws.getCell(r, 3).value = el.syllable
    ws.getCell(r, 4).value = el.beats
    ws.getCell(r, 5).value = { formula: `Setup!$C$${S_ROW0 + i}="ON"` }
    ws.getCell(r, 6).value = { formula: i === 0 ? `IF(E${r},1,0)` : `F${r - 1}+IF(E${r},1,0)` }
    ws.getCell(r, 7).value = { formula: `IF(E${r},F${r},"")` }
  })

  // Pattern matrix. Draw cols B–E (beats 1–4), final cols G–J.
  // draw: deterministic pick among enabled elements, seeded by Set# × pattern × beat.
  // final: applies two-beat handling — a 2-beat element fills its next beat with "cont",
  //        and can't start on the last beat (falls back to ta).
  for (let p = 1; p <= N_PATTERNS; p++) {
    const r = P_ROW0 + p - 1
    ws.getCell(r, 1).value = p
    for (let b = 1; b <= 4; b++) {
      ws.getCell(r, 1 + b).value = {
        formula:
          `IF(${b}>$H$2,"",INDEX($A$${E_ROW0}:$A$${E_LAST},` +
          // Mixing constants chosen so every stride (across sets, patterns, and beats)
          // is coprime to any enabled-element count 2–10 — no repeating columns.
          `MATCH(MOD($H$1*6007+$A${r}*7919+${b}*104729+$A${r}*${b}*2310,$B$1)+1,` +
          `$G$${E_ROW0}:$G$${E_LAST},0)))`,
      }
    }
    for (let b = 1; b <= 4; b++) {
      const draw = `${'BCDE'[b - 1]}${r}`
      const start =
        `IF(${draw}="","",IF(AND(VLOOKUP(${draw},${TBL},4,0)=2,${b}=$H$2),"ta",${draw}))`
      ws.getCell(r, 6 + b).value = {
        formula: b === 1
          ? start
          : `IF(AND(${'GHIJ'[b - 2]}${r}<>"",${'GHIJ'[b - 2]}${r}<>"cont",` +
            `VLOOKUP(${'GHIJ'[b - 2]}${r},${TBL},4,0)=2),"cont",${start})`,
      }
    }
  }
}

// ================================================================ Flashcards
{
  const ws = wb.addWorksheet('Flashcards', { properties: { tabColor: { argb: C.red } } })
  // A pad | B–E card 1 beats | F gutter | G–J card 2 beats | K pad
  const widths = [2, 11, 11, 11, 11, 3, 11, 11, 11, 11, 2]
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w))

  ws.mergeCells('B2:J2')
  ws.getCell('B2').value = { formula: `CONCATENATE("Rhythm Flashcards — Set ",Setup!$C$8,"  ·  ",Setup!$C$7)` }
  ws.getCell('B2').font = F.heading(16)
  ws.getCell('B2').alignment = center
  ws.getRow(2).height = 26

  let card = 0
  for (let cardRow = 0; cardRow < 4; cardRow++) {
    const labelR = 4 + cardRow * 3
    const glyphR = labelR + 1
    ws.getRow(glyphR).height = 92
    ws.getRow(labelR + 2).height = 8
    for (let side = 0; side < 2; side++) {
      card++
      const p = card // patterns 1–8
      const c0 = side === 0 ? 2 : 7
      ws.getCell(labelR, c0).value = card
      ws.getCell(labelR, c0).font = F.body(9, C.muted)
      for (let b = 1; b <= 4; b++) {
        const cell = ws.getCell(glyphR, c0 + b - 1)
        cell.value = { formula: displayFormula(finalCell(p, b)) }
        cell.alignment = center
        cell.font = F.mono(16)
      }
      frame(ws, glyphR, c0, glyphR, c0 + 3)
    }
  }
  ws.getCell('B17').value = `${SITE} · Kodály Stick Sheet Maker`
  ws.getCell('B17').font = F.body(8, C.muted)
  ws.pageSetup = { ...pageSetup, printArea: 'A1:K17' }
}

// ================================================================ Reading Worksheet
{
  const ws = wb.addWorksheet('Worksheet', { properties: { tabColor: { argb: C.orange } } })
  const widths = [3, 4, 13, 13, 13, 13, 3]
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w))

  ws.mergeCells('B2:F2')
  ws.getCell('B2').value = { formula: `CONCATENATE("Rhythm Reading — Set ",Setup!$C$8,"  ·  ",Setup!$C$7)` }
  ws.getCell('B2').font = F.heading(15)
  ws.getRow(2).height = 24
  ws.mergeCells('B3:F3')
  ws.getCell('B3').value = 'Name: ______________________     Say each pattern, then write the syllables under the sticks.'
  ws.getCell('B3').font = F.body(10, C.muted)

  for (let i = 0; i < 8; i++) {
    const p = 9 + i // patterns 9–16
    const glyphR = 5 + i * 3
    const lineR = glyphR + 1
    ws.getRow(glyphR).height = 58
    ws.getRow(lineR).height = 22
    ws.getRow(glyphR + 2).height = 8
    ws.getCell(glyphR, 2).value = `${i + 1}.`
    ws.getCell(glyphR, 2).font = F.body(11, C.text, true)
    for (let b = 1; b <= 4; b++) {
      const cell = ws.getCell(glyphR, 2 + b)
      cell.value = { formula: displayFormula(finalCell(p, b)) }
      cell.alignment = center
      cell.font = F.mono(13)
      // Answer line: bottom border under each beat for students to write syllables.
      ws.getCell(lineR, 2 + b).border = { bottom: { style: 'thin', color: { argb: C.muted } } }
    }
  }
  ws.getCell('B30').value = `${SITE} · Kodály Stick Sheet Maker`
  ws.getCell('B30').font = F.body(8, C.muted)
  ws.pageSetup = { ...pageSetup, printArea: 'A1:G30' }
}

// ================================================================ Dictation Key
{
  const ws = wb.addWorksheet('Dictation Key', { properties: { tabColor: { argb: C.yellow } } })
  const widths = [3, 4, 13, 13, 13, 13, 3]
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w))

  ws.mergeCells('B2:F2')
  ws.getCell('B2').value = { formula: `CONCATENATE("Dictation Key (teacher only) — Set ",Setup!$C$8,"  ·  ",Setup!$C$7)` }
  ws.getCell('B2').font = F.heading(15)
  ws.getRow(2).height = 24
  ws.mergeCells('B3:F3')
  ws.getCell('B3').value = 'Clap or play each pattern 2–3 times. Students write sticks (or syllables) on numbered paper.'
  ws.getCell('B3').font = F.body(10, C.muted)

  for (let i = 0; i < 8; i++) {
    const p = 17 + i // patterns 17–24
    const glyphR = 5 + i * 3
    const sylR = glyphR + 1
    ws.getRow(glyphR).height = 52
    ws.getRow(sylR).height = 16
    ws.getRow(glyphR + 2).height = 6
    ws.getCell(glyphR, 2).value = `${i + 1}.`
    ws.getCell(glyphR, 2).font = F.body(11, C.text, true)
    for (let b = 1; b <= 4; b++) {
      const g = ws.getCell(glyphR, 2 + b)
      g.value = { formula: displayFormula(finalCell(p, b)) }
      g.alignment = center
      g.font = F.mono(13)
      const s = ws.getCell(sylR, 2 + b)
      s.value = { formula: syllableFormula(finalCell(p, b)) }
      s.alignment = center
      s.font = F.mono(10, C.muted)
    }
  }
  ws.getCell('B30').value = `${SITE} · Kodály Stick Sheet Maker`
  ws.getCell('B30').font = F.body(8, C.muted)
  ws.pageSetup = { ...pageSetup, printArea: 'A1:G30' }
}

// ================================================================ Compose
{
  const ws = wb.addWorksheet('Compose', { properties: { tabColor: { argb: C.teal } } })
  const widths = [3, 4, 13, 13, 13, 13, 3]
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w))

  ws.mergeCells('B2:F2')
  ws.getCell('B2').value = 'Compose Your Own Rhythm'
  ws.getCell('B2').font = F.heading(15)
  ws.getRow(2).height = 24
  ws.mergeCells('B3:F3')
  ws.getCell('B3').value = 'Name: ______________________     Write one rhythm element above each heart. Use the bank below.'
  ws.getCell('B3').font = F.body(10, C.muted)

  // Element bank: shows the k-th ENABLED element's glyph + syllable, so the bank
  // always matches the Setup checklist.
  ws.getCell('B5').value = 'Bank:'
  ws.getCell('B5').font = F.body(10, C.text, true)
  // Two bank rows of 5 slots each cover up to 10 enabled elements; empty slots vanish.
  const bankRows = Math.min(Math.ceil(elements.length / 5), 2)
  for (let bankRow = 0; bankRow < bankRows; bankRow++) {
    const gR = 5 + bankRow * 2
    ws.getRow(gR).height = 44
    for (let slot = 1; slot <= 5; slot++) {
      const k = bankRow * 5 + slot
      if (k > elements.length) break
      const kth = `INDEX(ENGINE!$A$${E_ROW0}:$A$${E_LAST},MATCH(${k},ENGINE!$G$${E_ROW0}:$G$${E_LAST},0))`
      const g = ws.getCell(gR, 2 + slot)
      g.value = { formula: `IF(${k}>ENGINE!$B$1,"",IMAGE(ENGINE!$H$4&${kth}&".png"))` }
      g.alignment = center
      const s = ws.getCell(gR + 1, 2 + slot)
      s.value = { formula: `IF(${k}>ENGINE!$B$1,"",VLOOKUP(${kth},ENGINE!$A$${E_ROW0}:$C$${E_LAST},3,0))` }
      s.alignment = center
      s.font = F.mono(10, C.muted)
    }
  }

  const composeStart = 5 + bankRows * 2 + 1
  for (let i = 0; i < 5; i++) {
    const writeR = composeStart + i * 3
    const heartR = writeR + 1
    ws.getRow(writeR).height = 46
    ws.getRow(heartR).height = 40
    ws.getRow(writeR + 2).height = 8
    ws.getCell(writeR, 2).value = `${i + 1}.`
    ws.getCell(writeR, 2).font = F.body(11, C.text, true)
    for (let b = 1; b <= 4; b++) {
      const w = ws.getCell(writeR, 2 + b)
      w.border = { bottom: { style: 'thin', color: { argb: C.muted } } }
      const h = ws.getCell(heartR, 2 + b)
      h.value = { formula: `IF(${b}>ENGINE!$H$2,"",IMAGE(ENGINE!$H$4&"heart.png"))` }
      h.alignment = center
    }
  }
  const footerR = composeStart + 5 * 3
  ws.getCell(footerR, 2).value = `${SITE} · Kodály Stick Sheet Maker`
  ws.getCell(footerR, 2).font = F.body(8, C.muted)
  ws.pageSetup = { ...pageSetup, printArea: `A1:G${footerR}` }
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
