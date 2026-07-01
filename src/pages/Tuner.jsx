import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  TunerAudio, freqToNote, closestString,
  INSTRUMENTS, loadTunerPrefs, saveTunerPrefs,
} from '../lib/tuner'

const STUDIO_TOOLS = [
  { emoji: '🎸', label: 'Chord Chart Builder',  desc: 'Print-ready charts for gig night.' },
  { emoji: '🎵', label: 'Chord & Scale Explorer', desc: 'Every chord and scale on your instrument.' },
  { emoji: '🎼', label: 'Tab Builder',           desc: 'Fret grids with playback & export.' },
  { emoji: '🎵', label: 'Set Lists',             desc: 'Shareable charts for the whole band.' },
  { emoji: '🥁', label: 'Groove Builder',        desc: 'Drum patterns in any time signature.' },
  { emoji: '📚', label: 'Heart Beats Practice',  desc: 'Daily practice tracking for students.' },
]

// ─── Constants ────────────────────────────────────────────────────────────────

const CLARITY_THRESHOLD = 0.92
const IN_TUNE_CENTS = 5   // ±5 cents = green
const CLOSE_CENTS = 15    // ±15 cents = yellow

// ─── Meter needle ─────────────────────────────────────────────────────────────

function TunerMeter({ cents }) {
  const clampedCents = Math.max(-50, Math.min(50, cents ?? 0))
  const angle = (clampedCents / 50) * 45  // ±45° sweep

  return (
    <div className="tuner-meter" aria-hidden="true">
      <svg viewBox="0 0 220 130" className="tuner-meter-svg">
        {[-50,-40,-30,-20,-10,0,10,20,30,40,50].map(v => {
          const a = (v / 50) * 45
          const rad = ((a - 90) * Math.PI) / 180
          const r1 = 90, r2 = v % 10 === 0 ? 78 : 84
          return (
            <line key={v}
              x1={110 + r1 * Math.cos(rad)} y1={120 + r1 * Math.sin(rad)}
              x2={110 + r2 * Math.cos(rad)} y2={120 + r2 * Math.sin(rad)}
              stroke={v === 0 ? 'var(--teal)' : 'var(--border)'}
              strokeWidth={v % 10 === 0 ? 2 : 1}
            />
          )
        })}
        <path d="M 20 120 A 90 90 0 0 1 200 120"
          fill="none" stroke="var(--border)" strokeWidth="2" />
        <line
          x1="110" y1="120"
          x2={110 + 80 * Math.cos(((angle - 90) * Math.PI) / 180)}
          y2={120 + 80 * Math.sin(((angle - 90) * Math.PI) / 180)}
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ transition: 'x2 0.08s ease, y2 0.08s ease' }}
        />
        <circle cx="110" cy="120" r="5" fill="var(--primary)" />
        <circle cx="110" cy="108" r="3" fill="var(--teal)" />
      </svg>
    </div>
  )
}

// ─── String selector ──────────────────────────────────────────────────────────

