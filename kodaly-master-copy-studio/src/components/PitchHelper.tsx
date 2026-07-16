import React, { useEffect, useRef, useState } from 'react';
import { Mic, X, Undo2, Check, Play, Square, Volume2, VolumeX, Circle } from 'lucide-react';
import {
  detectPitch,
  isConfident,
  freqToSolfa,
  freqToNoteName,
  noteFreq,
  quartersToToken,
  MIN_RMS,
} from '../lib/pitchDetect';

interface PitchHelperProps {
  timeSignature: string;
  defaultBpm: number;
  /** Receives a ready-to-parse stick-notation block (rhythm + solfa lines). */
  onInsert: (block: string) => void;
  onClose: () => void;
}

type Phase = 'idle' | 'listening' | 'denied' | 'unsupported';
type RhythmMode = 'even' | 'tap';
type Resolution = 'quarter' | 'eighth' | 'sixteenth';

// Which note durations (in quarters) each "smallest rhythm" level allows the
// quantizer to snap to. Lower grades work in ta/ti-ti; higher grades add tika.
const RESOLUTIONS: Record<Resolution, number[]> = {
  quarter: [1, 2, 3, 4],
  eighth: [0.5, 1, 1.5, 2, 3, 4],
  sixteenth: [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4],
};

interface CapturedNote {
  solfa: string;
  t: number | null;    // AudioContext time at capture (tap mode); null otherwise
  rhythm?: string;     // explicit rhythm token from continuous recording
}

// How long (ms) a pitch must stay on the same solfa before we trust it.
const STABLE_MS = 180;
// Shortest note (seconds) a continuous recording will keep — drops blips.
const MIN_NOTE_SEC = 0.09;
// Shortest pause that becomes a rest — brief breath gaps are ignored.
const MIN_REST_SEC = 0.18;

// A recorded segment is either a sung note or a silent rest.
type RecSeg =
  | { kind: 'note'; solfa: string; start: number }
  | { kind: 'rest'; start: number };

const NOTE_LETTERS = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
const OCTAVES = [3, 4, 5];

type WebAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

