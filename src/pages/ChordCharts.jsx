import { useState, useEffect, useRef, useCallback } from 'react'
import { parseSong, layout, fitTitles, rescale, shiftKey } from '../lib/chartEngine'
import { fetchSongs, fetchSong, saveSong, deleteSong, timeAgo } from '../lib/songs'
import { useAuth } from '../context/AuthContext'

const VARIANTS = [
  ['full',   'Full Chart'],  ['chords', 'Chords'],
  ['lyrics', 'Lyrics'],
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
  const [currentId,    setCurrentId]    = useState(null)
  const [dirty,        setDirty]        = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saveMsg,      setSaveMsg]      = useState(null)
  const [loadingList,  setLoadingList]  = useState(true)
  const [libDropOpen,  setLibDropOpen]  = useState(false)
  const [scanning,     setScanning]     = useState(false)

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


  /* ── Render engine (runs every render, debounced 160 ms) ── */
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!measureRef.current || !stageRef.current) return
      await document.fonts.ready

      const fullMeta = { ...meta }
      const song     = parseSong(songText || '', fullMeta)
      const opts     = { compact, collapse, writeBars: meta.writeBars }

      document.documentElement.style.setProperty('--bscale', (meta.scale || 100) / 100)

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

  /* ── Auto-fit ── */
  function handleAutoFit() {
    if (!measureRef.current) return
    const fullMeta = { ...meta }
    const song     = parseSong(songText || '', fullMeta)
    const opts     = { compact, collapse, writeBars: meta.writeBars }

    const pagesAt = p => {
      document.documentElement.style.setProperty('--bscale', p / 100)
      return layout(song, variant, opts, measureRef.current).N
    }
    const LO = 70, HI = 160
    const minN = pagesAt(LO)
    let lo = LO, hi = HI
    for (let it = 0; it < 18; it++) {
      const mid = (lo + hi) / 2
      if (pagesAt(mid) <= minN) lo = mid; else hi = mid
    }
    updateMeta('scale', Math.max(LO, Math.floor((lo - 1) / 2) * 2))
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
    const opts     = { compact, collapse, writeBars: meta.writeBars }

    document.documentElement.style.setProperty('--bscale', (meta.scale || 100) / 100)

    let html = ''
    for (const [k] of VARIANTS) html += layout(song, k, opts, measureRef.current).html

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
      meta: { ...meta },
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
      try { const d = JSON.parse(r.result); applyLoaded(d.meta || {}, d.source || '') }
      catch (e) { alert('Could not read that file.') }
    }
    r.readAsText(file)
  }

  /* ── Scan a photo/PDF of a chart and transcribe it into this app's chart format ── */
  function handleScanFile(file) {
    const r = new FileReader()
    r.onload = async () => {
      const dataBase64 = String(r.result).split(',')[1] || ''
      setScanning(true); setSaveMsg(null)
      try {
        const res = await fetch('/.netlify/functions/scan-chart', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mediaType: file.type, dataBase64 }),
        })
        const result = await res.json()
        if (!result.ok) throw new Error(result.error || 'Transcription failed')
        applyLoaded(result.meta || {}, result.source || '', null)
        setSaveMsg('Transcribed — check chords/lyrics before saving')
        setTimeout(() => setSaveMsg(null), 4000)
      } catch (e) {
        console.error('Scan failed', e)
        alert('Could not transcribe that chart. Try a clearer photo, or a smaller file.')
      } finally {
        setScanning(false)
      }
    }
    r.onerror = () => alert('Could not read that file.')
    r.readAsDataURL(file)
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
    })
    setSongText(src)
    setCurrentId(id)
    setDirty(false)
  }

  /* ── New song ── */
  function handleNew() {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    setMeta(BLANK_META); setSongText('')
    setCurrentId(null); setDirty(false); setSaveMsg(null)
  }

  /* ── Save to Supabase ── */
  async function handleSave() {
    setSaving(true); setSaveMsg(null)
    try {
      const saved = await saveSong({
        id:        currentId,
        title:     meta.title || 'Untitled',
        song_text: songText,
        meta:      { ...meta },
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
        setCurrentId(null); setDirty(false)
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
                saveSong({ id: null, title: meta.title || 'Untitled', song_text: songText, meta: { ...meta } })
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
              onClick={() => scanInputRef.current?.click()}
              disabled={scanning}
              title="Scan a photo or PDF of a chart and transcribe it"
            >
              {scanning ? <span className="slv-spinner cc-scan-spinner" /> : '📷 Scan Chart'}
            </button>
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*,.pdf"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files?.[0]) {
                  if (dirty && !window.confirm('Discard unsaved changes?')) {
                    e.target.value = ''
                    return
                  }
                  handleScanFile(e.target.files[0])
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
          <label className="cc-field">
            <span>Tempo (BPM)</span>
            <input value={meta.tempo} onChange={e => updateMeta('tempo', e.target.value)} placeholder="120" />
          </label>
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

        {/* Text size */}
        <div className="cc-field">
          <span>Text size · {meta.scale}%</span>
          <div className="cc-size-row">
            <input
              type="range" min="70" max="160" step="2"
              value={meta.scale}
              onChange={e => updateMeta('scale', parseInt(e.target.value, 10))}
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
          <button className="cc-btn-ghost" onClick={() => scanInputRef.current?.click()} disabled={scanning}>
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