function StringSelector({ instrument, activeString, onSelect }) {
  return (
    <div className="tuner-strings" role="group" aria-label="String selector">
      {instrument.strings.map((str, i) => (
        <button
          key={str.name + i}
          className={`tuner-string-btn${activeString === i ? ' tuner-string-btn--active' : ''}`}
          onClick={() => onSelect(activeString === i ? null : i)}
          aria-pressed={activeString === i}
        >
          {str.display}
        </button>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Tuner() {
  const { user } = useAuth()
  const prefs = loadTunerPrefs()

  const [mode, setMode] = useState(prefs.mode ?? 'chromatic')
  const [instrumentKey, setInstrumentKey] = useState(prefs.instrumentKey ?? 'guitar-standard')
  const [activeString, setActiveString] = useState(null)
  const [micState, setMicState] = useState('idle')  // idle | requesting | active | denied
  const [pitch, setPitch] = useState(null)
  const [clarity, setClarity] = useState(0)

  const audioRef = useRef(null)

  const instrument = INSTRUMENTS.find(i => i.key === instrumentKey) ?? INSTRUMENTS[0]

  // persist prefs
  useEffect(() => {
    saveTunerPrefs({ mode, instrumentKey })
  }, [mode, instrumentKey])

  // cleanup on unmount
  useEffect(() => {
    return () => { if (audioRef.current) audioRef.current.stop() }
  }, [])

  const handleResult = useCallback(({ pitch: p, clarity: c }) => {
    setPitch(p)
    setClarity(c)
  }, [])

  async function startMic() {
    setMicState('requesting')
    try {
      const engine = new TunerAudio(handleResult)
      await engine.start()
      audioRef.current = engine
      setMicState('active')
    } catch {
      setMicState('denied')
    }
  }

  function stopMic() {
    if (audioRef.current) { audioRef.current.stop(); audioRef.current = null }
    setPitch(null)
    setMicState('idle')
  }

  // ── Compute what to display ───────────────────────────────────────────────

  let noteInfo   = null
  let centsOff   = 0
  let tuneStatus = null   // 'in-tune' | 'sharp' | 'flat'
  let targetStr  = null

  if (pitch) {
    noteInfo = freqToNote(pitch)
    if (noteInfo) {
      centsOff = noteInfo.cents

      if (mode === 'instrument') {
        const ref = activeString !== null
          ? instrument.strings[activeString]
          : closestString(pitch, instrument)
        if (ref) {
          targetStr = ref
          const semiDiff = 12 * Math.log2(pitch / ref.freq)
          centsOff = Math.round(semiDiff * 100)
        }
      }

      const absCents = Math.abs(centsOff)
      if (absCents <= IN_TUNE_CENTS)   tuneStatus = 'in-tune'
      else if (centsOff > 0)           tuneStatus = 'sharp'
      else                             tuneStatus = 'flat'
    }
  }

  const displayNote = noteInfo ? `${noteInfo.name}${noteInfo.octave}` : '—'
  const displayCents = pitch ? (centsOff > 0 ? `+${centsOff}` : `${centsOff}`) : '—'
  const displayFreq  = pitch ? `${pitch.toFixed(1)} Hz` : '—'

  // ── Accessible live announcement ─────────────────────────────────────────

  const liveMsg = tuneStatus === 'in-tune'
    ? `${displayNote} — In tune`
    : tuneStatus
    ? `${displayNote} — ${centsOff > 0 ? 'Sharp' : 'Flat'} ${Math.abs(centsOff)} cents`
    : ''

  return (
    <div className="container tuner-page">
      <h1 className="tuner-title">
        <span className="rainbow-text">Tuner</span>
      </h1>

      {/* Mode toggle */}
      <div className="tuner-mode-toggle" role="group" aria-label="Tuner mode">
        <button
          className={`tuner-mode-btn${mode === 'chromatic' ? ' tuner-mode-btn--active' : ''}`}
          onClick={() => setMode('chromatic')}
          aria-pressed={mode === 'chromatic'}
        >
          Chromatic
        </button>
        <button
          className={`tuner-mode-btn${mode === 'instrument' ? ' tuner-mode-btn--active' : ''}`}
          onClick={() => setMode('instrument')}
          aria-pressed={mode === 'instrument'}
        >
          Instrument
        </button>
      </div>

      {/* Instrument picker (instrument mode only) */}
      {mode === 'instrument' && (
        <div className="tuner-instrument-picker">
          <label htmlFor="tuner-instrument-select" className="tuner-label">Instrument</label>
          <select
            id="tuner-instrument-select"
            className="tuner-select"
            value={instrumentKey}
            onChange={e => { setInstrumentKey(e.target.value); setActiveString(null) }}
          >
            {INSTRUMENTS.map(inst => (
              <option key={inst.key} value={inst.key}>{inst.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* String selector (instrument mode only) */}
      {mode === 'instrument' && (
        <StringSelector
          instrument={instrument}
          activeString={activeString}
          onSelect={setActiveString}
        />
      )}

      {/* ── Mic gate: show prompt before browser dialog fires ── */}
      {micState === 'idle' && (
        <div className="tuner-mic-gate">
          <p className="tuner-mic-description">
            This tuner listens through your microphone to detect the pitch of your instrument.
            Your audio is processed entirely in your browser — nothing is recorded or sent anywhere.
          </p>
          <button className="btn btn-primary tuner-start-btn" onClick={startMic}>
            🎙 Start Tuner
          </button>
        </div>
      )}

      {micState === 'requesting' && (
        <p className="tuner-mic-status">Waiting for microphone permission…</p>
      )}

      {micState === 'denied' && (
        <div className="tuner-mic-gate tuner-mic-gate--error">
          <p>Microphone access was denied. To use the tuner, allow microphone access in your browser settings and reload the page.</p>
          <button className="btn btn-primary tuner-start-btn" onClick={() => setMicState('idle')}>
            Try again
          </button>
        </div>
      )}

      {/* ── Active tuner display ── */}
      {micState === 'active' && (
        <>
          {/* Meter */}
          <TunerMeter cents={centsOff} />

          {/* Note readout */}
          <div className="tuner-readout">
            <div className={`tuner-note${tuneStatus ? ` tuner-note--${tuneStatus}` : ''}`}>
              {displayNote}
            </div>
            <div className="tuner-cents">{displayCents} cents</div>
            <div className="tuner-freq">{displayFreq}</div>
            {mode === 'instrument' && targetStr && (
              <div className="tuner-target">
                Target: {targetStr.display} ({targetStr.freq.toFixed(2)} Hz)
              </div>
            )}
            {/* Status badge — fixed-height slot so layout never shifts */}
            <div className="tuner-status-slot">
              {tuneStatus && (
                <div className={`tuner-status tuner-status--${tuneStatus}`}>
                  {tuneStatus === 'in-tune' && <span className="tuner-status-icon">✓</span>}
                  {tuneStatus === 'sharp'   && <span className="tuner-status-icon">↑</span>}
                  {tuneStatus === 'flat'    && <span className="tuner-status-icon">↓</span>}
                  {tuneStatus === 'in-tune' ? 'In tune' : tuneStatus === 'sharp' ? 'Sharp' : 'Flat'}
                </div>
              )}
            </div>
          </div>

          {/* Accessible live region */}
          <div aria-live="polite" aria-atomic="true" className="tuner-sr-only">
            {liveMsg}
          </div>

          <button className="btn tuner-stop-btn" onClick={stopMic}>
            Stop
          </button>
        </>
      )}

      {/* Studio upsell — shown only to guests */}
      {!user && (
        <div className="cse-upsell">
          <div className="cse-upsell-text">
            <h2>Like this? There's a whole studio waiting.</h2>
            <p>
              Sign up for Rainbow Heart Studio and unlock a full suite of musician tools —
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
  )
}