export default function PitchHelper({ timeSignature, defaultBpm, onInsert, onClose }: PitchHelperProps) {
  const beatsPerBar = Math.max(1, parseInt((timeSignature || '4/4').split('/')[0]) || 4);

  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live readout
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const [liveSolfa, setLiveSolfa] = useState<string | null>(null);
  const [inTune, setInTune] = useState(false);
  const [level, setLevel] = useState(0); // live input RMS for the mic meter

  // Do (key) state
  const [doFreq, setDoFreq] = useState<number | null>(null);
  const [keyPc, setKeyPc] = useState(7);      // default G
  const [keyOctave, setKeyOctave] = useState(4);

  // Captured notes
  const [notes, setNotes] = useState<CapturedNote[]>([]);
  const [recording, setRecording] = useState(false);

  // Metronome / rhythm state
  const [bpm, setBpm] = useState(defaultBpm);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [clickOn, setClickOn] = useState(true);
  const [visualBeat, setVisualBeat] = useState(-1);
  const [rhythmMode, setRhythmMode] = useState<RhythmMode>('even');
  const [resolution, setResolution] = useState<Resolution>('sixteenth');

  // Audio graph + loop refs
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufRef = useRef<Float32Array | null>(null);
  const rafRef = useRef<number | null>(null);

  const liveFreqRef = useRef<number | null>(null);
  const doFreqRef = useRef<number | null>(null);
  const stableSolfaRef = useRef<string | null>(null);
  const stableSinceRef = useRef<number>(0);

  // Continuous-recording refs
  const recordingRef = useRef(false);
  const segRef = useRef<RecSeg | null>(null);

  // Metronome scheduler refs (read latest values without restarting the loop)
  const bpmRef = useRef(bpm);
  const clickOnRef = useRef(clickOn);
  const resolutionRef = useRef(resolution);
  const schedulerRef = useRef<number | null>(null);
  const nextBeatTimeRef = useRef(0);
  const beatCountRef = useRef(0);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { clickOnRef.current = clickOn; }, [clickOn]);
  useEffect(() => { resolutionRef.current = resolution; }, [resolution]);

  function teardown() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (schedulerRef.current != null) clearTimeout(schedulerRef.current);
    schedulerRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    analyserRef.current = null;
    bufRef.current = null;
  }

  useEffect(() => teardown, []);

  async function startListening() {
    setErrorMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('unsupported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const Ctor = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
      const ctx = new Ctor();
      await ctx.resume();
      ctxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(analyser.fftSize);

      setPhase('listening');
      applyKey(keyPc, keyOctave); // set do to the shown key so tone/record are ready
      tick();
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setPhase('denied');
      } else {
        setPhase('unsupported');
        setErrorMsg(err instanceof Error ? err.message : 'Could not access the microphone.');
      }
    }
  }

  function tick() {
    const analyser = analyserRef.current;
    const buf = bufRef.current;
    const ctx = ctxRef.current;
    if (!analyser || !buf || !ctx) return;

    analyser.getFloatTimeDomainData(buf);
    // Input level (RMS) for the meter — always updated so the user can see the
    // mic is being heard even when no clear pitch is detected.
    let sumSq = 0;
    for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
    setLevel(Math.sqrt(sumSq / buf.length));

    const reading = detectPitch(buf, ctx.sampleRate);

    if (isConfident(reading)) {
      liveFreqRef.current = reading.freq;
      setLiveNote(freqToNoteName(reading.freq));

      const ref = doFreqRef.current;
      if (ref) {
        const { solfa, cents } = freqToSolfa(reading.freq, ref);
        setLiveSolfa(solfa);
        setInTune(Math.abs(cents) <= 35);
        const now = ctx.currentTime * 1000;
        if (stableSolfaRef.current !== solfa) {
          stableSolfaRef.current = solfa;
          stableSinceRef.current = now;
        }
        if (recordingRef.current) recordFrame(solfa, ctx.currentTime);
      } else {
        setLiveSolfa(null);
      }
    } else {
      liveFreqRef.current = null;
      setLiveNote(null);
      setLiveSolfa(null);
      setInTune(false);
      stableSolfaRef.current = null;
      if (recordingRef.current) recordSilence(ctx.currentTime);
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  function isStable(): boolean {
    const ctx = ctxRef.current;
    if (!ctx || !stableSolfaRef.current) return false;
    return ctx.currentTime * 1000 - stableSinceRef.current >= STABLE_MS;
  }

  // --- Do / key ---
  function applyKey(pc: number, octave: number) {
    const f = noteFreq(pc, octave);
    doFreqRef.current = f;
    setDoFreq(f);
    stableSolfaRef.current = null;
  }
  function handleKeyChange(pc: number, octave: number) {
    setKeyPc(pc);
    setKeyOctave(octave);
    applyKey(pc, octave);
  }
  function handleSetDoFromVoice() {
    const f = liveFreqRef.current;
    if (!f) return;
    doFreqRef.current = f;
    setDoFreq(f);
    // Sync the key selectors to the nearest note so the label stays truthful.
    const midi = Math.round(69 + 12 * Math.log2(f / 440));
    setKeyPc(((midi % 12) + 12) % 12);
    const oct = Math.floor(midi / 12) - 1;
    setKeyOctave(OCTAVES.includes(oct) ? oct : 4);
    stableSolfaRef.current = null;
  }

  // Play the chosen do as a reference tone so the singer can tune to it.
  function playDoTone() {
    const ctx = ctxRef.current;
    const f = doFreqRef.current;
    if (!ctx || !f) return;
    const now = ctx.currentTime;
    const dur = 1.6;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
    gain.gain.setValueAtTime(0.22, now + dur - 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  // --- Continuous ("record a phrase") capture ---
  // A note is a run of frames on the same solfa, ended by a pitch change or a
  // pause. Its duration is quantized to the current BPM for a rough rhythm.
  function closeSegment(endSec: number) {
    const seg = segRef.current;
    segRef.current = null;
    if (!seg) return;
    const dur = endSec - seg.start;
    const min = seg.kind === 'rest' ? MIN_REST_SEC : MIN_NOTE_SEC;
    if (dur < min) return;
    const quarters = Math.min(4, Math.max(0.25, dur / (60 / bpmRef.current)));
    const tok = quartersToToken(quarters, RESOLUTIONS[resolutionRef.current]);
    if (seg.kind === 'note') {
      setNotes((prev) => [...prev, { solfa: seg.solfa, t: null, rhythm: tok }]);
    } else {
      // rest: 'z' placeholder in the solfa line keeps solfa/rhythm columns aligned
      setNotes((prev) => [...prev, { solfa: 'z', t: null, rhythm: 'z' + tok }]);
    }
  }
  function recordFrame(solfa: string, nowSec: number) {
    const seg = segRef.current;
    if (!seg || seg.kind === 'rest' || seg.solfa !== solfa) {
      closeSegment(nowSec);
      segRef.current = { kind: 'note', solfa, start: nowSec };
    }
    // same note held → let it ride
  }
  function recordSilence(nowSec: number) {
    const seg = segRef.current;
    if (seg && seg.kind === 'note') {
      closeSegment(nowSec);
      segRef.current = { kind: 'rest', start: nowSec };
    }
    // leading silence or an ongoing rest: nothing to do
  }
  function toggleRecording() {
    if (!ctxRef.current) return;
    if (recordingRef.current) {
      const seg = segRef.current;
      if (seg && seg.kind === 'note') closeSegment(ctxRef.current.currentTime);
      segRef.current = null; // drop any trailing rest
      recordingRef.current = false;
      setRecording(false);
    } else {
      segRef.current = null;
      recordingRef.current = true;
      setRecording(true);
    }
  }

  // --- Metronome ---
  function scheduleClick(time: number, isDownbeat: boolean) {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = isDownbeat ? 1000 : 760;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.3, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  function scheduler() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const beatPeriod = 60 / bpmRef.current;
    while (nextBeatTimeRef.current < ctx.currentTime + 0.12) {
      const beatInBar = beatCountRef.current % beatsPerBar;
      const isDownbeat = beatInBar === 0;
      if (clickOnRef.current) scheduleClick(nextBeatTimeRef.current, isDownbeat);
      // Flash the visual pulse close to when the click actually sounds.
      const dueMs = Math.max(0, (nextBeatTimeRef.current - ctx.currentTime) * 1000);
      window.setTimeout(() => setVisualBeat(beatInBar), dueMs);
      nextBeatTimeRef.current += beatPeriod;
      beatCountRef.current += 1;
    }
    schedulerRef.current = window.setTimeout(scheduler, 25);
  }

  function toggleMetronome() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (metronomeOn) {
      if (schedulerRef.current != null) clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
      setMetronomeOn(false);
      setVisualBeat(-1);
    } else {
      beatCountRef.current = 0;
      nextBeatTimeRef.current = ctx.currentTime + 0.1;
      setMetronomeOn(true);
      scheduler();
    }
  }

  // --- Notes ---
  function handleAddNote() {
    const solfa = liveSolfa;
    const ctx = ctxRef.current;
    if (!solfa || !isStable()) return;
    const t = rhythmMode === 'tap' && ctx ? ctx.currentTime : null;
    setNotes((prev) => [...prev, { solfa, t }]);
  }
  function handleUndo() {
    setNotes((prev) => prev.slice(0, -1));
  }

  function buildBlock(): string {
    const solfaLine = notes.map((n) => n.solfa).join(' ');
    const beatPeriodQuarter = 60 / bpm; // seconds per quarter note
    const rhythm = notes.map((n, i) => {
      if (n.rhythm) return n.rhythm; // captured by continuous recording
      if (rhythmMode === 'tap' && n.t != null && notes[i + 1]?.t != null) {
        const quarters = (notes[i + 1]!.t! - n.t) / beatPeriodQuarter;
        return quartersToToken(Math.min(4, Math.max(0.25, quarters)), RESOLUTIONS[resolution]);
      }
      return '4'; // even mode, or last tapped note
    });
    return `${rhythm.join(' ')}\n${solfaLine}`;
  }

  function handleInsert() {
    if (notes.length === 0) return;
    onInsert(buildBlock());
    teardown();
    onClose();
  }
  function handleClose() {
    teardown();
    onClose();
  }

  const canAdd = phase === 'listening' && doFreq != null && liveSolfa != null;
  const doLabel = doFreq != null ? freqToNoteName(doFreq) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="rainbow-stripe" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Mic size={18} className="text-blue-600" />
            <h2 className="font-bold text-slate-800">Sing to add solfa</h2>
          </div>
          <button onClick={handleClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-700 rounded-md" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {phase === 'idle' && (
            <div className="text-center py-4">
              <p className="text-slate-600 text-sm mb-3 leading-relaxed">
                Sing or hum one note at a time. Set your <b>do</b> (by key or by voice),
                then add notes one by one. Everything is detected on your device — no
                audio is uploaded.
              </p>
              <p className="text-slate-400 text-xs mb-5">Notes are added to your current song, not a new one.</p>
              <button onClick={startListening} className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-5 py-3 font-medium hover:bg-blue-700 transition-colors">
                <Mic size={18} /> Start listening
              </button>
            </div>
          )}

          {(phase === 'denied' || phase === 'unsupported') && (
            <div className="text-center py-4">
              <p className="text-slate-700 text-sm mb-2 font-medium">
                {phase === 'denied' ? 'Microphone access was blocked.' : 'Microphone input isn’t available in this browser.'}
              </p>
              <p className="text-slate-500 text-xs mb-5">
                {phase === 'denied'
                  ? 'Allow mic access in your browser’s site settings, or just type the notation by hand.'
                  : 'You can still type the notation by hand.'}
                {errorMsg ? ` (${errorMsg})` : ''}
              </p>
              <button onClick={handleClose} className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 rounded-lg px-5 py-2.5 font-medium hover:bg-slate-200 transition-colors">
                Close
              </button>
            </div>
          )}

          {phase === 'listening' && (
            <div>
              {/* Do / key control */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    do {doLabel ? `= ${doLabel}` : '(not set)'}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={playDoTone}
                      disabled={doFreq == null}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      🔊 hear do
                    </button>
                    <button
                      onClick={handleSetDoFromVoice}
                      disabled={liveFreqRef.current == null}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      🎤 use my voice
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <select
                    value={keyPc}
                    onChange={(e) => handleKeyChange(parseInt(e.target.value), keyOctave)}
                    className="flex-1 border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                  >
                    {NOTE_LETTERS.map((name, i) => (
                      <option key={i} value={i}>{name}</option>
                    ))}
                  </select>
                  <select
                    value={keyOctave}
                    onChange={(e) => handleKeyChange(keyPc, parseInt(e.target.value))}
                    className="w-20 border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                  >
                    {OCTAVES.map((o) => (
                      <option key={o} value={o}>oct {o}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Metronome */}
              <div className="mb-4 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Metronome</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setClickOn((v) => !v)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Toggle click sound">
                      {clickOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>
                    <button
                      onClick={toggleMetronome}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${metronomeOn ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {metronomeOn ? <Square size={14} /> : <Play size={14} />}
                      {metronomeOn ? 'Stop' : 'Start'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setBpm((b) => Math.max(40, b - 5))} className="w-8 h-8 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold">–</button>
                  <div className="text-center min-w-[64px]">
                    <span className="text-xl font-black text-slate-800">{bpm}</span>
                    <span className="text-[10px] text-slate-400 block leading-none">BPM</span>
                  </div>
                  <button onClick={() => setBpm((b) => Math.min(240, b + 5))} className="w-8 h-8 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold">+</button>
                  {/* Visual pulse — one dot per beat in the bar */}
                  <div className="flex gap-1.5 ml-auto">
                    {Array.from({ length: beatsPerBar }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-3 h-3 rounded-full transition-colors ${metronomeOn && visualBeat === i ? (i === 0 ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-slate-200'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Rhythm mode */}
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Rhythm</div>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
                  <button
                    onClick={() => setRhythmMode('even')}
                    className={`flex-1 px-3 py-2 font-medium transition-colors ${rhythmMode === 'even' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    Even ♩
                  </button>
                  <button
                    onClick={() => setRhythmMode('tap')}
                    className={`flex-1 px-3 py-2 font-medium transition-colors ${rhythmMode === 'tap' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    Tap in time
                  </button>
                </div>
                {rhythmMode === 'tap' && (
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                    Start the metronome and tap <b>Add note</b> on each note in time — the gap between taps becomes the rhythm.
                  </p>
                )}

                {/* Smallest rhythm — grade-level quantization limit */}
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Smallest rhythm</div>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as Resolution)}
                    className="w-full border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                  >
                    <option value="quarter">Quarter — ta (beat only)</option>
                    <option value="eighth">Eighth — ta, ti-ti</option>
                    <option value="sixteenth">Sixteenth — ta, ti-ti, tika-tika</option>
                  </select>
                </div>
              </div>

              {/* Live readout */}
              <div className="flex flex-col items-center justify-center h-24 rounded-xl bg-slate-50 border border-slate-200 mb-2">
                {doFreq == null ? (
                  liveNote ? (
                    <><span className="text-2xl font-black text-slate-800">{liveNote}</span>
                    <span className="text-xs text-slate-400 mt-1">set your do above</span></>
                  ) : (
                    <span className="text-sm text-slate-400 px-4 text-center">
                      {level < MIN_RMS ? 'No sound yet — is the mic allowed & unmuted?' : 'Hearing you — sing a clear, steady note'}
                    </span>
                  )
                ) : liveSolfa ? (
                  <><span className={`text-5xl font-black ${inTune ? 'text-emerald-600' : 'text-slate-800'}`}>{liveSolfa}</span>
                  <span className="text-xs text-slate-400 mt-1">{inTune ? 'in tune — tap Add note' : 'hold steady…'}</span></>
                ) : (
                  <span className="text-sm text-slate-400 px-4 text-center">
                    {level < MIN_RMS ? 'No sound yet — is the mic allowed & unmuted?' : 'Hearing you — sing a clear, steady note'}
                  </span>
                )}
              </div>

              {/* Input level meter — confirms the mic is actually being heard */}
              <div className="flex items-center gap-2 mb-4" title="Microphone input level">
                <Mic size={12} className="text-slate-400 flex-shrink-0" />
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${level < MIN_RMS ? 'bg-slate-300' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, level * 1200)}%` }}
                  />
                </div>
              </div>

              {/* Add / undo — one note at a time */}
              <div className="flex gap-2">
                <button onClick={handleAddNote} disabled={!canAdd || recording} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-3 font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <Check size={18} /> Add note
                </button>
                <button onClick={handleUndo} disabled={notes.length === 0 || recording} className="flex items-center justify-center gap-2 bg-slate-100 text-slate-700 rounded-lg px-4 py-3 font-medium hover:bg-slate-200 transition-colors disabled:opacity-40" aria-label="Undo last note">
                  <Undo2 size={18} />
                </button>
              </div>

              {/* Record a phrase — continuous capture */}
              <button
                onClick={toggleRecording}
                disabled={doFreq == null}
                className={`w-full mt-2 flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${recording ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {recording ? (<><Square size={18} /> Stop recording</>) : (<><Circle size={14} fill="currentColor" className="text-red-500" /> Record a phrase</>)}
              </button>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-snug text-center">
                {recording
                  ? 'Listening… sing your phrase in time with the metronome.'
                  : 'Or sing a whole phrase — notes are captured automatically, rhythm estimated from your tempo (a rough draft to edit).'}
              </p>

              {notes.length > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Captured ({notes.length})</div>
                  <div className="flex flex-wrap gap-1.5 mb-4 max-h-20 overflow-y-auto">
                    {notes.map((n, i) => (
                      <span
                        key={i}
                        className={`font-mono text-sm font-bold rounded px-2 py-1 ${n.solfa === 'z' ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-700'}`}
                      >
                        {n.solfa === 'z' ? 'rest' : n.solfa}
                      </span>
                    ))}
                  </div>
                  <button onClick={handleInsert} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-lg px-4 py-3 font-medium hover:bg-emerald-700 transition-colors">
                    <Check size={18} /> Add {notes.length} note{notes.length === 1 ? '' : 's'} to song
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
