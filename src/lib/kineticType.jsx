/** Shared kinetic-type helpers for the Live Stage Cue displays (PresentDisplay, the
 *  performer's cue sheet, and PresentAudience, the crowd-facing subtitle screen) — kept in
 *  one place so the section-type classification and per-word stagger markup can't drift
 *  between the two renderers. */

/** Classifies a resolved section label (chartEngine's `resolveLabel` output, e.g. "Chorus",
 *  "Verse 2", "Pre-Chorus") into one of the kinetic-type treatments styled in index.css —
 *  each section type gets its own color/motion signature, the way a lyric video gives the
 *  chorus a different visual treatment than the verses. */
export function sectionKineticTheme(label) {
  if (label.startsWith('Chorus') || label.startsWith('Hook') || label.startsWith('Refrain')) return 'chorus'
  if (label.startsWith('Bridge')) return 'bridge'
  if (label.startsWith('Intro') || label.startsWith('Outro') || label.startsWith('Solo') ||
      label.startsWith('Instrumental') || label.startsWith('Interlude')) return 'instrumental'
  return 'verse'
}

/** Splits a lyric line into per-word spans carrying a `--i` index, so CSS can stagger each
 *  word's entrance (kt-word, styled in index.css) instead of the whole line arriving at once.
 *  Whitespace is kept as plain text between spans so wrapping and spacing behave exactly like
 *  the unsplit line did.
 *
 *  `lineIndex`, when given (PresentAudience's phrase-by-phrase pacing), also stamps a `--li`
 *  custom property so the per-word entrance delay can be offset by which line it's in
 *  (see `--pa-line-step` in index.css) — a whole line gets its turn before the next one's
 *  words start popping in, instead of every line's words starting at once. PresentDisplay
 *  doesn't pass it, so its words keep starting together exactly as before. */
export function KineticWords({ text, theme, lineIndex }) {
  let i = 0
  const lineStyle = lineIndex != null ? { '--li': lineIndex } : null
  return text.split(/(\s+)/).map((tok, k) =>
    /^\s+$/.test(tok) || tok === ''
      ? tok
      : <span key={k} className={`kt-word kt-${theme}`} style={{ '--i': i++, ...lineStyle }}>{tok}</span>
  )
}
