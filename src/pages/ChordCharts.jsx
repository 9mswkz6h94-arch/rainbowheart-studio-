import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { parseSong, layout, fitTitles, rescale, shiftKey } from '../lib/chartEngine'
import { fetchSongs, fetchSong, saveSong, deleteSong, timeAgo } from '../lib/songs'
import { fetchGrooves } from '../lib/grooves'
import { fetchTabs } from '../lib/tabs'
import { useAuth } from '../context/AuthContext'
import TapMetronome from '../components/TapMetronome'

const VARIANTS = [
  ['full',    'Full Chart'], ['grooves', 'Grooves'],
  ['tabs',    'Tabs'],       ['lyrics',  'Lyrics'],
]

const BLANK_META = {
  title:       '',
  band:        'Brother Jon & The Rainbow Hearts',
  writer:      '',
  key:         '',
  meter:       '4/4',
  tempo:       '',
  note:        'quarter',
  accidentals: 'flat',
  capo:        '',
  layout:      'auto',
  transpose:   0,
  capoShapes:  true,
  structFull:  false,
  writeBars:   true,
  scale:       100,
  lyricsScale: 100,
  grooveMap:   {},
  tabMap:      {},
  sheetRepeats: false,
  draft:       false,
  duration:    '',
}


export default function ChordCharts() {
  /* ── Auth ── */
  const { user } = useAuth()
  const userName = user?.user_metadata?.full_name || user?.email || ''

  /* ── State ── */
  const [meta,     setMeta]     = useState(BLANK_META)
  const [songText, setSongText] = useState('')
  const [compact,  setCompact]  = useState(true)
  const [collapse, setCollapse] = useState(true)
  const [variant,      setVariant]      = useState('full')
  const [libraryOpen,  setLibraryOpen]  = useState(false)

  const [songs,        setSongs]        = useState([])
  const [grooveLib,    setGrooveLib]    = useState([])
  const [tabLib,       setTabLib]       = useState([])
  const [currentId,    setCurrentId]    = useState(null)
  const [dirty,        setDirty]        = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saveMsg,      setSaveMsg]      = useState(null)
  const [loadingList,  setLoadingList]  = useState(true)
  const [libDropOpen,  setLibDropOpen]  = useState(false)
  const [scanning,     setScanning]     = useState(false)
  const [scanFiles,    setScanFiles]    = useState([])
  const [pageSources,  setPageSources]  = useState([])
  const [pageMeta,     setPageMeta]     = useState(null)

  /* ── Resizable panel ── */
  const [panelW, setPanelW] = useState(380)

  function handleSplitterDown(e) {
    e.preventDefault()
    const startX = e.clientX
    const startW = panelW
    function onMove(ev) {
      setPanelW(Math.max(280, Math.min(700, startW + ev.clientX - startX)))
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  /* ── DOM refs ── */
  const measureRef   = useRef(null)
  const stageRef     = useRef(null)
  const debounceRef  = useRef(null)
  const fileInputRef = useRef(null)
  const scanInputRef = useRef(null)
  const scanAppendRef = useRef(false)
  const libBtnRef    = useRef(null)
  const [libMenuPos, setLibMenuPos] = useState({ left: 0, top: 0 })

  /* ── Derived transpose label ── */
  const trDisplay = (() => {
    const n   = meta.transpose || 0
    const acc = meta.accidentals || 'flat'
    const k   = shiftKey(meta.key, n, acc)
    return (n ? (n > 0 ? '+' : '') + n : '0') + (n && k ? ' ' + k : '')
  })()

  /* ── Song list ── */
  const refreshList = useCallback(async () => {
    try   { setSongs(await fetchSongs()) }
    catch (e) { console.error('Failed to load songs', e) }
    finally   { setLoadingList(false) }
  }, [])
  useEffect(() => { refreshList() }, [refreshList])

  /* ── Groove + tab libraries (for the Grooves / Tabs sheet variants) ── */
  useEffect(() => {
    fetchGrooves().then(g => setGrooveLib(g || [])).catch(e => console.error('Failed to load grooves', e))
    fetchTabs().then(t => setTabLib(t || [])).catch(e => console.error('Failed to load tabs', e))
  }, [])

  /* ── Unique structure sections (first occurrence of each distinct part) ── */
  const uniqueSections = useMemo(() => {
    try {
      const s = parseSong(songText || '', { meter: meta.meter, accidentals: meta.accidentals })
      return s.full.filter(x => !x.repeatOf).map(x => x.label)
    } catch { return [] }
  }, [songText, meta.meter, meta.accidentals])

  /* ── Per-variant text scale — Lyrics keeps its own size ── */
  const activeScale = variant === 'lyrics' ? (meta.lyricsScale || 100) : (meta.scale || 100)

  /* ── Resolve groove/tab attachments (section label → full object) ── */
  const buildSheetOpts = useCallback(() => {
    const grooveObjs = {}, tabObjs = {}
    for (const [label, id] of Object.entries(meta.grooveMap || {})) {
      const g = grooveLib.find(x => x.id === id)
      if (g) grooveObjs[label] = g
    }
    for (const [label, id] of Object.entries(meta.tabMap || {})) {
      const t = tabLib.find(x => x.id === id)
      if (t) tabObjs[label] = t
    }
    return { grooveObjs, tabObjs, sheetRepeats: !!meta.sheetRepeats }
  }, [meta.grooveMap, meta.tabMap, meta.sheetRepeats, grooveLib, tabLib])

  function assignSheet(kind, label, id) {
    const key = kind === 'groove' ? 'grooveMap' : 'tabMap'
    setMeta(m => {
      const map = { ...(m[key] || {}) }
      if (id) map[label] = id; else delete map[label]
      return { ...m, [key]: map }
    })
    setDirty(true)
  }

  /* ── Render engine (runs every render, debounced 160 ms) ── */
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!measureRef.current || !stageRef.current) return
      await document.fonts.ready

      const fullMeta = { ...meta }
      const song     = parseSong(songText || '', fullMeta)
      const opts     = { compact, collapse, writeBars: meta.writeBars, scale: activeScale, ...buildSheetOpts() }

      document.documentElement.style.setProperty('--bscale', activeScale / 100)

      const { html, N, cols } = layout(song, variant, opts, measureRef.current)

      stageRef.current.className = 'stagewrap' + (compact ? ' compact' : '')
      stageRef.current.innerHTML =
        `<div class="pagecount">${N} page${N > 1 ? 's' : ''} · ${cols === 1 ? 'single' : 'two'}-column</div>`
        + html

      fitTitles(stageRef.current)
      rescale(stageRef.current)
    }, 160)
    return () => clearTimeout(debounceRef.current)
  })

  /* ── Window resize ── */
  useEffect(() => {
    const handler = () => { if (stageRef.current) rescale(stageRef.current) }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  /* ── Persist panel width to localStorage ── */
  useEffect(() => {
    const saved = localStorage.getItem('rainbowheart_panelWidth')
    if (saved) {
      const w = parseInt(saved, 10)
      if (w >= 280 && w <= 700) setPanelW(w)
    }
  }, [])
  useEffect(() => {
    localStorage.setItem('rainbowheart_panelWidth', String(panelW))
  }, [panelW])

  /* ── Update browser tab title ── */
  useEffect(() => {
    const title = meta.title?.trim() || 'Untitled'
    const suffix = dirty ? ' ●' : ''
    document.title = title + suffix + ' — Rainbow Hearts Chart Studio'
  }, [meta.title, dirty])

  /* ── Keyboard shortcut: Ctrl+S / Cmd+S for save ── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  /* ── Meta helpers ── */
  function updateMeta(key, value) {
    setMeta(m => ({ ...m, [key]: value }))
    setDirty(true)
  }
  function setTranspose(n) {
    updateMeta('transpose', Math.max(-11, Math.min(11, n)))
  }

  /* ── Auto-fit — sizes the scale field belonging to the active variant ── */
  function handleAutoFit() {
    if (!measureRef.current) return
    const fullMeta = { ...meta }
    const song     = parseSong(songText || '', fullMeta)
    const baseOpts = { compact, collapse, writeBars: meta.writeBars, ...buildSheetOpts() }

    const pagesAt = p => layout(song, variant, { ...baseOpts, scale: p }, measureRef.current).N
    const LO = 70, HI = 160
    const minN = pagesAt(LO)
    let lo = LO, hi = HI
    for (let it = 0; it < 18; it++) {
      const mid = (lo + hi) / 2
      if (pagesAt(mid) <= minN) lo = mid; else hi = mid
    }
    updateMeta(variant === 'lyrics' ? 'lyricsScale' : 'scale', Math.max(LO, Math.floor((lo - 1) / 2) * 2))
  }

  /* ── Print current variant ── */
  function handlePrint() {
    const lbl  = (VARIANTS.find(v => v[0] === variant) || [null, 'Chart'])[1]
    const prev = document.title
    document.title = (meta.title || 'Chart').trim() + ' - ' + lbl
    window.addEventListener('afterprint', function done() {
      window.removeEventListener('afterprint', done)
      document.title = prev
    }, { once: true })
    window.print()
  }

  /* ── Print all 4 variants ── */
  async function handlePrintAll() {
    if (!measureRef.current || !stageRef.current) return
    await document.fonts.ready

    const fullMeta = { ...meta }
    const song     = parseSong(songText || '', fullMeta)
    const baseOpts = { compact, collapse, writeBars: meta.writeBars, ...buildSheetOpts() }

    let html = ''
    for (const [k] of VARIANTS) {
      const scale = k === 'lyrics' ? (meta.lyricsScale || 100) : (meta.scale || 100)
      html += layout(song, k, { ...baseOpts, scale }, measureRef.current).html
    }

    stageRef.current.className = 'stagewrap' + (compact ? ' compact' : '')
    stageRef.current.innerHTML = html
    fitTitles(stageRef.current)
    rescale(stageRef.current)

    const prev = document.title
    document.title = (meta.title || 'Chart').trim() + ' - All Charts'
    window.addEventListener('afterprint', function done() {
      window.removeEventListener('afterprint', done)
      document.title = prev
      setVariant(v => { setTimeout(() => setVariant(v), 0); return v }) // nudge re-render
    }, { once: true })
    setTimeout(() => window.print(), 60)
  }

  /* ── Save .song file ── */
  function handleSaveFile() {
    const data = {
      app: 'Rainbow Hearts Chart Studio',
      savedAt: new Date().toISOString(),
      meta: { ...meta, collapse, compact },
      source: songText,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const safe = s => String(s || '').replace(/[^a-z0-9]+/ig, '-').replace(/^-+|-+$/g, '')
    a.download = [safe(meta.title || 'song'), meta.key && ('Key-' + safe(meta.key))].filter(Boolean).join('__') + '.song'
    a.click()
  }

  /* ── Load .song file ── */
  function handleLoadFile(file) {
    const r = new FileReader()
    r.onload = () => {
      try { const d = JSON.parse(r.result); applyLoaded(d.meta || {}, d.source || ''); setScanFiles([]); setPageSources([]); setPageMeta(null) }
      catch (e) { alert('Could not read that file.') }
    }
    r.readAsText(file)
  }

  /* ── Scan photo(s)/PDF of a chart and transcribe into this app's chart format ──
     Each file is transcribed in its own request (one image per Claude call) and
     merged client-side — sending multiple images in a single request was slow
     enough to hit Netlify's function time limit and unreliable at picking out
     which page was which. */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result).split(',')[1] || '')
      r.onerror = () => reject(new Error('Could not read ' + file.name))
      r.readAsDataURL(file)
    })
  }

  async function transcribeOne(file) {
    const dataBase64 = await fileToBase64(file)
    const res = await fetch('/.netlify/functions/scan-chart', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ files: [{ mediaType: file.type, dataBase64 }] }),
    })
    const result = await res.json()
    if (!result.ok) throw new Error(result.error || 'Transcription failed')
    return result
  }

  async function handleScanFiles(newFiles, append) {
    if (newFiles.some(f => f.type === 'application/pdf') && (newFiles.length > 1 || (append && scanFiles.length > 0))) {
      alert('Please scan a PDF by itself, not combined with photos.')
      return
    }
    setScanning(true); setSaveMsg(null)
    try {
      const newResults = await Promise.all(newFiles.map(transcribeOne))
      const allSources = append ? [...pageSources, ...newResults.map(r => r.source || '')] : newResults.map(r => r.source || '')
      const firstMeta = append ? (pageMeta || newResults[0].meta) : newResults[0].meta
      const combinedFiles = append ? [...scanFiles, ...newFiles] : newFiles

      applyLoaded(firstMeta || {}, allSources.join('\n\n'), null)
      setScanFiles(combinedFiles)
      setPageSources(allSources)
      if (!append) setPageMeta(newResults[0].meta)

      const n = combinedFiles.length
      setSaveMsg(n > 1
        ? `Transcribed ${n} pages — check chords/lyrics and the seam between pages before saving`
        : 'Transcribed — check chords/lyrics before saving')
      setTimeout(() => setSaveMsg(null), 5000)
    } catch (e) {
      console.error('Scan failed', e)
      alert('Could not transcribe that chart. Try a clearer photo, or a smaller file.')
    } finally {
      setScanning(false)
    }
  }

  /* ── Apply loaded data (from file or Supabase) ── */
  function applyLoaded(m, src, id = null) {
    setMeta({
      title:       m.title       || '',
      band:        m.band        || BLANK_META.band,
      writer:      m.writer      || '',
      key:         m.key         || '',
      meter:       m.meter       || '4/4',
      tempo:       m.tempo       || '',
      note:        m.note        || 'quarter',
      accidentals: m.accidentals || 'flat',
      capo:        m.capo        || '',
      layout:      m.layout      || 'auto',
      transpose:   parseInt(m.transpose, 10) || 0,
      capoShapes:  m.capoShapes !== false,
      structFull:  !!m.structFull,
      writeBars:   m.writeBars !== false,
      scale:       m.scale || 100,
      lyricsScale: m.lyricsScale || m.scale || 100,
      grooveMap:   m.grooveMap || {},
      tabMap:      m.tabMap || {},
      sheetRepeats: !!m.sheetRepeats,
      draft:       !!m.draft,
      duration:    m.duration || '',
    })
    setCompact(m.compact !== false)     // restore builder toggles (default on for older songs)
    setCollapse(m.collapse !== false)
    setSongText(src)
    setCurrentId(id)
    setDirty(false)
  }

  /* ── New song ── */
  function handleNew() {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    setMeta(BLANK_META); setSongText('')
    setCompact(true); setCollapse(true)
    setCurrentId(null); setDirty(false); setSaveMsg(null)
    setScanFiles([]); setPageSources([]); setPageMeta(null)
  }

  /* ── Save to Supabase ── */
  async function handleSave() {
    setSaving(true); setSaveMsg(null)
    try {
      const saved = await saveSong({
        id:        currentId,
        title:     meta.title || 'Untitled',
        song_text: songText,
        meta:      { ...meta, collapse, compact },
      })
      setCurrentId(saved.id); setDirty(false); setSaveMsg('Saved!')
      await refreshList()
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (e) {
      setSaveMsg('Error saving'); console.error(e)
    } finally {
      setSaving(false)
    }
  }

  /* ── Load from Supabase ── */
  async function handleLoad(id) {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    try {
      const song = await fetchSong(id)
      applyLoaded(song.meta || {}, song.song_text || '', song.id)
      setScanFiles([]); setPageSources([]); setPageMeta(null)
    } catch (e) { console.error('Failed to load song', e) }
  }

  /* ── Delete from Supabase ── */
  async function handleDelete(id, title, e) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${title}"?`)) return
    try {
      await deleteSong(id)
      if (currentId === id) {
        setMeta(BLANK_META); setSongText('')
        setCurrentId(null); setDirty(false); setScanFiles([]); setPageSources([]); setPageMeta(null)
      }
      await refreshList()
    } catch (e) { console.error('Failed to delete', e) }
  }

  /* ── Render ── */
  return (
    <div className="cc-page" style={{ gridTemplateColumns: `${panelW}px 6px 1fr` }}>

      {/* Hidden off-screen measure div — used by layout engine for height measurements */}
      <div
        ref={measureRef}
        style={{ position: 'fixed', left: '-99999px', top: 0, overflow: 'visible', pointerEvents: 'none' }}
        aria-hidden="true"
      />

      {/* ── Input panel ── */}
      <div className="cc-input">

        {/* ── Sticky toolbar: title + save + library ── */}
        <div className="cc-input-header">
          <div className="cc-header-row">
            <h2>🎸 Chart Studio</h2>
            <div className="cc-print-btns">
              <button className="cc-btn-ghost" onClick={handlePrint}>Print</button>
              <button className="cc-btn-ghost" onClick={handlePrintAll}>Print All 4</button>
            </div>
          </div>

          <div className="cc-savebar">
            <button className="cc-btn-solid cc-btn-save" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : currentId ? 'Save Changes' : 'Save Song'}
            </button>
            {currentId && (
              <button className="cc-btn-ghost" onClick={() => {
                setSaving(true); setSaveMsg(null)
                saveSong({ id: null, title: meta.title || 'Untitled', song_text: songText, meta: { ...meta, collapse, compact } })
                  .then(saved => { setCurrentId(saved.id); setDirty(false); setSaveMsg('Saved as new!'); refreshList(); setTimeout(() => setSaveMsg(null), 2000) })
                  .catch(e => { setSaveMsg('Error saving'); console.error(e) })
                  .finally(() => setSaving(false))
              }} disabled={saving} title="Create a brand-new song — does not overwrite the current one">
                Save As New Song
              </button>
            )}
            <button className="cc-btn-ghost" onClick={handleNew}>+ New</button>
            <button className="cc-btn-ghost" onClick={handleSaveFile} title="Download as .song file">
              ⬇ Export .song
            </button>
            <button className="cc-btn-ghost" onClick={() => fileInputRef.current?.click()} title="Load .song file">
              ⬆ Import .song
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".song,application/json"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files?.[0]) {
                  if (dirty && !window.confirm('Discard unsaved changes?')) {
                    e.target.value = ''
                    return
                  }
                  handleLoadFile(e.target.files[0])
                  e.target.value = ''
                }
              }}
            />
            <button
              className="cc-btn-ghost"
              onClick={() => { scanAppendRef.current = false; scanInputRef.current?.click() }}
              disabled={scanning}
              title="Scan photo(s) or a PDF of a chart and transcribe it"
            >
              {scanning ? <span className="slv-spinner cc-scan-spinner" /> : '📷 Scan Chart'}
            </button>
            {scanFiles.length > 0 && (
              <button
                className="cc-btn-ghost"
                onClick={() => { scanAppendRef.current = true; scanInputRef.current?.click() }}
                disabled={scanning}
                title="Add another photo of this same song — re-transcribes all pages together, so any manual edits since the last scan will be overwritten"
              >
                + Add Page
              </button>
            )}
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              style={{ display: 'none' }}
              onChange={e => {
                const files = Array.from(e.target.files || [])
                if (files.length) {
                  if (dirty && !window.confirm('Discard unsaved changes?')) {
                    e.target.value = ''
                    return
                  }
                  handleScanFiles(files, scanAppendRef.current)
                  e.target.value = ''
                }
              }}
            />
            <div className="cc-library-dropdown">
              <button
                ref={libBtnRef}
                className="cc-library-btn"
                onClick={() => {
                  if (!libDropOpen && libBtnRef.current) {
                    const rect = libBtnRef.current.getBoundingClientRect()
                    setLibMenuPos({ left: rect.left, top: rect.bottom + 4 })
                  }
                  setLibDropOpen(o => !o)
                }}
              >
                Library {songs.length > 0 && `(${songs.length})`}
              </button>
              {libDropOpen && (
                <div className="cc-library-menu" style={{ left: libMenuPos.left, top: libMenuPos.top }}>
                  {loadingList ? (
                    <div className="cc-lib-item disabled">Loading…</div>
                  ) : songs.length === 0 ? (
                    <div className="cc-lib-item disabled">No saved songs</div>
                  ) : (
                    [...songs]
                      .sort((a, b) => {
                        const ad = a.meta?.draft ? 1 : 0
                        const bd = b.meta?.draft ? 1 : 0
                        if (ad !== bd) return ad - bd
                        return (a.title || '').localeCompare(b.title || '')
                      })
                      .map(s => (
                      <div
                        key={s.id}
                        className={`cc-lib-item${currentId === s.id ? ' active' : ''}${s.meta?.draft ? ' draft' : ''}`}
                        onClick={() => {
                          handleLoad(s.id)
                          setLibDropOpen(false)
                        }}
                      >
                        <span className="cc-lib-title">{s.meta?.draft ? '✏ ' : ''}{s.title || 'Untitled'}</span>
                        <button
                          className="cc-lib-delete"
                          onClick={e => {
                            e.stopPropagation()
                            handleDelete(s.id, s.title || 'Untitled', { stopPropagation: () => {} })
                          }}
                          title="Delete song"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {currentId && !saveMsg && !dirty && (
              <span className="cc-editing-badge">Editing: {meta.title || 'Untitled'}</span>
            )}
            {saveMsg && <span className="cc-save-msg">{saveMsg}</span>}
            {dirty    && !saveMsg && <span className="cc-unsaved">● unsaved</span>}
          </div>
        </div>

        {/* Metadata */}
        <div className="cc-meta">
          <label className="cc-field span2">
            <span>Title</span>
            <input value={meta.title} onChange={e => updateMeta('title', e.target.value)} placeholder="Song title" />
          </label>
          <label className="cc-field span2">
            <span>Band</span>
            <input value={meta.band} onChange={e => updateMeta('band', e.target.value)} />
          </label>
          <label className="cc-field span2">
            <span>Writer</span>
            <input value={meta.writer} onChange={e => updateMeta('writer', e.target.value)} placeholder="Jonathan Owens" />
          </label>
          <label className="cc-field">
            <span>Key</span>
            <input value={meta.key} onChange={e => updateMeta('key', e.target.value)} placeholder="G" />
          </label>
          <label className="cc-field">
            <span>Meter</span>
            <input value={meta.meter} onChange={e => updateMeta('meter', e.target.value)} placeholder="4/4" />
          </label>
          <label className="cc-field">
            <span>Capo</span>
            <input value={meta.capo} onChange={e => updateMeta('capo', e.target.value)} placeholder="(optional)" />
          </label>
          <div className="cc-field">
            <span>Tempo (BPM)</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <input
                style={{ flex: 1 }}
                value={meta.tempo}
                onChange={e => updateMeta('tempo', e.target.value)}
                placeholder="120"
              />
              <TapMetronome
                onTempoChange={v => updateMeta('tempo', v)}
                currentTempo={meta.tempo}
              />
            </div>
          </div>
          <label className="cc-field">
            <span>Duration (min)</span>
            <input type="number" min="0.25" max="20" step="0.25" value={meta.duration || ''} onChange={e => updateMeta('duration', e.target.value ? parseFloat(e.target.value) : '')} placeholder="3.5" title="Minutes · 0.25 = 15 sec, 0.5 = 30 sec" />
          </label>
          <label className="cc-field">
            <span>Beat unit</span>
            <select value={meta.note} onChange={e => updateMeta('note', e.target.value)}>
              <option value="quarter">Quarter ♩</option>
              <option value="half">Half 𝅗𝅥 (cut)</option>
            </select>
          </label>
          <div className="cc-field">
            <span>Transpose</span>
            <div className="cc-stepper">
              <button className="cc-step-btn" onClick={() => setTranspose((meta.transpose || 0) - 1)}>−</button>
              <span className="cc-step-val">{trDisplay}</span>
              <button className="cc-step-btn" onClick={() => setTranspose((meta.transpose || 0) + 1)}>+</button>
            </div>
          </div>
          <label className="cc-field">
            <span>Accidentals</span>
            <select value={meta.accidentals} onChange={e => updateMeta('accidentals', e.target.value)}>
              <option value="flat">Flats (B♭)</option>
              <option value="sharp">Sharps (A♯)</option>
            </select>
          </label>
          <label className="cc-field">
            <span>Columns</span>
            <select value={meta.layout} onChange={e => updateMeta('layout', e.target.value)}>
              <option value="auto">Auto</option>
              <option value="single">Single</option>
              <option value="double">Two</option>
            </select>
          </label>
        </div>

        {/* Variant tabs */}
        <div className="cc-variants">
          {VARIANTS.map(([v, label]) => (
            <button
              key={v}
              className={`cc-variant-btn${variant === v ? ' active' : ''}`}
              onClick={() => setVariant(v)}
            >{label}</button>
          ))}
        </div>

        {/* Groove / tab attachments — one per structure section */}
        {(variant === 'grooves' || variant === 'tabs') && (() => {
          const isGroove = variant === 'grooves'
          const map = (isGroove ? meta.grooveMap : meta.tabMap) || {}
          const lib = isGroove ? grooveLib : tabLib
          return (
            <div className="cc-sheet-assign">
              <div className="cc-sheet-assign-head">
                <span>{isGroove ? 'Groove' : 'Tab'} for each section</span>
                <label className="cc-sheet-repeats" title="On: repeated sections print again in structure order (longer sheet). Off: repeats collapse to a 'Repeat …' line (fits one page).">
                  <input
                    type="checkbox"
                    checked={!!meta.sheetRepeats}
                    onChange={e => updateMeta('sheetRepeats', e.target.checked)}
                  />
                  Show repeats
                </label>
              </div>
              {uniqueSections.length === 0 ? (
                <p className="cc-sheet-empty">
                  Add sections to the song (<code>#v</code> <code>#c</code> <code>#inst</code>…) and they'll show up here to assign.
                </p>
              ) : uniqueSections.map(label => (
                <label key={label} className="cc-sheet-row">
                  <span className="cc-sheet-label">{label}</span>
                  <select
                    value={map[label] || ''}
                    onChange={e => assignSheet(isGroove ? 'groove' : 'tab', label, e.target.value)}
                  >
                    <option value="">— none —</option>
                    {lib.map(item => (
                      <option key={item.id} value={item.id}>{item.title || 'Untitled'}</option>
                    ))}
                  </select>
                </label>
              ))}
              <p className="cc-sheet-empty">
                {isGroove
                  ? <>Build new grooves in the <Link to="/studio/groove-builder">Groove Builder</Link> — saved grooves appear here.</>
                  : <>Build new tabs in <Link to="/studio/tab-studio">Tab Studio</Link> — saved tabs appear here.</>}
              </p>
            </div>
          )
        })()}

        {/* Song source */}
        <label className="cc-field cc-field-full">
          <span>Song — chords + lyrics</span>
          <textarea
            className="cc-textarea"
            value={songText}
            onChange={e => { setSongText(e.target.value); setDirty(true) }}
            spellCheck={false}
          />
        </label>

        {/* Options checkboxes */}
        <div className="cc-checks">
          <label><input type="checkbox" checked={compact}     onChange={e => setCompact(e.target.checked)} /> Compact</label>
          <label><input type="checkbox" checked={collapse}    onChange={e => setCollapse(e.target.checked)} /> Collapse repeats</label>
          <label><input type="checkbox" checked={meta.writeBars}  onChange={e => updateMeta('writeBars',  e.target.checked)} /> Write-in bars</label>
          <label><input type="checkbox" checked={meta.structFull} onChange={e => updateMeta('structFull', e.target.checked)} /> Spell out structure</label>
          <label><input type="checkbox" checked={meta.capoShapes} onChange={e => updateMeta('capoShapes', e.target.checked)} /> Capo changes chords</label>
          <label className={meta.draft ? 'cc-draft-label' : ''}><input type="checkbox" checked={!!meta.draft} onChange={e => updateMeta('draft', e.target.checked)} /> Draft — work in progress</label>
        </div>

        {/* Text size — Lyrics variant keeps its own size, independent of the chart */}
        <div className="cc-field">
          <span>{variant === 'lyrics' ? 'Lyrics text size' : 'Text size'} · {activeScale}%</span>
          <div className="cc-size-row">
            <input
              type="range" min="70" max="160" step="2"
              value={activeScale}
              onChange={e => updateMeta(variant === 'lyrics' ? 'lyricsScale' : 'scale', parseInt(e.target.value, 10))}
            />
            <button className="cc-btn-ghost" onClick={handleAutoFit}>Auto-fit</button>
          </div>
        </div>

        {/* File actions */}
        <div className="cc-file-row">
          <button className="cc-btn-ghost" onClick={handleSaveFile}>Save .song</button>
          <button className="cc-btn-ghost" onClick={() => fileInputRef.current?.click()}>Load .song</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.song,application/json"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) handleLoadFile(e.target.files[0]) }}
          />
          <button className="cc-btn-ghost" onClick={() => { scanAppendRef.current = false; scanInputRef.current?.click() }} disabled={scanning}>
            {scanning ? 'Scanning…' : '📷 Scan Chart'}
          </button>
        </div>

        {/* Syntax hint */}
        <p className="cc-hint">
          <b>Syntax:</b> <code>#v</code> verse · <code>#c</code> chorus · <code>#b</code> bridge ·
          chord lines above lyrics · <code>_</code> marks chord placement ·
          <code>%</code> = repeat bar · <code>F. G...</code> = beat dots ·
          start lyric with <code>*</code> to bold
        </p>

      </div>

      {/* ── Drag splitter ── */}
      <div className="cc-splitter" onMouseDown={handleSplitterDown} title="Drag to resize" />

      {/* ── Preview ── */}
      <div className="cc-preview">
        <div ref={stageRef} className="stagewrap" />
      </div>

    </div>
  )
}
