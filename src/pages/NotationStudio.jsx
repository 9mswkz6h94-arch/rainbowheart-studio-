import { useEffect, useMemo, useRef, useState } from 'react'
import AlphaTabScore from '../components/AlphaTabScore'

const STORE_KEY = 'rh_notation_studio_v1'
const DURATIONS = [
  ['1', 'Whole'], ['2', 'Half'], ['4', 'Quarter'], ['8', 'Eighth'], ['16', '16th'], ['32', '32nd'],
]
const DYNAMICS = ['', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz']
const CLEFS = [['treble', 'Treble'], ['bass', 'Bass'], ['alto', 'Alto'], ['tenor', 'Tenor']]
const DIATONIC = ['C','D','E','F','G','A','B']
const CHROMATIC_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const CHROMATIC_FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
const INSTRUMENTS = [
  { id:'concert', name:'Concert melody', short:'Mel.', clef:'treble', transpose:0 },
  { id:'flute', name:'Flute', short:'Fl.', clef:'treble', transpose:0 },
  { id:'oboe', name:'Oboe', short:'Ob.', clef:'treble', transpose:0 },
  { id:'violin', name:'Violin', short:'Vln.', clef:'treble', transpose:0 },
  { id:'trumpet-bb', name:'Trumpet in Bb', short:'Tpt.', clef:'treble', transpose:2 },
  { id:'clarinet-bb', name:'Clarinet in Bb', short:'Cl.', clef:'treble', transpose:2 },
  { id:'alto-sax-eb', name:'Alto Sax in Eb', short:'A. Sax', clef:'treble', transpose:9 },
  { id:'tenor-sax-bb', name:'Tenor Sax in Bb', short:'T. Sax', clef:'treble', transpose:14 },
  { id:'horn-f', name:'Horn in F', short:'Hn.', clef:'treble', transpose:7 },
  { id:'trombone', name:'Trombone', short:'Tbn.', clef:'bass', transpose:0 },
  { id:'euphonium', name:'Euphonium (bass clef)', short:'Euph.', clef:'bass', transpose:0 },
  { id:'tuba', name:'Tuba', short:'Tba.', clef:'bass', transpose:0 },
]

const uid = () => (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`)
const freshEvent = (start = 0) => ({ id: uid(), start, pitch: 'C4', duration: '4', dotted: false, tuplet: 0, rest: false, chord: '', lyric: '', dynamic: '', articulation: '', tie: false, slur: '' })
const freshMeasure = () => ({ id: uid(), events: [freshEvent(0), { ...freshEvent(4), pitch: 'D4' }, { ...freshEvent(8), pitch: 'E4' }, { ...freshEvent(12), pitch: 'G4' }] })
const freshPart = (name = 'Melody') => ({ id: uid(), name, shortName: name.slice(0, 4), instrumentId: 'concert', transposition: 0, clef: 'treble', measures: [freshMeasure(), freshMeasure()] })
const freshDoc = () => ({ format: 'rainbowhearts.notation', version: 2, id: null, title: 'New Melody', composer: '', key: 'C', timeSignature: '4/4', tempo: 100, parts: [freshPart()] })

function esc(value) { return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') }

function transposePitch(pitch, semitones = 0, preferFlats = false) {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(pitch || '')
  if (!match || !semitones) return pitch
  const source = match[1] + match[2]
  let pc = CHROMATIC_SHARP.indexOf(source); if (pc < 0) pc = CHROMATIC_FLAT.indexOf(source)
  const midi = (Number(match[3]) + 1) * 12 + pc + semitones
  const names = preferFlats ? CHROMATIC_FLAT : CHROMATIC_SHARP
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}
function pitchFrequency(pitch) {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(pitch || '')
  if (!match) return 261.63
  let pc = CHROMATIC_SHARP.indexOf(match[1] + match[2]); if (pc < 0) pc = CHROMATIC_FLAT.indexOf(match[1] + match[2])
  const midi = (Number(match[3]) + 1) * 12 + pc
  return 440 * Math.pow(2, (midi - 69) / 12)
}
function transposeKey(key, semitones = 0) {
  let pc = CHROMATIC_SHARP.indexOf(key); if (pc < 0) pc = CHROMATIC_FLAT.indexOf(key)
  if (pc < 0) return key
  const preferFlats = String(key).includes('b') || ['F','Bb','Eb','Ab','Db','Gb'].includes(key)
  return (preferFlats ? CHROMATIC_FLAT : CHROMATIC_SHARP)[(pc + semitones + 120) % 12]
}
function transposeChord(chord, semitones = 0, preferFlats = false) {
  if (!chord || !semitones) return chord
  return chord.replace(/(^|\/)([A-G])([#b]?)/g, (match, prefix, letter, accidental) => {
    let pc = CHROMATIC_SHARP.indexOf(letter + accidental); if (pc < 0) pc = CHROMATIC_FLAT.indexOf(letter + accidental)
    const names = preferFlats ? CHROMATIC_FLAT : CHROMATIC_SHARP
    return prefix + names[(pc + semitones + 120) % 12]
  })
}

function eventTex(eventOrGroup, transposition = 0, preferFlats = false) {
  const group = Array.isArray(eventOrGroup) ? eventOrGroup : [eventOrGroup]
  const event = group[0]
  const pitches = group.filter(item => !item.rest).map(item => transposePitch(item.pitch || 'C4', transposition, preferFlats))
  const note = event.rest ? 'r' : pitches.length > 1 ? `(${pitches.join(' ')})` : pitches[0]
  const props = []
  if (event.dotted) props.push('d')
  if (event.tuplet) props.push(`tu ${event.tuplet}`)
  if (event.chord) props.push(`ch "${esc(transposeChord(event.chord, transposition, preferFlats))}"`)
  if (event.lyric) props.push(`lyrics "${esc(event.lyric)}"`)
  if (event.dynamic) props.push(`dy ${event.dynamic}`)
  if (event.articulation) props.push(event.articulation)
  if (event.tie && !event.rest) props.push('t')
  if (event.slur) props.push(`slur ${event.slur}`)
  return `${note}.${event.duration || '4'}${props.length ? `{${props.join(' ')}}` : ''}`
}

const durationUnits = event => Math.max(.25, (16 / Number(event.duration || 4)) * (event.dotted ? 1.5 : 1) * (event.tuplet ? 2 / Number(event.tuplet) : 1))
const measureUnits = signature => { const [n, d] = signature.split('/').map(Number); return n * 16 / d }
const rhythmicGrid = event => durationUnits({ duration:event.duration, dotted:false, tuplet:event.tuplet })
function snapRhythmicStart(start, event, capacity) {
  const grid = rhythmicGrid(event), latest = Math.max(0, capacity - durationUnits(event))
  const snapped = Math.round(Number(start || 0) / grid) * grid
  return Math.round(Math.max(0, Math.min(latest, snapped)) * 1000000) / 1000000
}
const eventsOverlap = (a, b) => a.start < b.start + durationUnits(b) - .00001 && b.start < a.start + durationUnits(a) - .00001
function restTex(units) {
  const values = [[16,'1'],[12,'2{d}'],[8,'2'],[6,'4{d}'],[4,'4'],[3,'8{d}'],[2,'8'],[1,'16']]
  const out = []; let left = units
  for (const [size, token] of values) while (left >= size) { out.push(`r.${token}`); left -= size }
  return out.join(' ')
}

function normalizeDoc(raw) {
  const next = structuredClone(raw)
  next.version = 2
  for (const part of next.parts || []) {
    if (!part.instrumentId) part.instrumentId = 'concert'
    if (!Number.isFinite(part.transposition)) part.transposition = 0
    for (const measure of part.measures || []) {
      let cursor = 0
      for (const event of measure.events || []) { if (!Number.isFinite(event.start)) event.start = cursor; cursor = event.start + durationUnits(event) }
      measure.events.sort((a,b) => a.start - b.start)
    }
  }
  return next
}

function buildTex(doc) {
  const [num, den] = (doc.timeSignature || '4/4').split('/')
  const head = `\\title "${esc(doc.title)}"\n\\artist "${esc(doc.composer)}"\n\\tempo ${doc.tempo || 100}\n.`
  const tracks = doc.parts.map((part, partIndex) => {
    const bars = part.measures.map((measure, i) => {
      const writtenKey = transposeKey(doc.key || 'C', Number(part.transposition || 0))
      const meta = i === 0 ? `\\ts ${num || 4} ${den || 4} \\ks ${writtenKey} \\clef ${part.clef || 'treble'} ` : ''
      let cursor = 0, body = ''
      const sorted = [...measure.events].sort((a,b) => a.start - b.start)
      for (let eventIndex = 0; eventIndex < sorted.length;) {
        const event = sorted[eventIndex], group = sorted.filter(item => Math.abs(item.start - event.start) < .00001)
        if (event.start > cursor) body += restTex(event.start - cursor) + ' '
        body += eventTex(group, Number(part.transposition || 0), writtenKey.includes('b')) + ' '
        cursor = Math.max(cursor, ...group.map(item => item.start + durationUnits(item)))
        eventIndex += group.length
      }
      const capacity = measureUnits(doc.timeSignature || '4/4')
      if (cursor < capacity) body += restTex(capacity - cursor)
      return meta + (body.trim() || 'r.1')
    }).join(' |\n')
    return `\\track "${esc(part.name || `Part ${partIndex + 1}`)}" "${esc(part.shortName || `P${partIndex + 1}`)}"\n\\staff {score}\n${bars} |`
  }).join('\n')
  return `${head}\n${tracks}`
}

function loadLibrary() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]') }
  catch { return [] }
}

function pitchStep(pitch) {
  const match = /^([A-G])(?:#|b)?(\d)$/.exec(pitch || '')
  return match ? (Number(match[2]) - 4) * 7 + DIATONIC.indexOf(match[1]) : 0
}

function stepPitch(step) {
  const safe = Math.max(-7, Math.min(20, step))
  const octave = 4 + Math.floor(safe / 7)
  return `${DIATONIC[((safe % 7) + 7) % 7]}${octave}`
}

function keySignatureMarks(key) {
  const sharpCounts = { G:1, D:2, A:3, E:4, B:5, 'F#':6, 'C#':7 }
  const flatCounts = { F:1, Bb:2, Eb:3, Ab:4, Db:5, Gb:6, Cb:7 }
  if (sharpCounts[key]) return Array.from({length:sharpCounts[key]}, (_, i) => ({ symbol:'♯', y:[49,70,42,63,84,56,77][i] }))
  if (flatCounts[key]) return Array.from({length:flatCounts[key]}, (_, i) => ({ symbol:'♭', y:[77,56,84,63,91,70,98][i] }))
  return []
}

function StaffMeasure({ measure, measureNumber, showClef, keySignature, selectedId, entry, entryMode, caretStart, caretPitch, capacity, beatUnits, onSelect, onPlace, onCaret, onMove }) {
  const svgRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const W = 430, top = 45, bottomLine = 105, stepH = 7.5
  const keyMarks = showClef ? keySignatureMarks(keySignature) : []
  const noteLeft = showClef ? 86 + keyMarks.length * 11 : 16
  const noteSpan = W - noteLeft - 12
  const noteY = pitch => bottomLine + 2 * stepH - pitchStep(pitch) * stepH
  const ledgerYs = y => {
    const lines = []
    if (y <= top - stepH) for (let line = top - 15; line >= y - 1; line -= 15) lines.push(line)
    if (y >= bottomLine + stepH) for (let line = bottomLine + 15; line <= y + 1; line += 15) lines.push(line)
    return lines
  }
  const pointFromEvent = (event, rhythm = entry) => {
    const box = svgRef.current.getBoundingClientRect()
    const y = (event.clientY - box.top) * (150 / box.height)
    const x = (event.clientX - box.left) * (W / box.width)
    const rawStart = ((x - noteLeft) / noteSpan) * capacity
    const start = snapRhythmicStart(rawStart, rhythm, capacity)
    return { pitch: stepPitch(Math.round((bottomLine + 2 * stepH - y) / stepH)), start }
  }
  const onStaffClick = event => {
    const point = pointFromEvent(event); onCaret(point)
    if (entryMode) onPlace(point.pitch, point.start)
  }
  return (
    <svg ref={svgRef} className={`ns-staff${showClef ? '' : ' no-clef'}`} viewBox={`0 0 ${W} 150`} onClick={onStaffClick} role="button" aria-label={`Measure ${measureNumber}. Click the staff to add a note`}>
      <rect width={W} height="150" fill="white" />
      <text x="8" y="19" className="ns-measure-number">{measureNumber}</text>
      {Array.from({length:Math.ceil(capacity / rhythmicGrid(entry))}, (_, i) => i * rhythmicGrid(entry)).filter(value => value < capacity).map(value => <line key={`slot-${value}`} className="ns-rhythm-slot" x1={noteLeft + value / capacity * noteSpan} x2={noteLeft + value / capacity * noteSpan} y1="36" y2="116" />)}
      {Array.from({length:Math.ceil(capacity / beatUnits)}, (_, i) => i * beatUnits).filter(value => value < capacity).map((value, i) => <g key={`beat-${value}`}><line className="ns-beat-guide" x1={noteLeft + value / capacity * noteSpan} x2={noteLeft + value / capacity * noteSpan} y1="34" y2="116" /><text className="ns-beat-number" x={noteLeft + value / capacity * noteSpan + 3} y="128">{i + 1}</text></g>)}
      {[0,1,2,3,4].map(i => <line key={i} x1={showClef ? 24 : 0} x2={W} y1={top + i * 15} y2={top + i * 15} stroke="#333" strokeWidth="1" />)}
      <text x="27" y="99" fontSize="64" fontFamily="serif">𝄞</text>
      {keyMarks.map((mark, i) => <text key={`${mark.symbol}-${i}`} x={72 + i * 11} y={mark.y} className="ns-key-signature-mark">{mark.symbol}</text>)}
      {entryMode && <><line className="ns-caret" x1={noteLeft + (caretStart / capacity) * noteSpan} x2={noteLeft + (caretStart / capacity) * noteSpan} y1="32" y2="116" />{ledgerYs(noteY(caretPitch)).map(line => <line key={`caret-ledger-${line}`} className="ns-ledger-line ns-ledger-preview" x1={noteLeft + (caretStart / capacity) * noteSpan - 12} x2={noteLeft + (caretStart / capacity) * noteSpan + 12} y1={line} y2={line} />)}<ellipse className="ns-shadow-note" cx={noteLeft + (caretStart / capacity) * noteSpan} cy={noteY(caretPitch)} rx="8" ry="5.5" transform={`rotate(-18 ${noteLeft + (caretStart / capacity) * noteSpan} ${noteY(caretPitch)})`} /></>}
      {measure.events.map((event, index) => {
        const dragPoint = drag?.index === index ? drag.point : null
        const x = noteLeft + (((dragPoint?.start ?? event.start) || 0) / capacity) * noteSpan
        const y = noteY(dragPoint?.pitch || event.pitch)
        const selected = selectedId === event.id
        return <g key={event.id} className={`ns-staff-note${selected ? ' selected' : ''}${dragPoint ? ' dragging' : ''}`}
          onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); onSelect(index); setDrag({ index, point: { pitch: event.pitch, start: event.start } }) }}
          onPointerMove={e => { if (drag?.index === index) setDrag({ index, point: pointFromEvent(e, event) }) }}
          onPointerUp={e => { e.stopPropagation(); if (drag?.index === index) onMove(index, drag.point.pitch, drag.point.start); setDrag(null) }}>
          {event.chord && <text x={x} y="24" textAnchor="middle" className="ns-staff-chord">{event.chord}</text>}
          {!event.rest && ledgerYs(y).map(line => <line key={`ledger-${line}`} className="ns-ledger-line" x1={x - 12} x2={x + 12} y1={line} y2={line} />)}
          {event.rest
            ? <text x={x} y="79" textAnchor="middle" fontSize="27">𝄽</text>
            : <><ellipse cx={x} cy={y} rx="8" ry="5.5" transform={`rotate(-18 ${x} ${y})`} fill={event.duration === '1' || event.duration === '2' ? 'white' : 'currentColor'} stroke="currentColor" strokeWidth="2" />
              {event.duration !== '1' && <line x1={x + 7} x2={x + 7} y1={y} y2={y - 34} stroke="currentColor" strokeWidth="2" />}
              {event.dotted && <circle cx={x + 13} cy={y} r="2" fill="currentColor" />}</>}
          {event.tuplet && <text x={x} y={Math.max(28, y - 39)} textAnchor="middle" className="ns-tuplet-number">{event.tuplet}</text>}
          {event.lyric && <text x={x} y="137" textAnchor="middle" className="ns-staff-lyric">{event.lyric}</text>}
          {selected && <rect x={x - 14} y={Math.min(y - 42, 30)} width="28" height="55" rx="5" fill="none" stroke="#b66a18" strokeWidth="2" />}
        </g>
      })}
      <line x1={W} x2={W} y1={top} y2={top + 60} stroke="#222" strokeWidth="2" />
      <text x={W - 18} y="142" textAnchor="end" className="ns-click-hint">{entryMode ? `Click at a beat and pitch to enter ${entry.rest ? 'a rest' : 'a note'}` : 'Select mode · click a note to edit it'}</text>
    </svg>
  )
}

function PaletteGroup({ title, children, open = false }) {
  return <details className="ns-palette-group" open={open}><summary>{title}</summary><div className="ns-palette-body">{children}</div></details>
}

export default function NotationStudio() {
  const [doc, setDoc] = useState(freshDoc)
  const [activePart, setActivePart] = useState(0)
  const [library, setLibrary] = useState(loadLibrary)
  const [dirty, setDirty] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [selected, setSelected] = useState({ measure: 0, event: 0 })
  const [entry, setEntry] = useState({ duration: '4', dotted: false, tuplet: 0, rest: false, harmony: false, accidental: '', articulation: '', dynamic: '' })
  const [entryMode, setEntryMode] = useState(true)
  const [viewMode, setViewMode] = useState('edit')
  const [playing, setPlaying] = useState(false)
  const [caret, setCaret] = useState({ measure: 0, start: 0, pitch: 'C4' })
  const undoRef = useRef([]), redoRef = useRef([])
  const audioRef = useRef({ context: null, nodes: [], timer: null })
  const tex = useMemo(() => buildTex(doc), [doc])
  const part = doc.parts[activePart] || doc.parts[0]
  const selectedEvent = part?.measures[selected.measure]?.events[selected.event] || null
  const partTransposition = Number(part.transposition || 0)
  const writtenKey = transposeKey(doc.key || 'C', partTransposition)
  const displayPitch = pitch => transposePitch(pitch, partTransposition, writtenKey.includes('b'))
  const concertPitch = pitch => transposePitch(pitch, -partTransposition, String(doc.key).includes('b'))
  const systems = useMemo(() => {
    const rows = []; let row = []
    part.measures.forEach((measure, index) => {
      row.push({ measure, index })
      if (measure.breakAfter || row.length === 4 || index === part.measures.length - 1) { rows.push(row); row = [] }
    })
    return rows
  }, [part])

  useEffect(() => { document.title = `${doc.title || 'Notation'}${dirty ? ' ●' : ''} — Notation Studio` }, [doc.title, dirty])

  function audioContext() {
    if (!audioRef.current.context) audioRef.current.context = new (window.AudioContext || window.webkitAudioContext)()
    audioRef.current.context.resume(); return audioRef.current.context
  }
  function scheduleTone(pitch, when, seconds, level = .12, voice = 0) {
    const context = audioContext(), oscillator = context.createOscillator(), gain = context.createGain()
    oscillator.type = voice % 3 === 0 ? 'triangle' : voice % 3 === 1 ? 'sine' : 'square'
    oscillator.frequency.setValueAtTime(pitchFrequency(pitch), when)
    gain.gain.setValueAtTime(.0001, when); gain.gain.exponentialRampToValueAtTime(level, when + .018)
    gain.gain.setValueAtTime(level, Math.max(when + .02, when + seconds - .06)); gain.gain.exponentialRampToValueAtTime(.0001, when + seconds)
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(when); oscillator.stop(when + seconds + .02)
    audioRef.current.nodes.push(oscillator)
  }
  function audition(pitch) { const context = audioContext(); scheduleTone(pitch, context.currentTime + .01, .42, .11) }
  function stopPlayback() {
    if (audioRef.current.timer) clearTimeout(audioRef.current.timer)
    audioRef.current.nodes.forEach(node => { try { node.stop() } catch {} }); audioRef.current.nodes = []; audioRef.current.timer = null; setPlaying(false)
  }
  function playScore() {
    stopPlayback(); const context = audioContext(), startAt = context.currentTime + .06
    const secondsPerUnit = (60 / Math.max(30, Number(doc.tempo || 100))) / 4
    const capacity = measureUnits(doc.timeSignature || '4/4'); let totalUnits = capacity
    doc.parts.forEach((scorePart, partIndex) => {
      totalUnits = Math.max(totalUnits, scorePart.measures.length * capacity)
      scorePart.measures.forEach((measure, measureIndex) => measure.events.forEach(event => {
        if (!event.rest) scheduleTone(event.pitch, startAt + (measureIndex * capacity + Number(event.start || 0)) * secondsPerUnit, Math.max(.08, durationUnits(event) * secondsPerUnit * .92), Math.max(.035, .11 / Math.sqrt(doc.parts.length)), partIndex)
      }))
    })
    setPlaying(true); audioRef.current.timer = setTimeout(() => { audioRef.current.nodes = []; audioRef.current.timer = null; setPlaying(false) }, totalUnits * secondsPerUnit * 1000 + 180)
  }
  useEffect(() => () => { if (audioRef.current.timer) clearTimeout(audioRef.current.timer); audioRef.current.nodes.forEach(node => { try { node.stop() } catch {} }) }, [])

  function mutate(fn) { setDoc(current => { undoRef.current.push(structuredClone(current)); if (undoRef.current.length > 80) undoRef.current.shift(); redoRef.current = []; return fn(structuredClone(current)) }); setDirty(true) }
  function undo() { if (!undoRef.current.length) return; setDoc(current => { redoRef.current.push(structuredClone(current)); return undoRef.current.pop() }); setDirty(true) }
  function redo() { if (!redoRef.current.length) return; setDoc(current => { undoRef.current.push(structuredClone(current)); return redoRef.current.pop() }); setDirty(true) }
  function patchMeta(key, value) { mutate(next => { next[key] = value; return next }) }
  function patchMeter(partIndex, value) { const meter = (doc.timeSignature || '4/4').split('/'); meter[partIndex] = String(value); patchMeta('timeSignature', `${meter[0]}/${meter[1]}`) }
  function patchPart(key, value) { mutate(next => { next.parts[activePart][key] = value; return next }) }
  function chooseInstrument(instrumentId) {
    const preset = INSTRUMENTS.find(item => item.id === instrumentId); if (!preset) return
    const previous = partTransposition
    mutate(next => { Object.assign(next.parts[activePart], { instrumentId:preset.id, name:preset.name, shortName:preset.short, clef:preset.clef, transposition:preset.transpose }); return next })
    setCaret(current => ({ ...current, pitch: transposePitch(current.pitch, preset.transpose - previous, transposeKey(doc.key, preset.transpose).includes('b')) }))
  }
  function patchEvent(measureIndex, eventIndex, key, value) {
    mutate(next => { next.parts[activePart].measures[measureIndex].events[eventIndex][key] = value; return next })
  }
  function orderedNotes() {
    return part.measures.flatMap((measure, measureIndex) => measure.events.map((event, eventIndex) => ({event, measureIndex, eventIndex}))).filter(item => !item.event.rest).sort((a,b) => a.measureIndex-b.measureIndex || a.event.start-b.event.start || pitchStep(a.event.pitch)-pitchStep(b.event.pitch))
  }
  function navigateNote(direction) {
    const notes = orderedNotes(); if (!notes.length) return null
    const current = notes.findIndex(item => item.event.id === selectedEvent?.id)
    const target = notes[Math.max(0, Math.min(notes.length - 1, (current < 0 ? 0 : current) + direction))]
    setSelected({measure:target.measureIndex,event:target.eventIndex}); setEntry(current=>({...current,duration:target.event.duration,dotted:!!target.event.dotted,tuplet:target.event.tuplet||0,rest:!!target.event.rest})); setCaret({measure:target.measureIndex,start:target.event.start,pitch:displayPitch(target.event.pitch)}); audition(target.event.pitch); return target
  }
  function selectNote(measureIndex, eventIndex) { const event=part.measures[measureIndex].events[eventIndex]; setSelected({measure:measureIndex,event:eventIndex}); setEntry(current=>({...current,duration:event.duration,dotted:!!event.dotted,tuplet:event.tuplet||0,rest:!!event.rest})); setEntryMode(false) }
  function repitchSelected(direction) {
    if (!selectedEvent || selectedEvent.rest) return
    const nextWritten = stepPitch(pitchStep(displayPitch(selectedEvent.pitch)) + direction), nextConcert = concertPitch(nextWritten)
    patchEvent(selected.measure, selected.event, 'pitch', nextConcert); setCaret(current => ({...current,pitch:nextWritten})); audition(nextConcert)
  }
  function changeSelectedRhythm(patch) {
    setEntry(current => ({...current,...patch}))
    if (!selectedEvent || entryMode) return
    mutate(next => { const events=next.parts[activePart].measures[selected.measure].events, event=events[selected.event]; Object.assign(event,patch); event.start=snapRhythmicStart(event.start,event,measureUnits(doc.timeSignature)); events.filter(other=>other.id!==event.id && eventsOverlap(other,event) && !(!event.rest&&!other.rest&&Math.abs(other.start-event.start)<.00001)).forEach(conflict=>events.splice(events.findIndex(item=>item.id===conflict.id),1)); events.sort((a,b)=>a.start-b.start); setSelected({measure:selected.measure,event:events.findIndex(item=>item.id===event.id)}); return next })
  }
  function qualifiedPitch(pitch) {
    const base = String(pitch).replace(/[#b]/, '')
    if (entry.accidental === 'sharp') return base.replace(/(\d)$/, '#$1')
    if (entry.accidental === 'flat') return base.replace(/(\d)$/, 'b$1')
    return base
  }
  function chooseQualifier(key, value) {
    setEntry(current => ({ ...current, [key]: value }))
    if (selectedEvent) patchEvent(selected.measure, selected.event, key, value)
  }
  function placeEvent(measureIndex, pitch, start) {
    const cap = measureUnits(doc.timeSignature)
    const event = { ...freshEvent(start), pitch: concertPitch(qualifiedPitch(pitch)), duration: entry.duration, dotted: entry.dotted, tuplet: entry.tuplet, rest: entry.rest, articulation: entry.articulation, dynamic: entry.dynamic }
    event.start = snapRhythmicStart(start, event, cap)
    let placedIndex = 0
    mutate(next => { const events = next.parts[activePart].measures[measureIndex].events; const sameSlot = events.find(existing => Math.abs(existing.start - event.start) < .00001 && !existing.rest); if (entry.harmony && !event.rest && sameSlot) { event.duration=sameSlot.duration; event.dotted=sameSlot.dotted; event.tuplet=sameSlot.tuplet } const conflicts = events.filter(existing => eventsOverlap(existing, event) && !(entry.harmony && !event.rest && !existing.rest && Math.abs(existing.start - event.start) < .00001)); conflicts.forEach(conflict => events.splice(events.findIndex(item => item.id === conflict.id), 1)); events.push(event); events.sort((a,b) => a.start-b.start); placedIndex = events.findIndex(e => e.id === event.id); return next })
    setSelected({ measure: measureIndex, event: placedIndex })
    if (!event.rest) audition(event.pitch)
    const nextStart = event.start + durationUnits(event)
    setCaret(nextStart < cap ? { measure: measureIndex, start: nextStart, pitch } : { measure: Math.min(part.measures.length - 1, measureIndex + 1), start: 0, pitch })
  }
  function moveEvent(measureIndex, eventIndex, pitch, start) {
    const soundingPitch = concertPitch(pitch)
    mutate(next => {
      const events = next.parts[activePart].measures[measureIndex].events
      const event = events[eventIndex]
      event.pitch = soundingPitch
      event.start = snapRhythmicStart(start, event, measureUnits(doc.timeSignature))
      const sameSlot = events.find(other => other.id !== event.id && !other.rest && Math.abs(other.start - event.start) < .00001)
      if (sameSlot && !event.rest) { event.duration=sameSlot.duration; event.dotted=sameSlot.dotted; event.tuplet=sameSlot.tuplet }
      events.filter(other => other.id !== event.id && eventsOverlap(other, event) && !(!event.rest && !other.rest && Math.abs(other.start - event.start) < .00001)).forEach(conflict => events.splice(events.findIndex(item => item.id === conflict.id), 1))
      events.sort((a, b) => a.start - b.start)
      setSelected({ measure: measureIndex, event: events.findIndex(item => item.id === event.id) })
      return next
    })
    setCaret({ measure: measureIndex, pitch, start:snapRhythmicStart(start, selectedEvent || entry, measureUnits(doc.timeSignature)) })
    audition(soundingPitch)
  }
  function removeEvent(measureIndex, eventIndex) { mutate(next => { next.parts[activePart].measures[measureIndex].events.splice(eventIndex, 1); return next }) }
  function addMeasure() { mutate(next => { next.parts[activePart].measures.push({ id: uid(), events: [freshEvent()] }); return next }) }
  function removeMeasure(index) { mutate(next => { if (next.parts[activePart].measures.length > 1) next.parts[activePart].measures.splice(index, 1); return next }) }
  function toggleSystemBreak(index) { mutate(next => { const measure = next.parts[activePart].measures[index]; measure.breakAfter = !measure.breakAfter; return next }) }
  function addPart() { mutate(next => { next.parts.push(freshPart(`Part ${next.parts.length + 1}`)); return next }); setActivePart(doc.parts.length) }
  function removePart(index) {
    if (doc.parts.length === 1 || !confirm(`Delete ${doc.parts[index].name}?`)) return
    mutate(next => { next.parts.splice(index, 1); return next }); setActivePart(Math.max(0, index - 1))
  }
  function save() {
    const saved = { ...doc, id: doc.id || uid(), updatedAt: new Date().toISOString() }
    const next = [...library.filter(item => item.id !== saved.id), saved].sort((a, b) => a.title.localeCompare(b.title))
    localStorage.setItem(STORE_KEY, JSON.stringify(next)); setLibrary(next); setDoc(saved); setDirty(false)
  }
  function load(id) {
    if (dirty && !confirm('Discard unsaved notation changes?')) return
    const found = library.find(item => item.id === id)
    if (found) { setDoc(normalizeDoc(found)); setActivePart(0); setDirty(false); undoRef.current=[]; redoRef.current=[] }
  }
  function newScore() { if (!dirty || confirm('Discard unsaved notation changes?')) { setDoc(freshDoc()); setActivePart(0); setDirty(false) } }
  function deleteScore(id) {
    const found = library.find(item => item.id === id)
    if (!found || !confirm(`Delete "${found.title}"?`)) return
    const next = library.filter(item => item.id !== id); localStorage.setItem(STORE_KEY, JSON.stringify(next)); setLibrary(next)
    if (doc.id === id) { setDoc(freshDoc()); setActivePart(0); setDirty(false) }
  }

  useEffect(() => {
    const handleKey = event => {
      if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return
      const key = event.key
      if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return }
      if (key.toLowerCase() === 'n') { event.preventDefault(); setEntryMode(v => !v); return }
      if (key === 'Escape') { setEntryMode(false); return }
      const durationKeys = { '3':'16', '4':'8', '5':'4', '6':'2', '7':'1' }
      if (durationKeys[key]) { changeSelectedRhythm({duration:durationKeys[key]}); return }
      if (key === '.') { changeSelectedRhythm({dotted:!entry.dotted}); return }
      if (selectedEvent && !entryMode && (key === 'ArrowLeft' || key === 'ArrowRight')) { event.preventDefault(); navigateNote(key === 'ArrowRight' ? 1 : -1); return }
      if (selectedEvent && !entryMode && (key === 'ArrowUp' || key === 'ArrowDown')) { event.preventDefault(); repitchSelected(key === 'ArrowUp' ? 1 : -1); return }
      if (key === 'ArrowLeft' || key === 'ArrowRight') { event.preventDefault(); const step=rhythmicGrid(entry); setCaret(c => ({...c, start:snapRhythmicStart(c.start + (key === 'ArrowRight' ? step : -step), entry, measureUnits(doc.timeSignature))})); return }
      if (key === 'ArrowUp' || key === 'ArrowDown') { event.preventDefault(); setCaret(c => ({...c, pitch:stepPitch(pitchStep(c.pitch) + (key === 'ArrowUp' ? 1 : -1))})); return }
      if (entryMode && /^[a-g]$/i.test(key)) { event.preventDefault(); const letter=key.toUpperCase(), base=pitchStep(caret.pitch), candidates=[3,4,5,6].map(o => ({pitch:`${letter}${o}`, distance:Math.abs(pitchStep(`${letter}${o}`)-base)})).sort((a,b)=>a.distance-b.distance); placeEvent(caret.measure,candidates[0].pitch,caret.start); return }
      if (entryMode && key === '0') { event.preventDefault(); const old=entry.rest; setEntry(e=>({...e,rest:true})); const restEvent={...entry,rest:true}; const eventObj={...freshEvent(caret.start),pitch:caret.pitch,duration:restEvent.duration,dotted:restEvent.dotted,tuplet:restEvent.tuplet,rest:true}; mutate(next=>{const events=next.parts[activePart].measures[caret.measure].events; const existing=events.findIndex(e=>e.start===caret.start); if(existing>=0)events.splice(existing,1,eventObj);else events.push(eventObj);events.sort((a,b)=>a.start-b.start);return next}); setEntry(e=>({...e,rest:old})); setCaret(c=>({...c,start:Math.min(measureUnits(doc.timeSignature)-1,c.start+durationUnits(eventObj))})); return }
      if (key === 'Delete' && selectedEvent) { removeEvent(selected.measure, selected.event); return }
      if (key.toLowerCase() === 't' && selectedEvent) patchEvent(selected.measure, selected.event, 'tie', !selectedEvent.tie)
    }
    window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey)
  })

  const paletteButton = (active, onClick, label, title) => <button className={active ? 'active' : ''} onClick={onClick} title={title || label}>{label}</button>

  return (
    <div className="ns-workbench">
      <header className="ns-topbar no-print">
        <div className="ns-app-heading"><h1><span aria-hidden="true">🎼</span> Notation Studio</h1><span className="ns-current-score">{doc.title || 'Untitled melody'}{dirty ? ' · unsaved' : ''}</span></div>
        <div className="ns-actions">
          <div className="ns-transport"><button className={playing ? 'active' : ''} onClick={playScore} disabled={playing}>Play Score</button><button onClick={stopPlayback} disabled={!playing}>Stop</button></div>
          <div className="ns-view-toggle"><button className={viewMode === 'edit' ? 'active' : ''} onClick={() => setViewMode('edit')}>Edit</button><button className={viewMode === 'preview' ? 'active' : ''} onClick={() => setViewMode('preview')}>Print Preview</button></div>
          <button className="cc-btn-ghost" onClick={undo} disabled={!undoRef.current.length}>Undo</button>
          <button className="cc-btn-ghost" onClick={redo} disabled={!redoRef.current.length}>Redo</button>
          <button className="cc-btn-solid" onClick={save}>Save</button>
          <button className="cc-btn-ghost" onClick={() => window.print()}>Print</button>
        </div>
      </header>

      <aside className="ns-palette no-print">
        <div className="ns-palette-file">
          <select aria-label="Notation library" value={doc.id || ''} onChange={e => load(e.target.value)}><option value="">Current score</option>{library.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
          <button onClick={newScore}>New</button>{dirty && <span className="cc-unsaved">unsaved</span>}
        </div>

        <div className="ns-mode-row">
          {paletteButton(!entryMode, () => setEntryMode(false), 'Pointer')}
          {paletteButton(entryMode && !entry.rest, () => { if (selectedEvent && !entryMode) changeSelectedRhythm({rest:false}); else { setEntryMode(true); setEntry(e => ({ ...e, rest: false })) } }, 'Note')}
          {paletteButton(entryMode && entry.rest, () => { if (selectedEvent && !entryMode) changeSelectedRhythm({rest:true}); else { setEntryMode(true); setEntry(e => ({ ...e, rest: true })) } }, 'Rest')}
        </div>

        <PaletteGroup title="Notes & Rests" open>
          <div className="ns-symbol-grid">{DURATIONS.slice(0, 5).map(([value, label]) => paletteButton(entry.duration === value, () => changeSelectedRhythm({duration:value}), value === '1' ? 'Whole' : value === '2' ? 'Half' : value === '4' ? 'Quarter' : value === '8' ? 'Eighth' : '16th', label))}</div>
          <div className="ns-symbol-grid">{paletteButton(entry.dotted, () => changeSelectedRhythm({dotted:!entry.dotted}), 'Dotted')}{selectedEvent && paletteButton(selectedEvent.tie, () => patchEvent(selected.measure, selected.event, 'tie', !selectedEvent.tie), 'Tie')}</div>
          <div className="ns-rhythm-subhead">Tuplets</div><div className="ns-symbol-grid">{paletteButton(!entry.tuplet, () => changeSelectedRhythm({tuplet:0}), 'Straight')}{paletteButton(entry.tuplet === 3, () => changeSelectedRhythm({tuplet:entry.tuplet === 3 ? 0 : 3}), 'Triplet 3:2')}</div>
          <div className="ns-rhythm-subhead">Same-staff harmony</div><div className="ns-symbol-grid">{paletteButton(!entry.harmony, () => setEntry(e => ({...e,harmony:false})), 'Melody')}{paletteButton(entry.harmony, () => setEntry(e => ({...e,harmony:!e.harmony,rest:false})), 'Add harmony')}</div><p className="ns-palette-help">Harmony mode stacks another pitch in the same rhythmic slot. Dragging a note onto another note also stacks them.</p>
        </PaletteGroup>

        <PaletteGroup title="Key & Accidentals" open>
          <div className="ns-symbol-grid">{[['','Natural'],['sharp','Sharp'],['flat','Flat']].map(([value,label]) => paletteButton(entry.accidental === value, () => setEntry(e => ({ ...e, accidental: value })), label))}</div>
          <label>Key signature<input value={doc.key} onChange={e => patchMeta('key', e.target.value)} placeholder="Eb" /></label>
        </PaletteGroup>

        <PaletteGroup title="Articulations">
          <div className="ns-symbol-grid">{[['','None'],['st','Staccato'],['ten','Tenuto'],['ac','Accent'],['hac','Marcato'],['fermata','Fermata']].map(([value,label]) => paletteButton(entry.articulation === value, () => chooseQualifier('articulation', value), label))}</div>
        </PaletteGroup>

        <PaletteGroup title="Dynamics & Expression">
          <div className="ns-symbol-grid ns-dynamics">{DYNAMICS.map(value => paletteButton(entry.dynamic === value, () => chooseQualifier('dynamic', value), value || 'None'))}</div>
        </PaletteGroup>

        <PaletteGroup title="Chords & Lyrics">
          <label>Chord symbol<input value={selectedEvent?.chord || ''} disabled={!selectedEvent} onChange={e => patchEvent(selected.measure, selected.event, 'chord', e.target.value)} placeholder="Select a note, then type Cm7" /></label>
          <label>Lyric syllable<input value={selectedEvent?.lyric || ''} disabled={!selectedEvent} onChange={e => patchEvent(selected.measure, selected.event, 'lyric', e.target.value)} onKeyDown={e => { if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const input=e.currentTarget; navigateNote(e.key === 'ArrowLeft' ? -1 : 1); requestAnimationFrame(() => { input.focus(); input.select() }) } }} placeholder="Type, then Space to advance" /></label>
          <p className="ns-palette-help">Lyrics: Space or Right Arrow advances to the next note; Left Arrow returns to the previous note.</p>
        </PaletteGroup>

        <PaletteGroup title="Parts & Voices">
          <div className="ns-part-list">{doc.parts.map((p, i) => <button key={p.id} className={i === activePart ? 'active' : ''} onClick={() => { setActivePart(i); setSelected({measure:0,event:0}) }}>{p.name}</button>)}<button onClick={addPart}>+ Add part</button></div>
          <label>Instrument<select value={part.instrumentId || 'concert'} onChange={e => chooseInstrument(e.target.value)}>{INSTRUMENTS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <div className="ns-transposition-note"><strong>Written key: {writtenKey}</strong><span>{partTransposition ? `Automatic transposition: +${partTransposition} written semitones from concert pitch.` : 'Concert-pitch instrument.'}</span></div>
          <label>Part name<input value={part.name} onChange={e => patchPart('name', e.target.value)} /></label>
          <label>Clef<select value={part.clef} onChange={e => patchPart('clef', e.target.value)}>{CLEFS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          {doc.parts.length > 1 && <button className="ns-danger" onClick={() => removePart(activePart)}>Delete part</button>}
        </PaletteGroup>

        <PaletteGroup title="Score Setup">
          <label>Title<input value={doc.title} onChange={e => patchMeta('title', e.target.value)} /></label>
          <label>Composer<input value={doc.composer} onChange={e => patchMeta('composer', e.target.value)} /></label>
          <label>Common meter<select value={doc.timeSignature} onChange={e => patchMeta('timeSignature', e.target.value)}>{!['2/2','3/2','4/2','2/4','3/4','4/4','5/4','6/4','3/8','5/8','6/8','7/8','9/8','12/8'].includes(doc.timeSignature) && <option>{doc.timeSignature}</option>}{['2/2','3/2','4/2','2/4','3/4','4/4','5/4','6/4','3/8','5/8','6/8','7/8','9/8','12/8'].map(x => <option key={x}>{x}</option>)}</select></label>
          <div className="ns-meter-builder"><label>Beats<select value={(doc.timeSignature || '4/4').split('/')[0]} onChange={e => patchMeter(0,e.target.value)}>{Array.from({length:16},(_,i)=>i+1).map(x=><option key={x}>{x}</option>)}</select></label><span>/</span><label>Beat value<select value={(doc.timeSignature || '4/4').split('/')[1]} onChange={e => patchMeter(1,e.target.value)}>{[2,4,8,16].map(x=><option key={x}>{x}</option>)}</select></label></div>
          <label>Tempo<input type="number" min="30" max="300" value={doc.tempo} onChange={e => patchMeta('tempo', Number(e.target.value))} /></label>
          {doc.id && <button className="ns-danger" onClick={() => deleteScore(doc.id)}>Delete saved score</button>}
        </PaletteGroup>

        {selectedEvent && <div className="ns-selection-card"><span>Selected</span><strong>{selectedEvent.rest ? 'Rest' : displayPitch(selectedEvent.pitch)}</strong><button className="ns-danger" onClick={() => removeEvent(selected.measure, selected.event)}>Delete note</button></div>}
        <p className="ns-shortcuts"><kbd>N</kbd> note mode · <kbd>A-G</kbd> enter · arrows move caret · drag notes to move</p>
      </aside>

      <main className={`ns-score-area ${viewMode === 'preview' ? 'is-preview' : ''}`}>
        {viewMode === 'edit' ? <div className="ns-score-page">
          <div className="ns-score-heading"><h2>{doc.title}</h2>{doc.composer && <p>{doc.composer}</p>}<div><span>{part.name}</span><span>{writtenKey} major · {doc.timeSignature} · quarter = {doc.tempo}</span></div></div>
          <div className="ns-score-systems">{systems.map((system, systemIndex) => <div className="ns-score-system" key={`${systemIndex}-${system[0].measure.id}`}>
            {system.map(({measure, index: mi}, position) => <div className="ns-score-measure" key={measure.id}>
              <StaffMeasure measure={{...measure, events:measure.events.map(event => ({...event, pitch:displayPitch(event.pitch), chord:transposeChord(event.chord, partTransposition, writtenKey.includes('b'))}))}} measureNumber={mi + 1} showClef={position === 0} keySignature={writtenKey} entry={entry} entryMode={entryMode && caret.measure === mi} caretStart={caret.start} caretPitch={caret.pitch} capacity={measureUnits(doc.timeSignature)} beatUnits={16 / Number((doc.timeSignature || '4/4').split('/')[1])} selectedId={selected.measure === mi ? selectedEvent?.id : null}
                onSelect={event => selectNote(mi,event)} onCaret={point => setCaret({measure:mi,...point})} onPlace={(pitch,start) => placeEvent(mi, pitch, start)} onMove={(event,pitch,start) => moveEvent(mi,event,pitch,start)} />
              <div className="ns-measure-tools no-print"><button onClick={() => toggleSystemBreak(mi)} className={measure.breakAfter ? 'active' : ''}>{measure.breakAfter ? 'Remove break' : 'Break after'}</button><button onClick={() => removeMeasure(mi)} disabled={part.measures.length === 1} aria-label={`Remove measure ${mi + 1}`}>Delete</button></div>
            </div>)}
          </div>)}</div>
          <button className="ns-add-system no-print" onClick={addMeasure}>+ Add measure</button>
        </div> : <div className="ns-paper"><AlphaTabScore tex={tex} /></div>}
      </main>
    </div>
  )

  return (
    <div className="ns-page">
      <aside className="ns-editor no-print">
        <header className="ns-header">
          <div><span className="ns-kicker">Rainbow Heart Studio</span><h1>Notation Studio</h1></div>
          <div className="ns-actions"><button className="cc-btn-solid" onClick={save}>Save</button><button className="cc-btn-ghost" onClick={undo} disabled={!undoRef.current.length}>↶ Undo</button><button className="cc-btn-ghost" onClick={redo} disabled={!redoRef.current.length}>↷ Redo</button><button className="cc-btn-ghost" onClick={newScore}>+ New</button><button className="cc-btn-ghost" onClick={() => window.print()}>Print</button></div>
        </header>

        <section className="ns-library">
          <label>Library <select value={doc.id || ''} onChange={e => load(e.target.value)}><option value="">Current unsaved score</option>{library.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          {doc.id && <button className="cc-lib-delete" onClick={() => deleteScore(doc.id)}>Delete</button>}
          {dirty && <span className="cc-unsaved">● unsaved</span>}
        </section>

        <section className="ns-meta-grid">
          <label>Title<input value={doc.title} onChange={e => patchMeta('title', e.target.value)} /></label>
          <label>Composer<input value={doc.composer} onChange={e => patchMeta('composer', e.target.value)} /></label>
          <label>Key<input value={doc.key} onChange={e => patchMeta('key', e.target.value)} placeholder="Eb" /></label>
          <label>Meter<select value={doc.timeSignature} onChange={e => patchMeta('timeSignature', e.target.value)}>{['4/4','3/4','2/4','6/8','9/8','12/8','5/4','7/8'].map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Tempo<input type="number" min="30" max="300" value={doc.tempo} onChange={e => patchMeta('tempo', Number(e.target.value))} /></label>
        </section>

        <div className="ns-parts">
          {doc.parts.map((p, i) => <button key={p.id} className={i === activePart ? 'active' : ''} onClick={() => setActivePart(i)}>{p.name}</button>)}
          <button onClick={addPart}>+ Part</button>
        </div>

        <section className="ns-part-meta">
          <label>Part name<input value={part.name} onChange={e => patchPart('name', e.target.value)} /></label>
          <label>Short<input value={part.shortName} maxLength="8" onChange={e => patchPart('shortName', e.target.value)} /></label>
          <label>Clef<select value={part.clef} onChange={e => patchPart('clef', e.target.value)}>{CLEFS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          {doc.parts.length > 1 && <button className="ns-danger" onClick={() => removePart(activePart)}>Delete part</button>}
        </section>

        <section className="ns-note-toolbar" aria-label="Note entry toolbar">
          <div className="ns-tool-group"><strong>Mode</strong><button className={!entryMode ? 'active' : ''} onClick={() => setEntryMode(false)}>↖ Select</button><button className={entryMode ? 'active' : ''} onClick={() => setEntryMode(true)}>✎ Notes</button></div>
          <div className="ns-tool-group"><strong>Enter</strong><button className={!entry.rest ? 'active' : ''} onClick={() => setEntry(e => ({ ...e, rest: false }))}>♪ Note</button><button className={entry.rest ? 'active' : ''} onClick={() => setEntry(e => ({ ...e, rest: true }))}>𝄽 Rest</button></div>
          <div className="ns-tool-group"><strong>Value</strong>{DURATIONS.slice(0, 5).map(([value, label]) => <button key={value} className={entry.duration === value ? 'active' : ''} title={label} onClick={() => setEntry(e => ({ ...e, duration: value }))}>{value === '1' ? '𝅝' : value === '2' ? '𝅗𝅥' : value === '4' ? '♩' : value === '8' ? '♪' : '𝅘𝅥𝅯'}</button>)}<button className={entry.dotted ? 'active' : ''} onClick={() => setEntry(e => ({ ...e, dotted: !e.dotted }))}>• Dot</button></div>
          <span className="ns-toolbar-help"><kbd>N</kbd> entry · <kbd>A–G</kbd> pitches · <kbd>3–7</kbd> values · <kbd>0</kbd> rest · <kbd>.</kbd> dot</span>
        </section>

        <div className="ns-measures">
          {part.measures.map((measure, mi) => (
            <section className="ns-measure" key={measure.id}>
              <header><strong>Measure {mi + 1}</strong><button onClick={() => removeMeasure(mi)} disabled={part.measures.length === 1}>× Measure</button></header>
              <StaffMeasure measure={measure} entry={entry} entryMode={entryMode && caret.measure === mi} caretStart={caret.start} caretPitch={caret.pitch} capacity={measureUnits(doc.timeSignature)} selectedId={selected.measure === mi ? selectedEvent?.id : null} onSelect={event => { setSelected({ measure: mi, event }); setEntryMode(false) }} onCaret={point => setCaret({measure:mi,...point})} onPlace={(pitch,start) => placeEvent(mi, pitch, start)} />
            </section>
          ))}
          <button className="cc-btn-solid ns-add-measure" onClick={addMeasure}>+ Add Measure</button>
        </div>

        {selectedEvent && <section className="ns-inspector">
          <header><div><span className="ns-kicker">Selected note</span><strong>{selectedEvent.rest ? 'Rest' : selectedEvent.pitch} · {DURATIONS.find(([v]) => v === selectedEvent.duration)?.[1]}</strong></div><button className="ns-danger" onClick={() => removeEvent(selected.measure, selected.event)}>Delete note</button></header>
          <div className="ns-inspector-grid">
            <label>Pitch<input value={selectedEvent.pitch} disabled={selectedEvent.rest} onChange={e => patchEvent(selected.measure, selected.event, 'pitch', e.target.value)} /></label>
            <label>Duration<select value={selectedEvent.duration} onChange={e => patchEvent(selected.measure, selected.event, 'duration', e.target.value)}>{DURATIONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>Chord symbol<input value={selectedEvent.chord} onChange={e => patchEvent(selected.measure, selected.event, 'chord', e.target.value)} placeholder="Cm7" /></label>
            <label>Lyric syllable<input value={selectedEvent.lyric} onChange={e => patchEvent(selected.measure, selected.event, 'lyric', e.target.value)} placeholder="sing-" /></label>
            <label>Dynamic<select value={selectedEvent.dynamic} onChange={e => patchEvent(selected.measure, selected.event, 'dynamic', e.target.value)}>{DYNAMICS.map(x => <option key={x} value={x}>{x || 'None'}</option>)}</select></label>
            <label>Articulation<select value={selectedEvent.articulation} onChange={e => patchEvent(selected.measure, selected.event, 'articulation', e.target.value)}><option value="">None</option><option value="st">Staccato</option><option value="ten">Tenuto</option><option value="ac">Accent</option><option value="hac">Heavy accent</option><option value="fermata">Fermata</option><option value="v">Vibrato</option></select></label>
          </div>
          <div className="ns-inspector-checks"><label><input type="checkbox" checked={selectedEvent.rest} onChange={e => patchEvent(selected.measure, selected.event, 'rest', e.target.checked)} /> Rest</label><label><input type="checkbox" checked={selectedEvent.dotted} onChange={e => patchEvent(selected.measure, selected.event, 'dotted', e.target.checked)} /> Dotted</label><label><input type="checkbox" checked={selectedEvent.tie} onChange={e => patchEvent(selected.measure, selected.event, 'tie', e.target.checked)} /> Tie forward</label><label>Slur ID <input value={selectedEvent.slur} onChange={e => patchEvent(selected.measure, selected.event, 'slur', e.target.value)} placeholder="A" /></label></div>
        </section>}

        <details open={sourceOpen} onToggle={e => setSourceOpen(e.currentTarget.open)} className="ns-source"><summary>Advanced: generated alphaTex</summary><textarea readOnly value={tex} /></details>
      </aside>

      <main className="ns-preview">
        <div className="ns-paper"><AlphaTabScore tex={tex} /></div>
      </main>
    </div>
  )
}
