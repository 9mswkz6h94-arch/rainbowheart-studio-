// On-device monophonic pitch detection for the sing-to-solfa helper.
//
// Everything here runs in the browser on the raw mic samples — no audio ever
// leaves the device, which keeps the feature local-first and private. The
// detector is a normalized autocorrelation (ACF) with parabolic interpolation,
// which is reliable for *sustained, single-voice* input (humming/singing a
// held vowel) — exactly the usage this helper asks for.

export interface PitchReading {
  freq: number;     // Hz
  clarity: number;  // 0..1 normalized ACF peak — how periodic/confident
}

// Acceptance gates. Tuned to reject silence, breath, and noisy/unstable input
// so the helper only ever acts on a clearly-sung tone.
export const MIN_RMS = 0.005;       // below this = effectively silence (laptop mics are quiet)
export const MIN_CLARITY = 0.82;    // below this = not a clean pitched tone (laptop mics are noisier)
export const MIN_FREQ = 65;         // ~C2, below a normal singing range
export const MAX_FREQ = 1200;       // ~D6, above a normal singing range

/**
 * Estimate the fundamental frequency of a time-domain buffer.
 * Returns null when the buffer is too quiet or not convincingly pitched.
 */
export function detectPitch(buf: Float32Array, sampleRate: number): PitchReading | null {
  const SIZE = buf.length;

  // 1. RMS gate — ignore silence/breath before doing expensive work.
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < MIN_RMS) return null;

  // 2. Trim near-silent edges so the ACF locks onto the steady part of the tone.
  const thres = 0.2;
  let r1 = 0;
  let r2 = SIZE - 1;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  }
  const b = buf.slice(r1, r2);
  const n = b.length;
  if (n < 128) return null;

  // 3. Autocorrelation.
  const c = new Float32Array(n);
  for (let lag = 0; lag < n; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) sum += b[i] * b[i + lag];
    c[lag] = sum;
  }
  if (c[0] === 0) return null;

  // 4. Walk past the initial downslope, then find the highest secondary peak.
  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < n; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  if (maxpos <= 0) return null;

  // 5. Parabolic interpolation around the peak for sub-sample accuracy.
  let T0 = maxpos;
  const x1 = c[T0 - 1] ?? 0;
  const x2 = c[T0];
  const x3 = c[T0 + 1] ?? 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const bb = (x3 - x1) / 2;
  if (a !== 0) T0 = T0 - bb / (2 * a);

  const freq = sampleRate / T0;
  if (freq < MIN_FREQ || freq > MAX_FREQ) return null;

  // Clarity as a length-normalized correlation coefficient over the
  // overlapping window at the detected lag. Unlike maxval/c[0], this is
  // ~1.0 for a clean tone at ANY frequency — so low voices aren't unfairly
  // rejected by the confidence gate.
  const lag = maxpos;
  let e1 = 0;
  let e2 = 0;
  let cross = 0;
  for (let i = 0; i + lag < n; i++) {
    e1 += b[i] * b[i];
    e2 += b[i + lag] * b[i + lag];
    cross += b[i] * b[i + lag];
  }
  const denom = Math.sqrt(e1 * e2);
  const clarity = denom > 0 ? cross / denom : 0;
  return { freq, clarity };
}

/** True when a reading is confident enough to show/act on. */
export function isConfident(r: PitchReading | null): r is PitchReading {
  return !!r && r.clarity >= MIN_CLARITY;
}

// --- Frequency → Kodály solfa (movable do) -------------------------------

// The stick-notation parser only understands the seven diatonic letters
// (d r m f s l t) with one level of octave mark (',). So we snap every sung
// pitch to the nearest MAJOR-scale degree relative to the chosen do — which is
// both what the format supports and the most reliable interpretation.
const SCALE: { letter: string; semi: number }[] = [
  { letter: 'd', semi: 0 },
  { letter: 'r', semi: 2 },
  { letter: 'm', semi: 4 },
  { letter: 'f', semi: 5 },
  { letter: 's', semi: 7 },
  { letter: 'l', semi: 9 },
  { letter: 't', semi: 11 },
];

export interface SolfaReading {
  solfa: string;  // e.g. "d", "s,", "m'"
  cents: number;  // signed distance from the snapped degree (tuning hint)
}

/**
 * Convert a detected frequency to a solfa token relative to `doFreq`.
 * Octaves beyond ±1 are clamped to a single mark (the format's limit).
 */
export function freqToSolfa(freq: number, doFreq: number): SolfaReading {
  const semisFromDo = 12 * Math.log2(freq / doFreq);

  let best = SCALE[0];
  let bestK = 0;
  let bestDist = Infinity;
  for (let k = -3; k <= 3; k++) {
    for (const deg of SCALE) {
      const target = deg.semi + 12 * k;
      const dist = Math.abs(semisFromDo - target);
      if (dist < bestDist) {
        bestDist = dist;
        best = deg;
        bestK = k;
      }
    }
  }

  let mark = '';
  if (bestK >= 1) mark = "'";
  else if (bestK <= -1) mark = ',';

  const snappedSemi = best.semi + 12 * bestK;
  const cents = Math.round((semisFromDo - snappedSemi) * 100);
  return { solfa: best.letter + mark, cents };
}

// --- Frequency → absolute note name (display only, before do is set) -----

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Nearest equal-tempered note name (A4 = 440 Hz). For reassuring feedback. */
export function freqToNoteName(freq: number): string {
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

// --- Key / rhythm helpers (used by the sing-to-solfa helper) --------------

/** Equal-tempered frequency for a pitch class (0=C..11=B) at an octave. */
export function noteFreq(pcIndex: number, octave: number): number {
  const midi = (octave + 1) * 12 + pcIndex;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Quarter-note durations tapped rhythm is quantized to, with stick tokens.
export const RHYTHM_DURATIONS: { q: number; tok: string }[] = [
  { q: 0.25, tok: '16' },
  { q: 0.5, tok: '8' },
  { q: 0.75, tok: '8.' },
  { q: 1, tok: '4' },
  { q: 1.5, tok: '4.' },
  { q: 2, tok: '2' },
  { q: 3, tok: '2.' },
  { q: 4, tok: '1' },
];

/**
 * Snap a duration (in quarter notes) to the nearest stick rhythm token.
 * Pass `allowed` (a list of permitted quarter-values) to limit the smallest
 * rhythm — e.g. [0.5,1,2,4] keeps quantization to eighths and larger (ta/ti-ti)
 * for lower grade levels.
 */
export function quartersToToken(q: number, allowed?: number[]): string {
  const pool =
    allowed && allowed.length
      ? RHYTHM_DURATIONS.filter((d) => allowed.includes(d.q))
      : RHYTHM_DURATIONS;
  const list = pool.length ? pool : RHYTHM_DURATIONS;
  let best = list[0];
  let bestDist = Infinity;
  for (const d of list) {
    const dist = Math.abs(q - d.q);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best.tok;
}
