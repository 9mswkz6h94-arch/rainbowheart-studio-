// Kodály stick-notation glyph set — single source of truth.
// Each glyph is authored as an SVG on a 240×240 canvas, pure black strokes so
// photocopied masters stay crisp. build-glyphs.mjs renders these to PNG in
// public/glyphs/kodaly/ where Netlify serves them for the workbook IMAGE() formulas.

const STEM_W = 16
const TOP = 44
const BOT = 204
const BEAM_H = 18

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">${body}</svg>`

const stem = (x, top = TOP, bot = BOT) =>
  `<rect x="${x - STEM_W / 2}" y="${top}" width="${STEM_W}" height="${bot - top}" fill="#000"/>`

const beam = (x1, x2, y = TOP) =>
  `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="${BEAM_H}" fill="#000"/>`

// Eighth-note flag for unbeamed eighths (tam-ti / ti-tam)
const flag = (x) =>
  `<path d="M ${x + STEM_W / 2} ${TOP} C ${x + 52} ${TOP + 22}, ${x + 56} ${TOP + 58}, ${x + 24} ${TOP + 84} C ${x + 44} ${TOP + 52}, ${x + 36} ${TOP + 30}, ${x + STEM_W / 2} ${TOP + 22} Z" fill="#000"/>`

const dot = (cx, cy = 190) => `<circle cx="${cx}" cy="${cy}" r="11" fill="#000"/>`

// Elements are listed in Kodály pedagogical order. `beats` drives the engine's
// half-note continuation logic; `locked` elements can't be switched off in Setup.
export const ELEMENTS = [
  {
    id: 'ta', name: 'Ta (quarter note)', syllable: 'ta', beats: 1, locked: true,
    svg: svg(stem(120)),
  },
  {
    id: 'titi', name: 'Ti-ti (two eighths)', syllable: 'ti-ti', beats: 1,
    svg: svg(stem(78) + stem(162) + beam(70, 170)),
  },
  {
    id: 'rest', name: 'Rest (quarter rest)', syllable: '(rest)', beats: 1,
    svg: svg(
      `<path d="M 104 44 L 148 92 L 106 138 L 146 184" fill="none" stroke="#000" stroke-width="20" stroke-linecap="square"/>` +
      `<path d="M 146 184 C 112 164, 96 186, 116 210" fill="none" stroke="#000" stroke-width="16" stroke-linecap="round"/>`
    ),
  },
  {
    id: 'taa', name: 'Ta-a (half note)', syllable: 'ta–a', beats: 2,
    svg: svg(
      `<ellipse cx="108" cy="182" rx="34" ry="24" fill="none" stroke="#000" stroke-width="14"/>` +
      stem(134, TOP, 182)
    ),
  },
  {
    id: 'tikatika', name: 'Tika-tika (four sixteenths)', syllable: 'ti-ka-ti-ka', beats: 1,
    svg: svg(
      stem(54) + stem(98) + stem(142) + stem(186) +
      beam(46, 194) + beam(46, 194, TOP + 30)
    ),
  },
  {
    id: 'titika', name: 'Ti-tika (eighth + two sixteenths)', syllable: 'ti-ti-ka', beats: 1,
    svg: svg(
      stem(64) + stem(120) + stem(176) +
      beam(56, 184) + beam(112, 184, TOP + 30)
    ),
  },
  {
    id: 'tikati', name: 'Tika-ti (two sixteenths + eighth)', syllable: 'ti-ka-ti', beats: 1,
    svg: svg(
      stem(64) + stem(120) + stem(176) +
      beam(56, 184) + beam(56, 128, TOP + 30)
    ),
  },
  {
    id: 'syncopa', name: 'Syncopa (eighth–quarter–eighth)', syllable: 'ti-ta-ti', beats: 2,
    svg: svg(
      stem(56) + stem(120) + stem(184) +
      beam(48, 100) + beam(140, 192)
    ),
  },
  {
    id: 'tamti', name: 'Tam-ti (dotted quarter + eighth)', syllable: 'tam-ti', beats: 2,
    svg: svg(stem(76) + dot(112) + stem(172) + flag(172)),
  },
  {
    id: 'titam', name: 'Ti-tam (eighth + dotted quarter)', syllable: 'ti-tam', beats: 2,
    svg: svg(stem(64) + flag(64) + stem(164) + dot(200)),
  },
]

// Non-element glyphs used by the workbook layouts.
export const EXTRAS = [
  {
    // Second beat of a two-beat element rendered in a per-beat grid.
    id: 'cont', syllable: '–',
    svg: svg(`<rect x="76" y="112" width="88" height="16" fill="#000"/>`),
  },
  {
    // Beat heart for compose-your-own pages (a Kodály classroom staple).
    id: 'heart', syllable: '',
    svg: svg(
      `<path d="M 120 200 C 60 150, 40 110, 62 78 C 82 50, 114 58, 120 88 C 126 58, 158 50, 178 78 C 200 110, 180 150, 120 200 Z" fill="none" stroke="#000" stroke-width="13"/>`
    ),
  },
]
