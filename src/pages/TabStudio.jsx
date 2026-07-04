import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { fetchTabs, fetchTab, saveTab, deleteTab } from '../lib/tabs'

/* ── Instruments ──
   rows   = string labels top-to-bottom as drawn in the grid (highest string first)
   tuning = pitches in the SAME order (string 1 first) — alphaTex's \tuning maps
   its first value to string 1, which is how note tokens like `3.1` are addressed.
   (The old code listed tunings low-to-high, which mirrored every riff across the
   strings in playback/notation — fixed 2026-07.) */
const BUILTIN_INSTRUMENTS = [
  { id: 'bass',       label: 'Bass',        rows: ['G','D','A','E'],         tuning: ['G2','D2','A1','E1'] },
  { id: 'guitar',     label: 'Guitar',      rows: ['e','B','G','D','A','E'], tuning: ['E4','B3','G3','D3','A2','E2'] },
  { id: 'uke',        label: 'Ukulele',     rows: ['A','E','C','G'],         tuning: ['A4','E4','C4','G4'] },
  { id: 'guitarlele', label: 'Guitarlele',  rows: ['a','E','C','G','D','A'], tuning: ['A4','E4','C4','G3','D3','A2'] },
  { id: 'banjo',      label: 'Banjo (5-str)', rows: ['D','B','G','D','g'],   tuning: ['D4','B3','G3','D3','G4'] },
]

/* Custom instruments live in localStorage; every saved tab also embeds its
   instrument definition (label, string labels, tuning) so tabs made with a
   custom instrument still load and render anywhere. */
const CUSTOM_INST_KEY = 'rh_custom_instruments_v1'
function loadCustomInstruments() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_INST_KEY)) || [] } catch { return [] }
}
function persistCustomInstruments(list) {
  try { localStorage.setItem(CUSTOM_INST_KEY, JSON.stringify(list)) } catch {}
}

