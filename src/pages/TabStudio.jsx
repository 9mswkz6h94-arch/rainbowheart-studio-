import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { fetchTabs, fetchTab, saveTab, deleteTab } from '../lib/tabs'

/* ── Static data ── */
const ROWS   = { bass: ['G','D','A','E'], guitar: ['e','B','G','D','A','E'] }
const TUNING = { bass: 'E1 A1 D2 G2', guitar: 'E2 A2 D3 G3 B3 E4' }
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

function makeGrid(inst, cellsPerBar, bars) {
  const cols = cellsPerBar * bars
  return Array.from({ length: ROWS[inst].length }, () => Array(cols).fill(''))
}

function resizeGrid(old, inst, cellsPerBar, bars) {
  const cols = cellsPerBar * bars
  return Array.from({ length: ROWS[inst].length }, (_, r) =>
    Array.from({ length: cols }, (_, c) => old[r]?.[c] ?? '')
  )
}

function seedGrid() {
  const d = calcDims('4/4', 16)
  const g = makeGrid('bass', d.cellsPerBar, 2)
  const E = ROWS.bass.length - 1
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

function buildTex(inst, sig, gridDiv, bars, frets, title, tempo) {
  const d    = calcDims(sig, gridDiv)
  const rows = ROWS[inst]
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
  return (
    `\\title "${T}"\n\\subtitle "Brother Jon & The Rainbow Hearts"\n\\tempo ${tempo}\n.\n` +
    `\\track "${inst === 'bass' ? 'Bass' : 'Guitar'}" \\staff{tabs} \\tuning ${TUNING[inst]}\n` +
    `\\ts ${d.num} ${d.den}\n` + out.join(' |\n') + ' |'
  )
}

function buildAscii(inst, sig, gridDiv, bars, frets) {
  const d    = calcDims(sig, gridDiv)
  const rows = ROWS[inst]
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
  const rows = ROWS[inst]

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
  useEffect(() => { setFrets(prev => resizeGrid(prev, inst, d.cellsPerBar, bars)) }, [inst, sig, gridDiv, bars])

  /* ── Debounced alphaTex render ── */
  useEffect(() => {
    clearTimeout(renderTimerRef.current)
    renderTimerRef.current = setTimeout(() => {
      if (!atApiRef.current) return
      try {
        atApiRef.current.tex(buildTex(inst, sig, gridDiv, bars, frets, title, tempo))
        setPlayerStatus(p => playerReady ? 'updated.' : p)
      } catch (e) { setPlayerStatus('alphaTex error: ' + e.message) }
    }, 300)
    return () => clearTimeout(renderTimerRef.current)
  }, [inst, sig, gridDiv, bars, frets, title, tempo, playerReady])

  /* ── Close library dropdown on outside click ── */
  useEffect(() => {
    if (!libDropOpen) return
    const handler = e => { if (!libBtnRef.current?.contains(e.target)) setLibDropOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [libDropOpen])

  /* ── Payload helpers ── */
  function buildPayload() {
    return {
      format: 'rainbowhearts.tab', version: 1, id: curId || null,
      name: libName || title || 'Untitled tab',
      title, instrument: inst, tuning: TUNING[inst],
      timeSignature: sig, gridDivision: gridDiv, bars, tempo,
      grid:     frets.map(r => r.slice()),
      alphaTex: buildTex(inst, sig, gridDiv, bars, frets, title, tempo),
      ascii:    buildAscii(inst, sig, gridDiv, bars, frets),
      updated:  new Date().toISOString(),
    }
  }

  function applyPayload(p) {
    if (!p || p.format !== 'rainbowhearts.tab') { alert('Not a Tab Studio file.'); return }
    const ni=p.instrument||'bass', ns=p.timeSignature||'4/4', ng=p.gridDivision||16, nb=p.bars||2
    setInst(ni); setSig(ns); setGridDiv(ng); setBars(nb)
    setTitle(p.title||''); setTempo(p.tempo||120)
    setLibName(p.name||p.title||''); setCurId(null)
    const d2 = calcDims(ns, ng)
    const newFrets = makeGrid(ni, d2.cellsPerBar, nb)
    if (p.grid) p.grid.forEach((row,r) => row.forEach((f,c) => { if (newFrets[r] && c < newFrets[r].length) newFrets[r][c] = f||'' }))
    setFrets(newFrets); setDirty(false)
  }

  function applyFromRecord(record) {
    const p = record.tab_data || {}
    const ni=p.instrument||'bass', ns=p.timeSignature||'4/4', ng=p.gridDivision||16, nb=p.bars||2
    setInst(ni); setSig(ns); setGridDiv(ng); setBars(nb)
    setTitle(p.title||''); setTempo(p.tempo||120)
    setLibName(record.title||''); setCurId(record.id)
    const d2 = calcDims(ns, ng)
    const newFrets = makeGrid(ni, d2.cellsPerBar, nb)
    if (p.grid) p.grid.forEach((row,r) => row.forEach((f,c) => { if (newFrets[r] && c < newFrets[r].length) newFrets[r][c] = f||'' }))
    setFrets(newFrets); setDirty(false)
  }

  /* ── Library actions ── */
  async function handleSave() {
    setSaving(true); setSaveMsg(null)
    try {
      const tab_data = {
        format: 'rainbowhearts.tab', version: 1,
        title, instrument: inst, tuning: TUNING[inst],
        timeSignature: sig, gridDivision: gridDiv, bars, tempo,
        grid:     frets.map(r => r.slice()),
        alphaTex: buildTex(inst, sig, gridDiv, bars, frets, title, tempo),
        ascii:    buildAscii(inst, sig, gridDiv, bars, frets),
      }
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
    setFrets(makeGrid('bass', calcDims('4/4',16).cellsPerBar, 2))
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
              <div className="ts-seg">
                <button className={`ts-seg-btn${inst==='bass'?' on':''}`} onClick={() => { setInst('bass'); setDirty(true) }}>Bass · 4</button>
                <button className={`ts-seg-btn${inst==='guitar'?' on':''}`} onClick={() => { setInst('guitar'); setDirty(true) }}>Guitar · 6</button>
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
            <button className="cc-btn-ghost" onClick={e => handleCopy(buildTex(inst,sig,gridDiv,bars,frets,title,tempo), e.currentTarget)}>Copy alphaTex</button>
            <button className="cc-btn-ghost" onClick={e => handleCopy(buildAscii(inst,sig,gridDiv,bars,frets), e.currentTarget)}>Copy ASCII tab</button>
          </div>
          <p className="ts-export-note">
            <strong>The contract.</strong> Export writes a <strong>.tab.json</strong> carrying three things: the re-editable <strong>grid</strong>, the <strong>alphaTex</strong> for notation + playback, and a Chart-Studio-ready <strong>ASCII</strong> block. Paste ASCII into a chord chart tab field today — when Chart Studio learns to render alphaTab, it will use the same file with no re-export needed.
          </p>
        </div>

      </div>
    </div>
  )
}
