import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Note, Chord, Scale } from 'tonal'
import { useAuth } from '../context/AuthContext'

// ─── Instrument configs ───────────────────────────────────────────────────────
const INSTRUMENTS = [
  { key: 'ukulele',     label: 'Ukulele',         tuning: ['G4','C4','E4','A4'],              frets: 12 },
  { key: 'tenorGuitar', label: 'Tenor Guitar',    tuning: ['C3','G3','D4','A4'],              frets: 12 },
  { key: 'guitarlele',  label: 'Guitarlele',       tuning: ['A2','D3','G3','C4','E4','A4'],    frets: 12 },
  { key: 'guitar',      label: 'Acoustic Guitar', tuning: ['E2','A2','D3','G3','B3','E4'],    frets: 12 },
  { key: 'bass',        label: 'Bass Guitar',     tuning: ['E1','A1','D2','G2'],              frets: 12 },
]

const CHORD_TYPES = [
  { value: 'major',                   label: 'Major' },
  { value: 'minor',                   label: 'Minor' },
  { value: 'dominant seventh',        label: 'Dom 7' },
  { value: 'major seventh',           label: 'Maj 7' },
  { value: 'minor seventh',           label: 'Min 7' },
  { value: 'diminished',              label: 'Dim' },
  { value: 'augmented',               label: 'Aug' },
  { value: 'suspended second',        label: 'Sus2' },
  { value: 'suspended fourth',        label: 'Sus4' },
  { value: 'major sixth',             label: 'Maj 6' },
  { value: 'minor sixth',             label: 'Min 6' },
  { value: 'dominant ninth',          label: 'Dom 9' },
  { value: 'minor ninth',             label: 'Min 9' },
  { value: 'major ninth',             label: 'Maj 9' },
  { value: 'half-diminished seventh', label: 'Half Dim' },
  { value: 'diminished seventh',      label: 'Dim 7' },
]

const SCALE_TYPES = [
  { value: 'major',            label: 'Major' },
  { value: 'minor',            label: 'Natural Minor' },
  { value: 'harmonic minor',   label: 'Harmonic Minor' },
  { value: 'melodic minor',    label: 'Melodic Minor' },
  { value: 'major pentatonic', label: 'Pentatonic Maj' },
  { value: 'minor pentatonic', label: 'Pentatonic Min' },
  { value: 'blues',            label: 'Blues' },
  { value: 'dorian',           label: 'Dorian' },
  { value: 'phrygian',         label: 'Phrygian' },
  { value: 'lydian',           label: 'Lydian' },
  { value: 'mixolydian',       label: 'Mixolydian' },
  { value: 'locrian',          label: 'Locrian' },
]

const ROOTS_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const ROOTS_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
const TO_FLAT     = { 'C#':'Db','D#':'Eb','F#':'Gb','G#':'Ab','A#':'Bb' }
const TO_SHARP    = { 'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#' }

// ─── Fretboard layout constants ───────────────────────────────────────────────
const L_PAD   = 58   // space for open-string labels
const R_PAD   = 12
const T_PAD   = 22   // room for fret numbers
const B_PAD   = 14
const FRET_W  = 50
const STR_H   = 28
const DOT_R   = 12
const N_FRETS = 12
const LABEL_X = 38  // x center for string labels / open-string dots

// ─── Note positions ───────────────────────────────────────────────────────────
function getPositions(tuning, notes) {
  if (!notes || notes.length === 0) return []
  const rootChroma = Note.chroma(notes[0])
  const chromas    = new Set(notes.map(n => Note.chroma(n)))

  return tuning.flatMap((openNote, stringIdx) => {
    const openMidi = Note.midi(openNote)
    if (openMidi == null) return []
    return Array.from({ length: N_FRETS + 1 }, (_, fret) => {
      const chroma = (openMidi + fret) % 12
      if (!chromas.has(chroma)) return null
      const noteName = notes.find(n => Note.chroma(n) === chroma)
        ?? Note.pitchClass(Note.fromMidi(openMidi + fret))
      return { string: stringIdx, fret, note: noteName, isRoot: chroma === rootChroma }
    }).filter(Boolean)
  })
}