const PITCH_RE = /^[A-G](#|b)?[0-8]$/

const SIG_OPTIONS = ['4/4','3/4','2/4','6/8','12/8','5/4','7/8']

const NOTE_DURS = [
  {s:16,v:'1',d:false},{s:12,v:'2',d:true},{s:8,v:'2',d:false},
  {s:6,v:'4',d:true},{s:4,v:'4',d:false},{s:3,v:'8',d:true},
  {s:2,v:'8',d:false},{s:1,v:'16',d:false},
]
const REST_DURS = [{s:16,v:'1'},{s:8,v:'2'},{s:4,v:'4'},{s:2,v:'8'},{s:1,v:'16'}]

/* ── Pure helpers ── */

function calcDims(sig, gridDiv) {
  const [num, den]    = sig.split('/').map(Number)
  const slotsPerCell  = 16 / gridDiv
  const slotsPerBar   = num * 16 / den
  const beatUnitSlots = 16 / den
  return {
    num, den, slotsPerCell, slotsPerBar, beatUnitSlots,
    cellsPerBeat: beatUnitSlots / slotsPerCell,
    cellsPerBar:  slotsPerBar  / slotsPerCell,
  }
}

function makeGrid(stringCount, cellsPerBar, bars) {
  const cols = cellsPerBar * bars
  return Array.from({ length: stringCount }, () => Array(cols).fill(''))
}

function resizeGrid(old, stringCount, cellsPerBar, bars) {
  const cols = cellsPerBar * bars
  return Array.from({ length: stringCount }, (_, r) =>
    Array.from({ length: cols }, (_, c) => old[r]?.[c] ?? '')
  )
}

function seedGrid() {
  const d = calcDims('4/4', 16)
  const g = makeGrid(4, d.cellsPerBar, 2)
  const E = 3
  const cpb = d.cellsPerBar
  g[E][0]='1'; g[E][4]='3'; g[E][cpb]='1'; g[E][cpb+4]='3'; g[E][cpb+8]='6'; g[E][cpb+12]='3'
  return g
}

/* ── alphaTex helpers ── */

function restList(n) {
  const o = []; let rem = n
  while (rem > 0) { const x = REST_DURS.find(q => q.s <= rem); o.push('r.'+x.v); rem -= x.s }
  return o
}

function noteTok(notes, dur) {
  const c = notes.length > 1
    ? '('+notes.map(n => n.fret+'.'+n.string).join(' ')+')'
    : notes[0].fret+'.'+notes[0].string
  return c+'.'+dur.v+(dur.d ? '{d}' : '')
}

function barToTex(onset, spb) {
  const slots = Object.keys(onset).map(Number).sort((a,b) => a-b)
  if (!slots.length) return restList(spb).join(' ')
  const beats = []
  if (slots[0] > 0) beats.push(...restList(slots[0]))
  slots.forEach((s, i) => {
    const end = i+1 < slots.length ? slots[i+1] : spb
    const L   = end - s
    const nd  = NOTE_DURS.find(x => x.s <= L)
    beats.push(noteTok(onset[s], nd))
    beats.push(...restList(L - nd.s))
  })
  return beats.join(' ')
}

function buildTex(instDef, sig, gridDiv, bars, frets, title, tempo) {
  const d    = calcDims(sig, gridDiv)
  const rows = instDef.rows
  const out  = []
  for (let b = 0; b < bars; b++) {
    const onset = {}
    for (let lc = 0; lc < d.cellsPerBar; lc++) {
      const ac = b * d.cellsPerBar + lc
      const slot = lc * d.slotsPerCell
      rows.forEach((_, r) => {
        const f = frets[r]?.[ac]
        if (f !== '' && f != null) {
          onset[slot] = onset[slot] || []
          onset[slot].push({ string: r+1, fret: f })
        }
      })
    }
    out.push(barToTex(onset, d.slotsPerBar))
  }
  const T = (title || 'Untitled').replace(/"/g, '\\"')
  const L = (instDef.label || 'Tab').replace(/"/g, '\\"')
  return (
    `\\title "${T}"\n\\subtitle "Brother Jon & The Rainbow Hearts"\n\\tempo ${tempo}\n.\n` +
    `\\track "${L}" \\staff{tabs} \\tuning ${instDef.tuning.join(' ')}\n` +
    `\\ts ${d.num} ${d.den}\n` + out.join(' |\n') + ' |'
  )
}

function buildAscii(instDef, sig, gridDiv, bars, frets) {
  const d    = calcDims(sig, gridDiv)
  const rows = instDef.rows
  let w = 1
  frets.forEach(r => r.forEach(f => { if (f && (''+f).length > w) w = (''+f).length }))
  const cw = Math.max(2, w+1)
  return rows.map((s, r) => {
    let line = s+'|'
    for (let c = 0; c < d.cellsPerBar * bars; c++) {
      if (c > 0 && c % d.cellsPerBar === 0) line += '|'
      const f = frets[r]?.[c]
      line += (f !== '' && f != null)
        ? (''+f) + '-'.repeat(cw - (''+f).length)
        : '-'.repeat(cw)
    }
    return line+'|'
  }).join('\n')
}

/* ── Component ── */
export default function TabStudio() {

  /* grid config */
  const [inst,    setInst]    = useState('bass')
  const [sig,     setSig]     = useState('4/4')
  const [gridDiv, setGridDiv] = useState(16)
  const [bars,    setBars]    = useState(2)
  const [frets,   setFrets]   = useState(seedGrid)
  const [title,   setTitle]   = useState('Bloody Knuckles — Intro Riff')
  const [tempo,   setTempo]   = useState(124)

  /* custom instruments */
  const [customInsts, setCustomInsts] = useState(loadCustomInstruments)
  const [instEditorOpen, setInstEditorOpen] = useState(false)
  const [ciName,    setCiName]    = useState('')
  const [ciStrings, setCiStrings] = useState([
    { label: 'A', pitch: 'A4' }, { label: 'E', pitch: 'E4' },
    { label: 'C', pitch: 'C4' }, { label: 'G', pitch: 'G4' },
  ])

  const allInsts = [...BUILTIN_INSTRUMENTS, ...customInsts]
  const instDef  = allInsts.find(i => i.id === inst) || BUILTIN_INSTRUMENTS[0]

  function registerCustom(def) {
    setCustomInsts(list => {
      const next = [...list.filter(i => i.id !== def.id), def]
      persistCustomInstruments(next)
      return next
    })
  }

  /* library */
  const [tabs,        setTabs]        = useState([])
  const [loadingLib,  setLoadingLib]  = useState(true)
  const [curId,       setCurId]       = useState(null)
  const [libName,     setLibName]     = useState('')
  const [libStatus,   setLibStatus]   = useState('')
  const [libDropOpen, setLibDropOpen] = useState(false)
  const [libMenuPos,  setLibMenuPos]  = useState({ left: 0, top: 0 })
  const [dirty,       setDirty]       = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState(null)

  /* player */
  const [playerReady,  setPlayerReady]  = useState(false)
  const [playerStatus, setPlayerStatus] = useState('loading engine…')

  /* refs */
  const viewportRef    = useRef(null)
  const atApiRef       = useRef(null)
  const renderTimerRef = useRef(null)
  const fileInputRef   = useRef(null)
  const libBtnRef      = useRef(null)

  /* derived */
  const d    = calcDims(sig, gridDiv)
  const rows = instDef.rows

  /* ── Load tab library from Supabase ── */
  const refreshLib = useCallback(async () => {
    try   { setTabs(await fetchTabs()) }
    catch (e) { console.error('Failed to load tabs', e) }
    finally   { setLoadingLib(false) }
  }, [])
  useEffect(() => { refreshLib() }, [refreshLib])

  /* ── Load alphaTab CDN script once on mount ── */
  useEffect(() => {
    function initApi() {
      if (!viewportRef.current || atApiRef.current) return
      try {
        const api = new window.alphaTab.AlphaTabApi(viewportRef.current, {
          core:    { fontDirectory: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/font/' },
          display: { stretchForce: 0.9 },
          player:  {
            enablePlayer:  true,
            enableCursor:  true,
            soundFont:     'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2',
            scrollElement: viewportRef.current,
          },
        })
        api.renderFinished?.on(() => setPlayerStatus(s => s === 'loading engine…' ? 'rendered — sound loading…' : s))
        api.soundFontLoad?.on(e => { if (e?.total) setPlayerStatus('soundfont ' + Math.floor((e.loaded/e.total)*100) + '%') })
        api.playerReady?.on(() => { setPlayerReady(true); setPlayerStatus('ready — press Play.') })
        api.error?.on?.(e => setPlayerStatus('error: ' + (e?.message || e)))
        atApiRef.current = api
      } catch (err) {
        setPlayerStatus('Could not load alphaTab: ' + err.message)
      }
    }

    if (window.alphaTab) { initApi(); return }
    let s = document.querySelector('script[data-rh-alphatab]')
    if (!s) {
      s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/alphaTab.min.js'
      s.setAttribute('data-rh-alphatab', '1')
      s.onerror = () => setPlayerStatus('Failed to load alphaTab script.')
      document.head.appendChild(s)
    }
    s.addEventListener('load', initApi)
    return () => {
      if (atApiRef.current) { try { atApiRef.current.destroy?.() } catch {} atApiRef.current = null; setPlayerReady(false) }
    }
  }, [])

  /* ── Resize frets when grid config changes ── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setFrets(prev => resizeGrid(prev, instDef.rows.length, d.cellsPerBar, bars)) }, [inst, sig, gridDiv, bars, instDef.rows.length])

  /* ── Debounced alphaTex render ── */
  useEffect(() => {
    clearTimeout(renderTimerRef.current)
    renderTimerRef.current = setTimeout(() => {
      if (!atApiRef.current) return
      try {
        atApiRef.current.tex(buildTex(instDef, sig, gridDiv, bars, frets, title, tempo))
        setPlayerStatus(p => playerReady ? 'updated.' : p)
      } catch (e) { setPlayerStatus('alphaTex error: ' + e.message) }
    }, 300)
    return () => clearTimeout(renderTimerRef.current)
  }, [inst, instDef, sig, gridDiv, bars, frets, title, tempo, playerReady])

  /* ── Close library dropdown on outside click ── */
  useEffect(() => {
    if (!libDropOpen) return
    const handler = e => { if (!libBtnRef.current?.contains(e.target)) setLibDropOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [libDropOpen])

  /* ── Payload helpers ── */
  function buildTabData() {
    return {
      format: 'rainbowhearts.tab', version: 2,
      title,
      instrument:      inst,
      instrumentLabel: instDef.label,
      stringLabels:    instDef.rows,
      tuning:          instDef.tuning.join(' '),
      timeSignature: sig, gridDivision: gridDiv, bars, tempo,
      grid:     frets.map(r => r.slice()),
      alphaTex: buildTex(instDef, sig, gridDiv, bars, frets, title, tempo),
      ascii:    buildAscii(instDef, sig, gridDiv, bars, frets),
    }
  }

  function buildPayload() {
    return {
      ...buildTabData(),
      id: curId || null,
      name: libName || title || 'Untitled tab',
      updated: new Date().toISOString(),
    }
  }

  /* Resolve a payload's instrument. Unknown ids (a custom instrument made on
     another machine) are reconstructed from the embedded definition and
     re-registered locally so the tab keeps working everywhere. */
  function resolveInstrument(p) {
    const found = allInsts.find(i => i.id === p.instrument)
    if (found) return found
    const rowCount = p.stringLabels?.length || p.grid?.length || 4
    const def = {
      id:     p.instrument || 'custom_' + Date.now(),
      label:  p.instrumentLabel || 'Custom',
      rows:   p.stringLabels || Array.from({ length: rowCount }, (_, i) => String(rowCount - i)),
      tuning: (p.tuning || '').split(/\s+/).filter(Boolean).length === rowCount
        ? p.tuning.split(/\s+/)
        : Array(rowCount).fill('C4'),
    }
    registerCustom(def)
    return def
  }

  function applyTabData(p, name, id) {
    const def = resolveInstrument(p)
    const ns=p.timeSignature||'4/4', ng=p.gridDivision||16, nb=p.bars||2
    setInst(def.id); setSig(ns); setGridDiv(ng); setBars(nb)
    setTitle(p.title||''); setTempo(p.tempo||120)
    setLibName(name); setCurId(id)
    const d2 = calcDims(ns, ng)
    const newFrets = makeGrid(def.rows.length, d2.cellsPerBar, nb)
    if (p.grid) p.grid.forEach((row,r) => row.forEach((f,c) => { if (newFrets[r] && c < newFrets[r].length) newFrets[r][c] = f||'' }))
    setFrets(newFrets); setDirty(false)
  }

  function applyPayload(p) {
    if (!p || p.format !== 'rainbowhearts.tab') { alert('Not a Tab Studio file.'); return }
    applyTabData(p, p.name || p.title || '', null)
  }

  function applyFromRecord(record) {
    applyTabData(record.tab_data || {}, record.title || '', record.id)
  }

  /* ── Library actions ── */
  async function handleSave() {
    setSaving(true); setSaveMsg(null)
    try {
      const tab_data = buildTabData()
      const saved = await saveTab({ id: curId, title: libName || title || 'Untitled Tab', tab_data })
      setCurId(saved.id); setLibName(saved.title); setDirty(false)
      setSaveMsg('Saved!'); await refreshLib()
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (e) {
      setSaveMsg('Error saving'); console.error(e)
    } finally { setSaving(false) }
  }

  async function handleLibLoad(id) {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    try {
      const record = await fetchTab(id)
      applyFromRecord(record)
      setLibStatus('Loaded "' + (record.title||id) + '"')
    } catch (e) { console.error('Failed to load tab', e) }
    setLibDropOpen(false)
  }

  async function handleLibDelete(id, tabTitle, e) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${tabTitle}"?`)) return
    try {
      await deleteTab(id)
      if (curId === id) handleNew()
      await refreshLib()
    } catch (e) { console.error('Failed to delete tab', e) }
  }

  function handleNew() {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    setInst('bass'); setSig('4/4'); setGridDiv(16); setBars(2)
    setTitle('New Tab'); setTempo(120)
    setCurId(null); setLibName(''); setDirty(false); setSaveMsg(null)
    setFrets(makeGrid(4, calcDims('4/4',16).cellsPerBar, 2))
    setLibDropOpen(false)
  }

  /* ── Export / Import ── */
  function handleExport() {
    const p = buildPayload()
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = (p.name||'tab').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_') + '.tab.json'
    a.click(); URL.revokeObjectURL(a.href)
  }

  function handleImport(file) {
    const r = new FileReader()
    r.onload = () => { try { applyPayload(JSON.parse(r.result)) } catch(e) { alert('Could not read file: '+e.message) } }
    r.readAsText(file)
  }

  function handleCopy(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const t = btn.textContent; btn.textContent = 'Copied ✓'
      setTimeout(() => btn.textContent = t, 1200)
    })
  }

  /* ── Grid interaction ── */
  function handleCellChange(r, c, raw) {
    let v = raw.replace(/[^0-9]/g, '')
    if (v !== '' && +v > 24) v = '24'
    setFrets(prev => { const next = prev.map(row => [...row]); next[r][c] = v; return next })
    setDirty(true)
  }

  function handleCellKey(e, r, c) {
    const tot = d.cellsPerBar * bars, rc = rows.length
    let nr = r, nc = c
    if      (e.key === 'ArrowRight') nc = Math.min(tot-1, c+1)
    else if (e.key === 'ArrowLeft')  nc = Math.max(0, c-1)
    else if (e.key === 'ArrowDown')  nr = Math.min(rc-1, r+1)
    else if (e.key === 'ArrowUp')    nr = Math.max(0, r-1)
    else return
    e.preventDefault()
    document.querySelector(`[data-r="${nr}"][data-c="${nc}"]`)?.focus()
  }

  /* ── Library list (already sorted by title from Supabase) ── */
  const libList = tabs

  /* ── Render ── */
  return (
    <div className="ts-page">

      {/* ── Sticky header ── */}
      <div className="ts-sticky-header">
        <div className="ts-header-inner">
          <div className="cc-header-row">
            <h2 className="ts-page-title">🎸 Tab Studio</h2>
          </div>
          <div className="cc-savebar ts-savebar">
            <button className="cc-btn-solid cc-btn-save" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : curId ? 'Save Changes' : 'Save Tab'}
            </button>
            <button className="cc-btn-ghost" onClick={handleNew}>+ New</button>
            <button className="cc-btn-ghost" onClick={handleExport}>⬇ Export .tab.json</button>
            <button className="cc-btn-ghost" onClick={() => fileInputRef.current?.click()}>⬆ Import .tab.json</button>
            <input
              ref={fileInputRef} type="file" accept=".json,.tab,application/json"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) { handleImport(e.target.files[0]); e.target.value='' } }}
            />

            {/* Library dropdown */}
            <div className="cc-library-dropdown" ref={libBtnRef}>
              <button
                className="cc-library-btn"
                onClick={() => {
                  if (!libDropOpen && libBtnRef.current) {
                    const rect = libBtnRef.current.getBoundingClientRect()
                    setLibMenuPos({ left: rect.left, top: rect.bottom + 4 })
                  }
                  setLibDropOpen(o => !o)
                }}
              >
                Library {tabs.length > 0 && `(${tabs.length})`}
              </button>
              {libDropOpen && (
                <div className="cc-library-menu" style={{ left: libMenuPos.left, top: libMenuPos.top }}>
                  {loadingLib ? (
                    <div className="cc-lib-item disabled">Loading…</div>
                  ) : libList.length === 0 ? (
                    <div className="cc-lib-item disabled">No saved tabs</div>
                  ) : libList.map(entry => (
                    <div
                      key={entry.id}
                      className={`cc-lib-item${curId === entry.id ? ' active' : ''}`}
                      onClick={() => handleLibLoad(entry.id)}
                    >
                      <span className="cc-lib-title">{entry.title || 'Untitled'}</span>
                      <button className="cc-lib-delete" onClick={e => handleLibDelete(entry.id, entry.title || 'Untitled', e)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {saveMsg  && <span className="cc-save-msg">{saveMsg}</span>}
            {dirty && !saveMsg && <span className="cc-unsaved">● unsaved</span>}
          </div>
          {libStatus && <div className="ts-lib-status">{libStatus}</div>}
        </div>
      </div>

      <div className="ts-wrap">

        {/* ── Builder card ── */}
        <div className="ts-card">
          <div className="ts-card-label">Builder</div>

          {/* Controls row */}
          <div className="ts-controls">
            <div className="ts-ctrl-group">
              <span className="ts-ctrl-label">Instrument</span>
              <div className="ts-inst-row">
                <select
                  className="ts-select"
                  value={inst}
                  onChange={e => {
                    if (e.target.value === '__new') { setInstEditorOpen(true); return }
                    setInst(e.target.value); setDirty(true)
                  }}
                >
                  {allInsts.map(i => (
                    <option key={i.id} value={i.id}>{i.label} · {i.rows.length} str</option>
                  ))}
                  <option value="__new">+ New instrument…</option>
                </select>
                {inst.startsWith('custom_') && (
                  <button
                    className="ts-inst-delete"
                    title="Delete this custom instrument (saved tabs keep working)"
                    onClick={() => {
                      if (!window.confirm(`Delete instrument "${instDef.label}"? Tabs already saved with it keep working.`)) return
                      setCustomInsts(list => {
                        const next = list.filter(i => i.id !== inst)
                        persistCustomInstruments(next)
                        return next
                      })
                      setInst('bass')
                    }}
                  >✕</button>
                )}
              </div>
            </div>

            <div className="ts-ctrl-group">
              <span className="ts-ctrl-label">Time sig</span>
              <select className="ts-select" value={sig} onChange={e => { setSig(e.target.value); setDirty(true) }}>
                {SIG_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="ts-ctrl-group">
              <span className="ts-ctrl-label">Grid</span>
              <div className="ts-seg">
                <button className={`ts-seg-btn${gridDiv===8?' on':''}`} onClick={() => { setGridDiv(8); setDirty(true) }}>1/8</button>
                <button className={`ts-seg-btn${gridDiv===16?' on':''}`} onClick={() => { setGridDiv(16); setDirty(true) }}>1/16</button>
              </div>
            </div>

            <div className="ts-ctrl-group">
              <span className="ts-ctrl-label">Bars</span>
              <div className="ts-stepper">
                <button className="ts-step-btn" onClick={() => { if (bars > 1) { setBars(b => b-1); setDirty(true) } }}>−</button>
                <span className="ts-step-val">{bars}</span>
                <button className="ts-step-btn" onClick={() => { if (bars < 8) { setBars(b => b+1); setDirty(true) } }}>+</button>
              </div>
            </div>

            <div className="ts-ctrl-group">
              <span className="ts-ctrl-label">Tempo</span>
              <input className="ts-input ts-tempo-input" type="number" min="40" max="300"
                value={tempo} onChange={e => { setTempo(parseInt(e.target.value,10)||120); setDirty(true) }} />
            </div>

            <div className="ts-ctrl-group ts-ctrl-wide">
              <span className="ts-ctrl-label">Title (shown on staff)</span>
              <input className="ts-input ts-title-input" value={title}
                onChange={e => { setTitle(e.target.value); setDirty(true) }} placeholder="Riff name…" />
            </div>
          </div>

          {/* Custom instrument editor */}
          {instEditorOpen && (
            <div className="ts-inst-editor">
              <div className="ts-inst-editor-head">
                <strong>New instrument</strong>
                <span className="ts-inst-editor-hint">Strings top → bottom as they'll appear in the grid (highest first). Pitch = note + octave, e.g. G4.</span>
              </div>
              <div className="ts-inst-editor-row">
                <label className="ts-ctrl-group">
                  <span className="ts-ctrl-label">Name</span>
                  <input className="ts-input" value={ciName} onChange={e => setCiName(e.target.value)} placeholder="Mandolin, Dobro…" />
                </label>
                <div className="ts-ctrl-group">
                  <span className="ts-ctrl-label">Strings</span>
                  <div className="ts-stepper">
                    <button className="ts-step-btn" onClick={() => setCiStrings(s => s.length > 2 ? s.slice(0, -1) : s)}>−</button>
                    <span className="ts-step-val">{ciStrings.length}</span>
                    <button className="ts-step-btn" onClick={() => setCiStrings(s => s.length < 8 ? [...s, { label: '?', pitch: 'C3' }] : s)}>+</button>
                  </div>
                </div>
              </div>
              <div className="ts-inst-strings">
                {ciStrings.map((s, i) => (
                  <div key={i} className="ts-inst-string-row">
                    <span className="ts-inst-string-num">{i + 1}</span>
                    <input
                      className="ts-input ts-inst-string-label" maxLength={3}
                      value={s.label} placeholder="G"
                      onChange={e => setCiStrings(list => list.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                    />
                    <input
                      className={`ts-input ts-inst-string-pitch${PITCH_RE.test(s.pitch) ? '' : ' invalid'}`} maxLength={3}
                      value={s.pitch} placeholder="G4"
                      onChange={e => setCiStrings(list => list.map((x, j) => j === i
                        ? { ...x, pitch: e.target.value.replace(/^[a-g]/, ch => ch.toUpperCase()) }
                        : x))}
                    />
                  </div>
                ))}
              </div>
              <div className="ts-inst-editor-btns">
                <button
                  className="cc-btn-solid"
                  disabled={!ciName.trim() || ciStrings.some(s => !s.label.trim() || !PITCH_RE.test(s.pitch))}
                  onClick={() => {
                    const def = {
                      id:     'custom_' + Date.now(),
                      label:  ciName.trim(),
                      rows:   ciStrings.map(s => s.label.trim()),
                      tuning: ciStrings.map(s => s.pitch),
                    }
                    registerCustom(def)
                    setInst(def.id)
                    setInstEditorOpen(false)
                    setDirty(true)
                  }}
                >Save Instrument</button>
                <button className="cc-btn-ghost" onClick={() => setInstEditorOpen(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Fret grid */}
          <div className="ts-grid-wrap">
            <table className="ts-grid-table">
              <tbody>
                {/* Beat header row */}
                <tr className="ts-beat-hdr">
                  <td></td>
                  {Array.from({ length: d.cellsPerBar * bars }, (_, c) => {
                    const inBar   = c % d.cellsPerBar
                    const isBeat  = inBar % d.cellsPerBeat === 0
                    const isBar   = c > 0 && inBar === 0
                    const isBeatB = c > 0 && isBeat && !isBar
                    const beatNum = Math.floor(inBar / d.cellsPerBeat) + 1
                    return (
                      <Fragment key={c}>
                        {isBar   && <td className="ts-bar-sep-hdr"></td>}
                        {isBeatB && <td className="ts-beat-sep-hdr"></td>}
                        <td>{isBeat ? beatNum : ''}</td>
                      </Fragment>
                    )
                  })}
                </tr>

                {/* String rows */}
                {rows.map((s, r) => (
                  <tr key={r} className="ts-string-row">
                    <td className="ts-string-label">{s}</td>
                    {Array.from({ length: d.cellsPerBar * bars }, (_, c) => {
                      const inBar   = c % d.cellsPerBar
                      const isBar   = c > 0 && inBar === 0
                      const isBeatB = c > 0 && inBar % d.cellsPerBeat === 0 && !isBar
                      const v = frets[r]?.[c] ?? ''
                      return (
                        <Fragment key={c}>
                          {isBar   && <td className="ts-bar-sep"></td>}
                          {isBeatB && <td className="ts-beat-sep"></td>}
                          <td className="ts-cell">
                            <input
                              data-r={r} data-c={c}
                              className={`ts-cell-input${v !== '' ? ' filled' : ''}`}
                              maxLength={2}
                              inputMode="numeric"
                              value={v}
                              onChange={e => handleCellChange(r, c, e.target.value)}
                              onKeyDown={e => handleCellKey(e, r, c)}
                            />
                          </td>
                        </Fragment>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="ts-hint">Click a cell, type a fret (0–24). Heavy line = bar, light = beat. Arrow keys navigate.</p>

          {/* Library name field */}
          <div className="ts-name-row">
            <span className="ts-ctrl-label">Library name</span>
            <input
              className="ts-input ts-name-input"
              value={libName}
              onChange={e => setLibName(e.target.value)}
              placeholder="e.g. Bloody Knuckles — Intro Riff"
            />
          </div>
        </div>

        {/* ── Playback card ── */}
        <div className="ts-card">
          <div className="ts-card-label">Playback</div>
          <div className="ts-player-bar">
            <button className="cc-btn-solid" disabled={!playerReady} onClick={() => atApiRef.current?.playPause()}>▶ Play / Pause</button>
            <button className="cc-btn-ghost" disabled={!playerReady} onClick={() => atApiRef.current?.stop()}>■ Stop</button>
            <span className="ts-status">{playerStatus}</span>
          </div>
          <div ref={viewportRef} className="ts-viewport" />
        </div>

        {/* ── Export card ── */}
        <div className="ts-card">
          <div className="ts-card-label">Export</div>
          <div className="ts-export-btns">
            <button className="cc-btn-solid" onClick={handleExport}>⬇ Export .tab.json</button>
            <button className="cc-btn-ghost" onClick={() => fileInputRef.current?.click()}>⬆ Import .tab.json</button>
            <button className="cc-btn-ghost" onClick={e => handleCopy(buildTex(instDef,sig,gridDiv,bars,frets,title,tempo), e.currentTarget)}>Copy alphaTex</button>
            <button className="cc-btn-ghost" onClick={e => handleCopy(buildAscii(instDef,sig,gridDiv,bars,frets), e.currentTarget)}>Copy ASCII tab</button>
          </div>
          <p className="ts-export-note">
            <strong>The contract.</strong> Export writes a <strong>.tab.json</strong> carrying three things: the re-editable <strong>grid</strong>, the <strong>alphaTex</strong> for notation + playback, and a Chart-Studio-ready <strong>ASCII</strong> block. Paste ASCII into a chord chart tab field today — when Chart Studio learns to render alphaTab, it will use the same file with no re-export needed.
          </p>
        </div>

      </div>
    </div>
  )
}
