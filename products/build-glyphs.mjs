// Renders the Kodály glyph SVGs to PNG.
// Output goes two places:
//   public/glyphs/kodaly/   — deployed by Netlify, used by workbook IMAGE() formulas
//   products/glyphs/kodaly/preview.png — contact sheet for eyeballing the set
import { Resvg } from '@resvg/resvg-js'
import { ELEMENTS, EXTRAS } from './glyphs/kodaly/glyphs.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'glyphs', 'kodaly')
mkdirSync(outDir, { recursive: true })

const SIZE = 480 // 2× the 240 canvas: crisp at flashcard print size

const renderPng = (svgText) =>
  new Resvg(svgText, { fitTo: { mode: 'width', value: SIZE } }).render().asPng()

const all = [...ELEMENTS, ...EXTRAS]
for (const g of all) {
  writeFileSync(join(outDir, `${g.id}.png`), renderPng(g.svg))
  console.log(`rendered ${g.id}.png`)
}

// Contact sheet: one row per glyph with its id, for quick visual review.
const COLS = 4
const CELL = 260
const rows = Math.ceil(all.length / COLS)
const tiles = all.map((g, i) => {
  const x = (i % COLS) * CELL
  const y = Math.floor(i / COLS) * CELL
  const inner = g.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  return `<g transform="translate(${x + 10},${y})">` +
    `<rect x="0" y="0" width="${CELL - 20}" height="${CELL - 20}" fill="#fff" stroke="#ccc"/>` +
    `<g transform="translate(0,-10) scale(1)">${inner}</g>` +
    `<text x="${(CELL - 20) / 2}" y="${CELL - 32}" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#333">${g.id}</text>` +
    `</g>`
}).join('')
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COLS * CELL} ${rows * CELL}" width="${COLS * CELL}" height="${rows * CELL}"><rect width="100%" height="100%" fill="#f4f4f4"/>${tiles}</svg>`
writeFileSync(join(here, 'glyphs', 'kodaly', 'preview.png'), new Resvg(sheet).render().asPng())
console.log('rendered preview.png contact sheet')
