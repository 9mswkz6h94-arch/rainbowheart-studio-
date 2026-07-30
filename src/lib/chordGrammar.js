/**
 * Chord Chart Studio — chord token grammar.
 *
 * Single source of truth for what counts as a valid chord token in this
 * app's dialect. Used by chartEngine.js (parsing/rendering in the browser)
 * AND by netlify/functions/scan-chart.js (validating/normalizing what the
 * chart scanner produces) — previously these were two hand-duplicated
 * copies that had already drifted once (the scanner tried to emit "m7b5"
 * for a half-diminished chord before the grammar here accepted it). This
 * file has zero DOM/browser/Node-specific dependencies so it bundles
 * cleanly for both Vite (browser) and Netlify Functions (esbuild/Node).
 *
 * Grammar: ROOT + optional accidental + optional quality word + optional
 * digits, followed by zero or more additional "alteration" groups (each a
 * quality/added-tone word plus optional digits, e.g. "b5", "#9", "add9",
 * "sus4"), then an optional bare-note slash bass, then optional trailing
 * dots (rhythmic subdivision marks — see chartEngine.js's barsFromTokens).
 * Examples this accepts beyond the historical one-quality-word grammar:
 * "Cm7b5" (half-diminished), "C7#9", "C9sus4", "C13b9", "CmM7"/"Cmmaj7"
 * (minor-major seventh), "C7sus4".
 */
const QUALITY = 'maj|min|m|dim|aug|sus|add|M'
export const CHORD_RE = new RegExp(
  `^(%|[A-G](#|b)?(${QUALITY})?[0-9]*((${QUALITY}|b|#)[0-9]*)*(\\/[A-G](#|b)?)?)(\\.*)$`
)

export const isChordTok = t => CHORD_RE.test(t)

export const isChordLine = l => {
  const t = l.trim().split(/\s+/).filter(Boolean)
  return t.length > 0 && t.every(isChordTok)
}

/* ── Chord normalization ──
   Best-effort rewrite of whatever notation a scan/import produced into
   CHORD_RE's grammar. Never throws — worst case it returns the input
   unchanged and ok:false, so the caller can flag it for the user rather
   than silently corrupting or dropping a chord. */
export function normalizeChord(raw) {
  const tok = String(raw ?? '').trim()
  if (!tok) return { value: '', ok: true }
  if (/^%\.*$/.test(tok)) return { value: tok, ok: true }

  const dotsMatch = tok.match(/\.*$/)
  const dots = dotsMatch ? dotsMatch[0] : ''
  const core = dots ? tok.slice(0, tok.length - dots.length) : tok

  const slashIdx = core.indexOf('/')
  let rootPart = slashIdx === -1 ? core : core.slice(0, slashIdx)
  let bassPart = slashIdx === -1 ? null : core.slice(slashIdx + 1)

  const parseNote = s => {
    const m = s.match(/^([A-Ga-g])([#b♯♭]?)(.*)$/)
    if (!m) return null
    const acc = m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : m[2]
    return { letter: m[1].toUpperCase(), acc, rest: m[3] }
  }

  const rootNote = parseNote(rootPart)
  if (!rootNote) return { value: tok, ok: false }

  let rest = rootNote.rest
    .replace(/^\(|\)$/g, '')
    .replace(/[Δ^]/g, 'maj')
    .replace(/ø/g, 'm7b5')
    .replace(/°/g, 'dim')
    .replace(/^-/, 'm')
    .replace(/\+/g, 'aug')
    .replace(/maj/i, m => 'maj')
    .replace(/min/i, m => 'min')
    .replace(/dim/i, m => 'dim')
    .replace(/aug/i, m => 'aug')
    .replace(/sus/i, m => 'sus')
    .replace(/add/i, m => 'add')

  // "C6/9" style extension slash (not a real bass note) — fold back into root
  if (bassPart != null && /^[0-9]+$/.test(bassPart)) {
    rest += bassPart
    bassPart = null
  }

  let bassNote = null
  if (bassPart != null) {
    const bp = parseNote(bassPart)
    bassNote = bp ? bp.letter + bp.acc : null // quality on a bass note is dropped, unsupported
  }

  const value = rootNote.letter + rootNote.acc + rest + (bassNote ? '/' + bassNote : '') + dots
  return { value, ok: CHORD_RE.test(value) }
}
