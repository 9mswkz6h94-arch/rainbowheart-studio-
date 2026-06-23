const SECTION_LABELS = {
  '#intro':          'Intro',
  '#v':              'Verse',
  '#verse':          'Verse',
  '#c':              'Chorus',
  '#chorus':         'Chorus',
  '#b':              'Bridge',
  '#bridge':         'Bridge',
  '#pre':            'Pre-Chorus',
  '#prechorus':      'Pre-Chorus',
  '#inst':           'Instrumental',
  '#instrumental':   'Instrumental',
  '#outro':          'Outro',
  '#tag':            'Tag',
  '#solo':           'Solo',
}

const CHORD_TOKEN = /^[A-G][b#]?(maj|min|m|M|aug|dim|sus|add|no)?[0-9]*(\/[A-G][b#]?)?[^\s]*$/

function isChordToken(t) {
  return t === '%' || CHORD_TOKEN.test(t)
}

function isChordLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  return tokens.length > 0 && tokens.every(isChordToken)
}

function getSectionLabel(line) {
  const lower = line.trim().toLowerCase()
  for (const [key, label] of Object.entries(SECTION_LABELS)) {
    if (lower === key || lower.startsWith(key + ' ')) return label
  }
  return null
}

export function parseChordMark(text) {
  const lines = text.split('\n').map(l => l.trimEnd())
  const sections = []
  const sectionCounts = {}
  let currentSection = null

  const addSection = (label) => {
    sectionCounts[label] = (sectionCounts[label] || 0) + 1
    currentSection = { label, count: sectionCounts[label], rows: [] }
    sections.push(currentSection)
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) { i++; continue }

    const sectionLabel = getSectionLabel(trimmed)
    if (sectionLabel) {
const SECTION_LABELS = {
  '#intro':          'Intro',
  '#v':              'Verse',
  '#verse':          'Verse',
  '#c':              'Chorus',
  '#chorus':         'Chorus',
  '#b':              'Bridge',
  '#bridge':         'Bridge',
  '#pre':            'Pre-Chorus',
  '#prechorus':      'Pre-Chorus',
  '#inst':           'Instrumental',
  '#instrumental':   'Instrumental',
  '#outro':          'Outro',
  '#tag':            'Tag',
  '#solo':           'Solo',
}

const CHORD_TOKEN = /^[A-G][b#]?(maj|min|m|M|aug|dim|sus|add|no)?[0-9]*(\/[A-G][b#]?)?[^\s]*$/

function isChordToken(t) {
  return t === '%' || CHORD_TOKEN.test(t)
}

function isChordLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  return tokens.length > 0 && tokens.every(isChordToken)
}

function getSectionLabel(line) {
  const lower = line.trim().toLowerCase()
  for (const [key, label] of Object.entries(SECTION_LABELS)) {
    if (lower === key || lower.startsWith(key + ' ')) return label
  }
  return null
}

// Underscore placement:
// In the lyric, an underscore marks the syllable each chord lands on.
//   chord line:  Am G
//   lyric line:  When you _feel the _fire   ->  Am over "feel", G over "fire"
// We convert this into the column-aligned { chords, lyric } the renderer already
// expects, so nothing downstream has to change. Chords attach in order; the text
// before the first underscore gets no chord; `%` markers are skipped for placement.
function placeWithUnderscores(chordLine, lyricLine) {
  const chords = chordLine.trim().split(/\s+/).filter(Boolean)
    .filter(t => t !== '%')
    .map(t => t.replace(/\.+$/, '') || t) // drop trailing beat-dots (e.g. "G..")

  // Strip underscores from the lyric and record the column each one marks.
  let lyric = ''
  const positions = []
  for (let k = 0; k < lyricLine.length; k++) {
    if (lyricLine[k] === '_') positions.push(lyric.length)
    else lyric += lyricLine[k]
  }

  // If the writer didn't actually mark anything, leave it as a plain lyric line.
  if (positions.length === 0) return { chords: chordLine.trim(), lyric: lyricLine.trim() }

  // Build the spaced chord string aligned to those columns.
  let chords_aligned = ''
  for (let n = 0; n < positions.length && n < chords.length; n++) {
    const col = positions[n]
    if (chords_aligned.length < col) {
      chords_aligned += ' '.repeat(col - chords_aligned.length)
    } else if (chords_aligned.length > 0 && !chords_aligned.endsWith(' ')) {
      chords_aligned += ' ' // avoid two chords colliding when words are tight
    }
    chords_aligned += chords[n]
  }

  return { chords: chords_aligned, lyric }
}

export function parseChordMark(text) {
  const lines = text.split('\n').map(l => l.trimEnd())
  const sections = []
  const sectionCounts = {}
  let currentSection = null

  const addSection = (label) => {
    sectionCounts[label] = (sectionCounts[label] || 0) + 1
    currentSection = { label, count: sectionCounts[label], rows: [] }
    sections.push(currentSection)
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) { i++; continue }

    const sectionLabel = getSectionLabel(trimmed)
    if (sectionLabel) {
      addSection(sectionLabel)
      i++
      continue
    }

    if (!currentSection) addSection('Intro')

    if (isChordLine(trimmed)) {
      // Peek ahead for a lyric line
      let lyric = null
      let j = i + 1
      while (j < lines.length && !lines[j].trim()) j++
      if (j < lines.length) {
        const next = lines[j].trim()
        if (next && !isChordLine(next) && !getSectionLabel(next)) {
          lyric = next
          i = j
        }
      }

      if (lyric && lyric.includes('_')) {
        // Underscore-marked lyric -> align chords to the marked syllables.
        const placed = placeWithUnderscores(trimmed, lyric)
        currentSection.rows.push({ type: 'chord-lyric', chords: placed.chords, lyric: placed.lyric })
      } else {
        // No markers: keep the line as written (column alignment / instrumental).
        currentSection.rows.push({ type: 'chord-lyric', chords: trimmed, lyric })
      }
    } else {
      currentSection.rows.push({ type: 'lyric', lyric: trimmed })
    }
    i++
  }

  return sections
}

export function buildRoadmap(sections) {
  const SHORT = {
    'Verse': 'V', 'Chorus': 'C', 'Bridge': 'B',
    'Pre-Chorus': 'PC', 'Instrumental': 'Inst',
    'Outro': 'Outro', 'Intro': 'Intro', 'Tag': 'Tag', 'Solo': 'Solo',
  }

  const items = []
  let i = 0
  while (i < sections.length) {
    const label = sections[i].label
    let count = 1
    while (i + count < sections.length && sections[i + count].label === label) count++
    const short = SHORT[label] || label
    items.push(count > 1 ? `${short} ×${count}` : short)
    i += count
  }
  return items.join(' → ')
}
