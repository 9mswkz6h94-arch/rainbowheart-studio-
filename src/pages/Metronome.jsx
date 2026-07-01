import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const STUDIO_TOOLS = [
  { emoji: '🎸', label: 'Chord Chart Builder',   desc: 'Print-ready charts for gig night.' },
  { emoji: '🎵', label: 'Chord & Scale Explorer', desc: 'Every chord and scale on your instrument.' },
  { emoji: '🎼', label: 'Tab Builder',           desc: 'Fret grids with playback & export.' },
  { emoji: '🎤', label: 'Shows',                 desc: 'Shareable set lists for the whole band.' },
  { emoji: '🥁', label: 'Groove Builder',        desc: 'Drum patterns in any time signature.' },
  { emoji: '🎙', label: 'Tuner',                 desc: 'Chromatic & instrument tuner, no login needed.' },
  { emoji: '📚', label: 'Heart Beats Practice',  desc: 'Daily practice tracking for students.' },
]

const MIN_BPM = 30
const MAX_BPM = 260
const BEATS_OPTIONS = [2, 3, 4, 5, 6, 7]
const PREFS_KEY = 'metronome-prefs'
const TAP_WINDOW_MS = 2000

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}
function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch {}
}

function synthClick(ctx, time, accent) {
  const osc = ctx.createOscillator()
  const g   = ctx.createGain()
  osc.connect(g); g.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(accent ? 1500 : 1000, time)
  g.gain.setValueAtTime(accent ? 0.9 : 0.55, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.05)
  osc.start(time)
  osc.stop(time + 0.06)
}

export default function Metronome() {
  const { user } = useAuth()
  const prefs = loadPrefs()

  const [bpm, setBpm] = useState(prefs.bpm ?? 100)
  const [beatsPerBar, setBeatsPerBar] = useState(prefs.beatsPerBar ?? 4)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentBeat, setCurrentBeat] = useState(-1)

  const audioCtxRef      = useRef(null)
  const schedulerRef     = useRef(null)
  const rafRef           = useRef(null)
  const nextNoteTimeRef  = useRef(0)
  const currentBeatRef   = useRef(0)
  const beatsQueueRef    = useRef([])
  const bpmRef           = useRef(bpm)
  const beatsPerBarRef   = useRef(beatsPerBar)
  const playingRef       = useRef(false)
  const tapTimesRef      = useRef([])

  useEffect(() => { bpmRef.current = bpm }, [bpm])
  useEffect(() => { beatsPerBarRef.current = beatsPerBar }, [beatsPerBar])
  useEffect(() => { savePrefs({ bpm, beatsPerBar }) }, [bpm, beatsPerBar])

  function runScheduler() {
    const ctx = audioCtxRef.current
    while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
      const beat = currentBeatRef.current
      synthClick(ctx, nextNoteTimeRef.current, beat === 0)
      beatsQueueRef.current.push({ time: nextNoteTimeRef.current, beat })
      nextNoteTimeRef.current += 60 / bpmRef.current
      currentBeatRef.current = (beat + 1) % beatsPerBarRef.current
    }
  }

  function animateBeat() {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const now = ctx.currentTime
    while (beatsQueueRef.current.length && beatsQueueRef.current[0].time <= now) {
      setCurrentBeat(beatsQueueRef.current[0].beat)
      beatsQueueRef.current.shift()
    }
    if (playingRef.current) rafRef.current = requestAnimationFrame(animateBeat)
  }

  function start() {
    if (playingRef.current) return
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    playingRef.current      = true
    currentBeatRef.current  = 0
    beatsQueueRef.current   = []
    nextNoteTimeRef.current = audioCtxRef.current.currentTime + 0.05
    schedulerRef.current = setInterval(runScheduler, 25)
    rafRef.current = requestAnimationFrame(animateBeat)
    setIsPlaying(true)
  }

  function stop() {
    playingRef.current = false
    clearInterval(schedulerRef.current)
    cancelAnimationFrame(rafRef.current)
    beatsQueueRef.current = []
    setIsPlaying(false)
    setCurrentBeat(-1)
  }

  function toggle() { isPlaying ? stop() : start() }

  // Changing the time signature mid-beat would desync the accent — stop instead.
  useEffect(() => { if (playingRef.current) stop() }, [beatsPerBar])

  // Cleanup on unmount
  useEffect(() => () => {
    playingRef.current = false
    clearInterval(schedulerRef.current)
    cancelAnimationFrame(rafRef.current)
    audioCtxRef.current?.close()
  }, [])

  function nudgeBpm(delta) {
    setBpm(b => Math.max(MIN_BPM, Math.min(MAX_BPM, b + delta)))
  }

  function handleTap() {
    const now = performance.now()
    const taps = tapTimesRef.current.filter(t => now - t < TAP_WINDOW_MS)
    taps.push(now)
    tapTimesRef.current = taps
    if (taps.length >= 2) {
      const intervals = taps.slice(1).map((t, i) => t - taps[i])
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      setBpm(Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(60000 / avg))))
    }
  }

  return (
    <div className="container metronome-page">
      <h1 className="metronome-title">
        <span className="rainbow-text">Metronome</span>
      </h1>

      <div className="metronome-beats" role="img" aria-label={`Beat ${Math.max(currentBeat, 0) + 1} of ${beatsPerBar}`}>
        {Array.from({ length: beatsPerBar }).map((_, i) => (
          <span
            key={i}
            className={
              'metronome-dot' +
              (i === 0 ? ' metronome-dot--accent' : '') +
              (i === currentBeat ? ' metronome-dot--active' : '')
            }
          />
        ))}
      </div>

      <div className="metronome-bpm-row">
        <button className="metronome-bpm-btn" onClick={() => nudgeBpm(-1)} aria-label="Decrease tempo">−</button>
        <div className="metronome-bpm-display">
          <input
            type="number"
            className="metronome-bpm-input"
            value={bpm}
            min={MIN_BPM}
            max={MAX_BPM}
            onChange={e => {
              const v = parseInt(e.target.value, 10)
              if (!Number.isNaN(v)) setBpm(Math.max(MIN_BPM, Math.min(MAX_BPM, v)))
            }}
          />
          <span className="metronome-bpm-label">BPM</span>
        </div>
        <button className="metronome-bpm-btn" onClick={() => nudgeBpm(1)} aria-label="Increase tempo">+</button>
      </div>

      <input
        type="range"
        className="metronome-slider"
        min={MIN_BPM}
        max={MAX_BPM}
        value={bpm}
        onChange={e => setBpm(parseInt(e.target.value, 10))}
        aria-label="Tempo slider"
      />

      <div className="tuner-instrument-picker">
        <label htmlFor="metronome-beats-select" className="tuner-label">Beats per bar</label>
        <select
          id="metronome-beats-select"
          className="tuner-select"
          value={beatsPerBar}
          onChange={e => setBeatsPerBar(parseInt(e.target.value, 10))}
        >
          {BEATS_OPTIONS.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div className="metronome-transport">
        <button className="btn btn-primary metronome-play-btn" onClick={toggle}>
          {isPlaying ? '■ Stop' : '▶ Start'}
        </button>
        <button className="btn tuner-stop-btn metronome-tap-btn" onClick={handleTap}>
          Tap Tempo
        </button>
      </div>

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
  )
}