// ─── All voicings — one per neck position window ─────────────────────────────
function getAllVoicings(tuning, positions) {
  const starts = [0, 2, 4, 5, 7, 9, 12]
  const seen   = new Set()
  const result = []

  for (const start of starts) {
    const voicing = tuning.map((_, si) => {
      const cands = positions
        .filter(p => p.string === si && p.fret >= start && p.fret <= start + 4)
        .sort((a, b) => a.fret - b.fret)
      return cands[0] ?? null
    })
    if (voicing.filter(Boolean).length < Math.ceil(tuning.length / 2)) continue

    const key = voicing.map(p => p ? `${p.fret}` : 'x').join('-')
    if (seen.has(key)) continue
    seen.add(key)

    const hasFretted = voicing.some(p => p && p.fret > 0)
    const minFret    = Math.min(...voicing.filter(p => p && p.fret > 0).map(p => p.fret))
    const label      = !hasFretted || start === 0 ? 'Open Position' : `${minFret}th Position`
    result.push({ label, voicing })
  }

  return result.length ? result : [{ label: 'Open Position', voicing: tuning.map(() => null) }]
}

// ─── Chord Box SVG (vertical diagram) ────────────────────────────────────────
const CB_SW = 26   // string spacing
const CB_FH = 24   // fret height
const CB_LP = 18   // left pad
const CB_RP = 18   // right pad
const CB_TP = 26   // top pad (O/X markers)
const CB_BP = 14   // bottom pad
const CB_FRETS = 4
const CB_DOT_R = 9

