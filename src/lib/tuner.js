import { PitchDetector } from 'pitchy'

// ─── Tuning presets ────────────────────────────────────────────────────────────

export const INSTRUMENTS = [
  {
    key: 'guitar-standard',
    label: 'Guitar — Standard',
    strings: [
      { name: 'E2', freq: 82.41,  display: '6 — E' },
      { name: 'A2', freq: 110.00, display: '5 — A' },
      { name: 'D3', freq: 146.83, display: '4 — D' },
      { name: 'G3', freq: 196.00, display: '3 — G' },
      { name: 'B3', freq: 246.94, display: '2 — B' },
      { name: 'E4', freq: 329.63, display: '1 — e' },
    ],
  },
  {
    key: 'guitar-drop-d',
    label: 'Guitar — Drop D',
    strings: [
      { name: 'D2', freq: 73.42,  display: '6 — D' },
      { name: 'A2', freq: 110.00, display: '5 — A' },
      { name: 'D3', freq: 146.83, display: '4 — D' },
      { name: 'G3', freq: 196.00, display: '3 — G' },
      { name: 'B3', freq: 246.94, display: '2 — B' },
      { name: 'E4', freq: 329.63, display: '1 — e' },
    ],
  },
  {
    key: 'bass',
    label: 'Bass — Standard',
    strings: [
      { name: 'E1', freq: 41.20,  display: '4 — E' },
      { name: 'A1', freq: 55.00,  display: '3 — A' },
      { name: 'D2', freq: 73.42,  display: '2 — D' },
      { name: 'G2', freq: 98.00,  display: '1 — G' },
    ],
  },
  {
    key: 'ukulele',
    label: 'Ukulele — GCEA',
    strings: [
      { name: 'G4', freq: 392.00, display: '4 — G' },
      { name: 'C4', freq: 261.63, display: '3 — C' },
      { name: 'E4', freq: 329.63, display: '2 — E' },
      { name: 'A4', freq: 440.00, display: '1 — A' },
    ],
  },
]

// ─── Note math (equal temperament, A4 = 440 Hz) ───────────────────────────────

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

export function freqToNote(freq) {
  if (!freq || freq < 16 || freq > 8000) return null
  const semitones = 12 * Math.log2(freq / 440) + 57  // semitones from C0
  const midi = Math.round(semitones)
  if (midi < 0 || midi > 127) return null
  const cents = Math.round((semitones - midi) * 100)
  const octave = Math.floor(midi / 12)
  const name = NOTE_NAMES[((midi % 12) + 12) % 12]  // always positive modulo
  const targetFreq = 440 * Math.pow(2, (midi - 57) / 12)
  return { name, octave, cents, targetFreq, midi }
}

export function closestString(freq, instrument) {
  if (!freq || !instrument) return null
  let best = null
  let bestCents = Infinity
  for (const str of instrument.strings) {
    const semis = 12 * Math.log2(freq / str.freq)
    const cents = semis * 100
    if (Math.abs(cents) < Math.abs(bestCents)) {
      bestCents = cents
      best = { ...str, cents: Math.round(cents) }
    }
  }
  return best
}

// ─── Audio engine ─────────────────────────────────────────────────────────────

export class TunerAudio {
  constructor(onResult) {
    this.onResult = onResult
    this.audioCtx = null
    this.analyser = null
    this.stream = null
    this.detector = null
    this.buffer = null
    this.rafId = null
    this.running = false
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    this.audioCtx = new AudioContext()
    await this.audioCtx.resume()

    this.analyser = this.audioCtx.createAnalyser()
    this.analyser.fftSize = 4096
    this.analyser.smoothingTimeConstant = 0

    const source = this.audioCtx.createMediaStreamSource(this.stream)
    source.connect(this.analyser)

    this.detector = PitchDetector.forFloat32Array(this.analyser.fftSize)
    this.buffer = new Float32Array(this.detector.inputLength)
    this.running = true
    this._loop()
  }

  _loop() {
    if (!this.running) return
    this.analyser.getFloatTimeDomainData(this.buffer)
    const [pitch, clarity] = this.detector.findPitch(this.buffer, this.audioCtx.sampleRate)
    this.onResult({ pitch: clarity > 0.92 ? pitch : null, clarity })
    this.rafId = requestAnimationFrame(() => this._loop())
  }

  stop() {
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    if (this.stream) this.stream.getTracks().forEach(t => t.stop())
    if (this.audioCtx) this.audioCtx.close()
    this.audioCtx = null
    this.stream = null
  }
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

export function loadTunerPrefs() {
  try {
    const raw = localStorage.getItem('tuner-prefs')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveTunerPrefs(prefs) {
  try { localStorage.setItem('tuner-prefs', JSON.stringify(prefs)) } catch {}
}
