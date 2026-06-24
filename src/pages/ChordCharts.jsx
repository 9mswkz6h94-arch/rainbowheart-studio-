import { useState, useEffect, useRef, useCallback } from 'react'
import { parseSong, layout, fitTitles, rescale, shiftKey } from '../lib/chartEngine'
import { fetchSongs, fetchSong, saveSong, deleteSong, timeAgo } from '../lib/songs'
import { useAuth } from '../context/AuthContext'

const VARIANTS = [
  ['full',   'Full Chart'],
  ['bass',   'Bass + Tab'],
  ['chords', 'Chords'],
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
}

const BLANK_TABS = {
  bass:   { text: '', label: 'Bass Tab' },
  guitar: { text: '', label: 'Guitar Tab' },
  uke:    { text: '', label: 'Ukulele Tab' },
}

export default function ChordCharts() {
  /* ── Auth ── */
  const { user } = useAuth()
  const userName = user?.user_metadata?.full_name || user?.email || ''

  /* ── State ── */
  const [meta,     setMeta]     = useState(BLANK_META)
  const [songText, setSongText] = useState('')
  const [tabs,     setTabs]     = useState(BLANK_TABS)

  const [compact,  setCompact]  = useState(true)
  const [collapse, setCollapse] = useState(true)
  const [tabOnBass, setTabOnBass] = useState(true)
  const [tabOnFull, setTabOnFull] = useState(true)
  const [tabOnUke,  setTabOnUke]  = useState(true)

  const [variant, setVariant] = useState('full')

  const [songs,       setSongs]       = useState([])
  const [currentId,   setCurrentId]   = useState(null)
  const [dirty,       setDirty]       = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState(null)
  const [loadingList, setLoadingList] = useState(true)

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
  const measureRef  = useRef(null)
  const stageRef    = useRef(null)
  const debounceRef = useRef(null)
  const fileInputRef = useRef(null)

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

  /* ── Build tab array for engine ── */
  function buildTabArr(t) {
    const arr = []
    if (t.bass.text.trim())   arr.push({ label: t.bass.label   || 'Bass Tab',    target: 'bass', lines: t.bass.text.split('\n') })
    if (t.guitar.text.trim()) arr.push({ label: t.guitar.label || 'Guitar Tab',  target: 'full', lines: t.guitar.text.split('\n') })
    if (t.uke.text.trim())    arr.push({ label: t.uke.label    || 'Ukulele Tab', target: 'uke',  lines: t.uke.text.split('\n') })
    return arr
  }

  /* ── Render engine (runs every render, debounced 160 ms) ── */
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!measureRef.current || !stageRef.current) return
      await document.fonts.ready

      const fullMeta = { ...meta, tab: buildTabArr(tabs) }
      const song     = parseSong(songText || '', fullMeta)
      const opts     = { compact, collapse, tabOnBass, tabOnFull, tabOnUke, writeBars: meta.writeBars }

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

  /* ── Meta helpers ── */
  function updateMeta(key, value) {
    setMeta(m => ({ ...m, [key]: value }))
    setDirty(true)
  }
  function updateTab(which, key, value) {
    setTabs(t => ({ ...t, [which]: { ...t[which], [key]: value } }))
    setDirty(true)
  }
  function setTranspose(n) {
    updateMeta('transpose', Math.max(-11, Math.min(11, n)))
  }

  /* ── Auto-fit ── */
  function handleAutoFit() {
    if (!measureRef.current) return
    const fullMeta = { ...meta, tab: buildTabArr(tabs) }
    const song     = parseSong(songText || '', fullMeta)
    const opts     = { compact, collapse, tabOnBass, tabOnFull, tabOnUke, writeBars: meta.writeBars }

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

    const fullMeta = { ...meta, tab: buildTabArr(tabs) }
    const song     = parseSong(songText || '', fullMeta)
    const opts     = { compact, collapse, tabOnBass, tabOnFull, tabOnUke, writeBars: meta.writeBars }

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
      meta: { ...meta, tab: buildTabArr(tabs) },
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

  /* ── Apply loaded data (from file or Supabase) ── */
  function applyLoaded(m, src) {
    const tabArr = m.tab || []
    const bass   = tabArr.find(t => t.target === 'bass') || tabArr.find(t => !t.target)
    const guitar = tabArr.find(t => t.target === 'full')
    const uke    = tabArr.find(t => t.target === 'uke')

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
    setTabs({
      bass:   bass   ? { text: (bass.lines   || []).join('\n'), label: bass.label   || 'Bass Tab' }   : { text: '', label: 'Bass Tab' },
      guitar: guitar ? { text: (guitar.lines || []).join('\n'), label: guitar.label || 'Guitar Tab' } : { text: '', label: 'Guitar Tab' },
      uke:    uke    ? { text: (uke.lines    || []).join('\n'), label: uke.label    || 'Ukulele Tab' } : { text: '', label: 'Ukulele Tab' },
    })
    setSongText(src)
    setDirty(false)
  }

  /* ── New song ── */
  function handleNew() {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    setMeta(BLANK_META); setTabs(BLANK_TABS); setSongText('')
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
        meta:      { ...meta, tab: buildTabArr(tabs) },
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
      applyLoaded(song.meta || {}, song.song_text || '')
      setCurrentId(song.id)
    } catch (e) { console.error('Failed to load song', e) }
  }

  /* ── Delete from Supabase ── */
  async function handleDelete(id, title, e) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${title}"?`)) return
    try {
      await deleteSong(id)
      if (currentId === id) {
        setMeta(BLANK_META); setTabs(BLANK_TABS); setSongText('')
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

        <div className="cc-input-header">
          <h2>🎸 Chart Studio</h2>
          <div className="cc-print-btns">
            <button className="cc-btn-ghost" onClick={handlePrint}>Print / PDF</button>
            <button className="cc-btn-solid" onClick={handlePrintAll}>Print All 4</button>
          </div>
        </div>

        {/* Song list */}
        <div className="cc-songs-panel">
          <div className="cc-songs-header">
            <div className="cc-songs-title-group">
              <span className="cc-songs-title">My Songs</span>
              {userName && <span className="cc-songs-user">{userName}</span>}
            </div>
            <button className="cc-new-btn" onClick={handleNew}>+ New</button>
          </div>
          {loadingList ? (
            <p className="cc-songs-empty">Loading…</p>
          ) : songs.length === 0 ? (
            <p className="cc-songs-empty">No saved songs yet.</p>
          ) : (
            <ul className="cc-song-list">
              {songs.map(s => (
                <li
                  key={s.id}
                  className={`cc-song-item${currentId === s.id ? ' active' : ''}`}
                  onClick={() => handleLoad(s.id)}
                >
                  <span className="cc-song-name">{s.title || 'Untitled'}</span>
                  <span className="cc-song-time">{timeAgo(s.updated_at)}</span>
                  <button className="cc-song-delete" onClick={e => handleDelete(s.id, s.title, e)} title="Delete">✕</button>
                </li>
              ))}
            </ul>
          )}
          <div className="cc-save-row">
            <button
              className={`cc-save-btn${dirty ? '' : ' cc-save-btn--clean'}`}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : currentId ? 'Save Changes' : 'Save Song'}
            </button>
            {saveMsg && <span className="cc-save-msg">{saveMsg}</span>}
            {dirty    && <span className="cc-unsaved">● unsaved</span>}
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

        {/* Tab inputs */}
        <details className="cc-tabs-section">
          <summary className="cc-tabs-summary">Tab inputs (bass · guitar · ukulele)</summary>
          <div className="cc-tabs-grid">
            <label className="cc-field span2"><span>Bass tab label</span>
              <input value={tabs.bass.label} onChange={e => updateTab('bass', 'label', e.target.value)} placeholder="Bass Tab" />
            </label>
            <label className="cc-field span2 cc-field-tab"><span>Bass tab · 4-string</span>
              <textarea className="cc-textarea cc-tab-textarea" value={tabs.bass.text} onChange={e => updateTab('bass', 'text', e.target.value)} spellCheck={false} />
            </label>
            <label className="cc-field span2"><span>Guitar tab label</span>
              <input value={tabs.guitar.label} onChange={e => updateTab('guitar', 'label', e.target.value)} placeholder="Guitar Tab" />
            </label>
            <label className="cc-field span2 cc-field-tab"><span>Guitar tab · 6-string</span>
              <textarea className="cc-textarea cc-tab-textarea" value={tabs.guitar.text} onChange={e => updateTab('guitar', 'text', e.target.value)} spellCheck={false} />
            </label>
            <label className="cc-field span2"><span>Ukulele tab label</span>
              <input value={tabs.uke.label} onChange={e => updateTab('uke', 'label', e.target.value)} placeholder="Ukulele Tab" />
            </label>
            <label className="cc-field span2 cc-field-tab"><span>Ukulele tab · GCEA</span>
              <textarea className="cc-textarea cc-tab-textarea" value={tabs.uke.text} onChange={e => updateTab('uke', 'text', e.target.value)} spellCheck={false} />
            </label>
          </div>
        </details>

        {/* Options checkboxes */}
        <div className="cc-checks">
          <label><input type="checkbox" checked={compact}     onChange={e => setCompact(e.target.checked)} /> Compact</label>
          <label><input type="checkbox" checked={collapse}    onChange={e => setCollapse(e.target.checked)} /> Collapse repeats</label>
          <label><input type="checkbox" checked={meta.writeBars}  onChange={e => updateMeta('writeBars',  e.target.checked)} /> Write-in bars</label>
          <label><input type="checkbox" checked={meta.structFull} onChange={e => updateMeta('structFull', e.target.checked)} /> Spell out structure</label>
          <label><input type="checkbox" checked={meta.capoShapes} onChange={e => updateMeta('capoShapes', e.target.checked)} /> Capo changes chords</label>
          <label><input type="checkbox" checked={tabOnBass}   onChange={e => setTabOnBass(e.target.checked)} /> Bass tab on bass chart</label>
          <label><input type="checkbox" checked={tabOnFull}   onChange={e => setTabOnFull(e.target.checked)} /> Guitar tab on full chart</label>
          <label><input type="checkbox" checked={tabOnUke}    onChange={e => setTabOnUke(e.target.checked)} /> Uke tab on full chart</label>
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