function ChordBox({ tuning, voicing }) {
  const n = tuning.length

  // Compute fret offset so dots sit within the 4-row grid
  const frettedFrets = voicing.filter(p => p && p.fret > 0).map(p => p.fret)
  const minFret  = frettedFrets.length ? Math.min(...frettedFrets) : 0
  const offset   = Math.max(0, minFret - 1)   // row 1 = minFret
  const isOpen   = offset === 0

  const rPad = isOpen ? CB_RP : 36             // extra room for fret label
  const svgW = CB_LP + (n - 1) * CB_SW + rPad
  const svgH = CB_TP + CB_FRETS * CB_FH + CB_BP

  const sx = i => CB_LP + i * CB_SW
  const fy = f => CB_TP + f * CB_FH

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="cse-chordbox" aria-label="Chord diagram">
      {/* Top line: thick nut when open, regular fret line otherwise */}
      <line x1={sx(0)} y1={fy(0)} x2={sx(n-1)} y2={fy(0)}
        className={isOpen ? 'cse-nut' : 'cse-fret-line'} />

      {/* Fret number label (non-open positions) */}
      {!isOpen && (
        <text x={sx(n-1) + 6} y={fy(1) - CB_FH / 2 + 4}
          className="cse-fret-num" textAnchor="start">
          {minFret}fr
        </text>
      )}

      {/* Remaining fret lines */}
      {Array.from({ length: CB_FRETS }, (_, f) => (
        <line key={f} x1={sx(0)} y1={fy(f+1)} x2={sx(n-1)} y2={fy(f+1)} className="cse-fret-line" />
      ))}

      {/* String lines */}
      {tuning.map((_, i) => (
        <line key={i} x1={sx(i)} y1={fy(0)} x2={sx(i)} y2={fy(CB_FRETS)} className="cse-string-line" />
      ))}

      {/* String name labels at bottom */}
      {tuning.map((openNote, i) => (
        <text key={i} x={sx(i)} y={svgH - 2} textAnchor="middle" className="cse-fret-num">
          {Note.pitchClass(openNote)}
        </text>
      ))}

      {/* Voicing: X / open circle / fretted dot */}
      {voicing.map((pos, i) => {
        if (!pos) return (
          <text key={i} x={sx(i)} y={CB_TP - 8} textAnchor="middle" className="cse-cb-mute">✕</text>
        )
        if (pos.fret === 0) return (
          <circle key={i} cx={sx(i)} cy={CB_TP - 12} r={6}
            className={pos.isRoot ? 'cse-cb-open-root' : 'cse-cb-open'} />
        )
        // Offset dot into the visible 4-row window
        const row = pos.fret - offset
        const cy  = fy(row) - CB_FH / 2
        return (
          <g key={i}>
            <circle cx={sx(i)} cy={cy} r={CB_DOT_R}
              className={pos.isRoot ? 'cse-dot-root' : 'cse-dot'} />
            <text x={sx(i)} y={cy + 4} textAnchor="middle"
              className={pos.isRoot ? 'cse-dot-text-root' : 'cse-dot-text'}>
              {pos.note}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Fretboard SVG ────────────────────────────────────────────────────────────
function Fretboard({ tuning, positions }) {
  const n     = tuning.length
  const svgW  = L_PAD + N_FRETS * FRET_W + R_PAD
  const svgH  = T_PAD + (n - 1) * STR_H + B_PAD
  const posSet = new Set(positions.map(p => `${p.string}-${p.fret}`))

  const sy = i => T_PAD + i * STR_H
  const fx = f => L_PAD + f * FRET_W
  // Dot center x for a given fret (1-based; sits between lines f-1 and f)
  const dotX = f => L_PAD + (f - 1) * FRET_W + FRET_W / 2

  const midY = T_PAD + ((n - 1) * STR_H) / 2

  // Standard fretboard inlay positions
  const singleDots = [3, 5, 7, 9].filter(f => f <= N_FRETS)
  const doubleFret  = 12

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="cse-fretboard"
      aria-label="Fretboard diagram"
    >
      {/* ── Fretboard position markers (inlays) ── */}
      {singleDots.map(f => (
        <circle key={f} cx={dotX(f)} cy={midY} r={4} className="cse-inlay" />
      ))}
      {doubleFret <= N_FRETS && (
        <>
          <circle cx={dotX(doubleFret)} cy={T_PAD + (n - 1) * STR_H * 0.25} r={4} className="cse-inlay" />
          <circle cx={dotX(doubleFret)} cy={T_PAD + (n - 1) * STR_H * 0.75} r={4} className="cse-inlay" />
        </>
      )}

      {/* ── Fret lines ── */}
      {Array.from({ length: N_FRETS + 1 }, (_, f) => (
        <line
          key={f}
          x1={fx(f)} y1={T_PAD - 4}
          x2={fx(f)} y2={T_PAD + (n - 1) * STR_H + 4}
          className={f === 0 ? 'cse-nut' : 'cse-fret-line'}
        />
      ))}

      {/* ── String lines ── */}
      {tuning.map((_, i) => (
        <line
          key={i}
          x1={fx(0)} y1={sy(i)}
          x2={fx(N_FRETS)} y2={sy(i)}
          className="cse-string-line"
        />
      ))}

      {/* ── Fret number labels ── */}
      {[3, 5, 7, 9, 12].filter(f => f <= N_FRETS).map(f => (
        <text key={f} x={dotX(f)} y={T_PAD - 6} textAnchor="middle" className="cse-fret-num">
          {f}
        </text>
      ))}

      {/* ── String labels / open-string dots ── */}
      {tuning.map((openNote, i) => {
        const openPos = positions.find(p => p.string === i && p.fret === 0)
        const pc = Note.pitchClass(openNote)
        return (
          <g key={i}>
            {openPos ? (
              <>
                <circle cx={LABEL_X} cy={sy(i)} r={DOT_R}
                  className={openPos.isRoot ? 'cse-dot-root' : 'cse-dot'} />
                <text x={LABEL_X} y={sy(i) + 4} textAnchor="middle"
                  className={openPos.isRoot ? 'cse-dot-text-root' : 'cse-dot-text'}>
                  {pc}
                </text>
              </>
            ) : (
              <text x={LABEL_X} y={sy(i) + 4} textAnchor="middle" className="cse-string-label">
                {pc}
              </text>
            )}
          </g>
        )
      })}

      {/* ── Note dots (frets 1–12) ── */}
      {positions.filter(p => p.fret > 0).map(({ string, fret, note, isRoot }, idx) => (
        <g key={idx}>
          <circle
            cx={dotX(fret)} cy={sy(string)} r={DOT_R}
            className={isRoot ? 'cse-dot-root' : 'cse-dot'}
          />
          <text
            x={dotX(fret)} y={sy(string) + 4}
            textAnchor="middle"
            className={isRoot ? 'cse-dot-text-root' : 'cse-dot-text'}
          >
            {note}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ─── Studio tools shown in the upsell section ────────────────────────────────
const STUDIO_TOOLS = [
  { emoji: '🎸', label: 'Chord Chart Builder',  desc: 'Print-ready charts for gig night.' },
  { emoji: '🎼', label: 'Tab Builder',           desc: 'Fret grids with playback & export.' },
  { emoji: '🎤', label: 'Shows',                 desc: 'Shareable set lists for the whole band.' },
  { emoji: '🥁', label: 'Groove Builder',        desc: 'Drum patterns in any time signature.' },
  { emoji: '📄', label: 'Groove Sheet',          desc: 'Printable drum charts per song.' },
  { emoji: '🥁', label: 'Metronome',             desc: 'Click track with tap tempo, no login needed.' },
  { emoji: '📚', label: 'Heart Beats Practice',  desc: 'Daily practice tracking for students.' },
]

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ChordScaleExplorer() {
  const { user } = useAuth()
  const [instrKey,   setInstrKey]   = useState('guitar')
  const [mode,       setMode]       = useState('chord')
  const [root,       setRoot]       = useState('C')
  const [useFlats,   setUseFlats]   = useState(false)
  const [chordType,  setChordType]  = useState('major')
  const [scaleType,  setScaleType]  = useState('major')
  const [posIdx,     setPosIdx]     = useState(0)

  const instrument = INSTRUMENTS.find(i => i.key === instrKey)
  const roots = useFlats ? ROOTS_FLAT : ROOTS_SHARP

  function handleAccidentalToggle() {
    const map = useFlats ? TO_SHARP : TO_FLAT
    setRoot(r => map[r] ?? r)
    setUseFlats(f => !f)
  }

  const { notes, displayName } = useMemo(() => {
    if (mode === 'chord') {
      const c = Chord.get(`${root} ${chordType}`)
      return { notes: c.notes ?? [], displayName: c.name || `${root} ${chordType}` }
    } else {
      const s = Scale.get(`${root} ${scaleType}`)
      return { notes: s.notes ?? [], displayName: s.name || `${root} ${scaleType}` }
    }
  }, [mode, root, chordType, scaleType])

  const positions = useMemo(
    () => getPositions(instrument.tuning, notes),
    [instrument.tuning, notes]
  )

  const voicings = useMemo(
    () => mode === 'chord' ? getAllVoicings(instrument.tuning, positions) : [],
    [mode, instrument.tuning, positions]
  )

  useEffect(() => { setPosIdx(0) }, [root, chordType, instrKey])

  const safeIdx = Math.min(posIdx, Math.max(0, voicings.length - 1))
  const currentVoicing = voicings[safeIdx]

  const types       = mode === 'chord' ? CHORD_TYPES : SCALE_TYPES
  const selectedType = mode === 'chord' ? chordType : scaleType
  const setType     = mode === 'chord' ? setChordType : setScaleType

  return (
    <div className="cse-page">
      <div className="container">

        <div className="cse-header">
          <div className="cse-free-badge">✨ Free tool — no account needed</div>
          <h1>Chord &amp; Scale Explorer</h1>
          <p>Select an instrument, root note, and chord or scale to see all positions on the fretboard.</p>
        </div>

        {/* Instrument tabs */}
        <div className="cse-instrument-tabs">
          {INSTRUMENTS.map(inst => (
            <button
              key={inst.key}
              onClick={() => setInstrKey(inst.key)}
              className={'cse-tab' + (instrKey === inst.key ? ' active' : '')}
            >
              {inst.label}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="cse-controls">

          {/* Mode toggle */}
          <div className="cse-control-group">
            <label className="cse-label">Mode</label>
            <div className="cse-toggle">
              <button
                className={'cse-toggle-btn' + (mode === 'chord' ? ' active' : '')}
                onClick={() => setMode('chord')}
              >Chord</button>
              <button
                className={'cse-toggle-btn' + (mode === 'scale' ? ' active' : '')}
                onClick={() => setMode('scale')}
              >Scale</button>
            </div>
          </div>

          {/* Root note */}
          <div className="cse-control-group">
            <div className="cse-label-row">
              <label className="cse-label">Root Note</label>
              <button className="cse-accidental-toggle" onClick={handleAccidentalToggle}>
                {useFlats ? '♭ Flats' : '♯ Sharps'}
              </button>
            </div>
            <div className="cse-root-grid">
              {roots.map(r => (
                <button
                  key={r}
                  onClick={() => setRoot(r)}
                  className={'cse-root-btn' + (root === r ? ' active' : '')}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Type selector */}
          <div className="cse-control-group">
            <label className="cse-label">{mode === 'chord' ? 'Chord' : 'Scale'} Type</label>
            <div className="cse-type-grid">
              {types.map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={'cse-type-btn' + (selectedType === t.value ? ' active' : '')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Fretboard display */}
        <div className="cse-board-wrap">
          <div className="cse-board-header">
            <h2 className="cse-chord-name">{displayName}</h2>
            <div className="cse-notes-row">
              {notes.map(n => (
                <span key={n} className="cse-note-pill">{n}</span>
              ))}
              {notes.length === 0 && (
                <span className="cse-empty">No notes found for this selection.</span>
              )}
            </div>
          </div>
          {/* Chord box — chord mode only */}
          {mode === 'chord' && currentVoicing && (
            <div className="cse-chordbox-wrap">
              <div className="cse-chordbox-nav">
                <button
                  className="cse-pos-arrow"
                  onClick={() => setPosIdx(i => Math.max(0, i - 1))}
                  disabled={safeIdx === 0}
                >‹</button>
                <span className="cse-chordbox-label">
                  {currentVoicing.label} &nbsp;
                  <span className="cse-pos-count">{safeIdx + 1} / {voicings.length}</span>
                </span>
                <button
                  className="cse-pos-arrow"
                  onClick={() => setPosIdx(i => Math.min(voicings.length - 1, i + 1))}
                  disabled={safeIdx === voicings.length - 1}
                >›</button>
              </div>
              <ChordBox tuning={instrument.tuning} voicing={currentVoicing.voicing} />
            </div>
          )}

          <div className="cse-fretboard-scroll">
            <Fretboard tuning={instrument.tuning} positions={positions} />
          </div>
          <p className="cse-hint">
            Filled dots = root &nbsp;·&nbsp; Outlined dots = chord/scale tones &nbsp;·&nbsp; Open strings highlighted on left
          </p>
        </div>

        {/* Studio upsell — shown only to guests */}
        {!user && (
          <div className="cse-upsell">
            <div className="cse-upsell-text">
              <h2>Like this? There's a whole studio waiting.</h2>
              <p>
                Get Studio Access to unlock a full suite of musician tools —
                built for teachers, students, and performers.
              </p>
              <div className="cse-upsell-ctas">
                <Link to="/login" className="btn btn-primary">Get Studio Access →</Link>
                <a href="/#services" className="btn btn-outline">See What We Offer</a>
              </div>
            </div>
            <div className="cse-upsell-grid">
              {STUDIO_TOOLS.map(t => (
                <div key={t.label} className="cse-upsell-card">
                  <span className="cse-upsell-emoji">{t.emoji}</span>
                  <div>
                    <strong>{t.label}</strong>
                    <p>{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
