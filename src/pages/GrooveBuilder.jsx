import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchGrooves, fetchGroove, saveGroove, deleteGroove } from '../lib/grooves'
import { useAuth } from '../context/AuthContext'
import { Renderer, Stave, StaveNote, GhostNote, Voice, Formatter, Beam } from 'vexflow'

// ── Constants ────────────────────────────────────────────────────────────────

const INSTRUMENTS = [
  { id: 'crash',        label: 'Crash',       short: 'Cr' },
  { id: 'hihat_open',   label: 'Hi-Hat Open', short: 'HHo' },
  { id: 'hihat_closed', label: 'Hi-Hat',      short: 'HH' },
  { id: 'ride',         label: 'Ride',        short: 'Rd' },
  { id: 'tom1',         label: 'Tom 1',       short: 'T1' },
  { id: 'tom2',         label: 'Tom 2',       short: 'T2' },
  { id: 'snare',        label: 'Snare',       short: 'Sn' },
  { id: 'floor_tom',    label: 'Floor Tom',   short: 'FT' },
  { id: 'kick',         label: 'Kick',        short: 'K'  },
  { id: 'hihat_foot',   label: 'HH Foot',     short: 'HHf'},
]

const DEFAULT_ROWS = ['hihat_closed', 'snare', 'kick']

const TIME_SIGS = [
  { label: '4/4',  n: 4, d: 4 },
  { label: '3/4',  n: 3, d: 4 },
  { label: '6/8',  n: 6, d: 8 },
  { label: '5/4',  n: 5, d: 4 },
  { label: '7/8',  n: 7, d: 8 },
  { label: '12/8', n: 12, d: 8 },
  { label: '2/4',  n: 2, d: 4 },
  { label: '9/8',  n: 9, d: 8 },
]

const BLANK_META = {
  timeSig:      { n: 4, d: 4 },
  feel:         'straight',
  beatGrouping: [1, 1, 1, 1],
  tempo:        120,
  notes:        '',
}

// ── Grid math ────────────────────────────────────────────────────────────────

function subdivsPerBeat(d, feel) {
  if (d === 4) return feel === 'straight' ? 4 : 6
  if (d === 8) return feel === 'straight' ? 2 : 3
  return 4
}

function calcColumns(timeSig, feel) {
  const spb = subdivsPerBeat(timeSig.d, feel)
  return timeSig.n * spb
}

function defaultGrouping(timeSig) {
  const { n, d } = timeSig
  if (d === 4) return Array(n).fill(1)
  // /8 time: group by pairs or threes
  if (n === 6)  return [3, 3]
  if (n === 9)  return [3, 3, 3]
  if (n === 12) return [3, 3, 3, 3]
  if (n === 7)  return [2, 2, 3]
  return Array(n).fill(1)
}

function emptyGrid(rows, cols) {
  const grid = {}
  rows.forEach(id => { grid[id] = Array(cols).fill(0) })
  return grid
}

function resizeGrid(grid, rows, newCols) {
  const next = {}
  rows.forEach(id => {
    const old = grid[id] || []
    if (old.length === newCols) { next[id] = [...old]; return }
    if (old.length > newCols)   { next[id] = old.slice(0, newCols); return }
    next[id] = [...old, ...Array(newCols - old.length).fill(0)]
  })
  return next
}

// ── Beat grouping column markers ─────────────────────────────────────────────

function groupBoundaries(beatGrouping, timeSig, feel) {
  const spb = subdivsPerBeat(timeSig.d, feel)
  const boundaries = new Set()
  let col = 0
  beatGrouping.forEach(beats => {
    boundaries.add(col)
    col += beats * spb
  })
  return boundaries
}

// ── VexFlow renderer ─────────────────────────────────────────────────────────

function renderNotation(container, rows, grid, timeSig, feel, beatGrouping) {
  if (!container) return
  container.innerHTML = ''

  try {
    const cols = calcColumns(timeSig, feel)
    const spb  = subdivsPerBeat(timeSig.d, feel)
    const rowCount = rows.length

    const ROW_HEIGHT = 36
    const WIDTH  = Math.max(600, cols * 28 + 120)
    const HEIGHT = rowCount * ROW_HEIGHT + 40

    const renderer = new Renderer(container, Renderer.Backends.SVG)
    renderer.resize(WIDTH, HEIGHT)
    const ctx = renderer.getContext()

    // First stave reserves time sig space; others match its note start x
    let noteStartX = null

    // One single-line rhythm stave per instrument row
    rows.forEach((instId, rowIdx) => {
      const inst  = INSTRUMENTS.find(i => i.id === instId) || { short: instId }
      const y     = rowIdx * ROW_HEIGHT + 10
      const stave = new Stave(80, y, WIDTH - 100)
      stave.setNumLines(1)

      if (rowIdx === 0) {
        stave.addTimeSignature(`${timeSig.n}/${timeSig.d}`)
      } else if (noteStartX != null) {
        stave.setNoteStartX(noteStartX)
      }
      stave.setContext(ctx).draw()

      if (rowIdx === 0) noteStartX = stave.getNoteStartX()

      // Label
      ctx.save()
      ctx.setFont('Arial', 10, 'normal')
      ctx.fillText(inst.short, 4, y + 18)
      ctx.restore()

      // Build notes for this row
      const hits = grid[instId] || Array(cols).fill(0)

      // Group columns into beat groups
      const notes = []
      let colIdx = 0

      beatGrouping.forEach(beats => {
        const groupCols = beats * spb
        for (let c = 0; c < groupCols; c++, colIdx++) {
          const hit = hits[colIdx] || 0
          // Duration: each column = one subdivision
          // In straight /4: col = 16th. In triplet /4: col = 16th-triplet
          const dur = feel === 'straight'
            ? (spb === 4 ? '16' : '8')
            : '16'

          const note = hit
            ? new StaveNote({ clef: 'percussion', keys: ['c/5'], duration: dur, note_type: 'x' })
                .setStyle({ fillStyle: '#2D3436', strokeStyle: '#2D3436' })
            : new GhostNote({ duration: dur })

          notes.push(note)
        }
      })

      if (notes.length === 0) return

      const voice = new Voice({
        num_beats: timeSig.n,
        beat_value: timeSig.d,
      }).setStrict(false)
      voice.addTickables(notes)

      new Formatter().joinVoices([voice]).format([voice], WIDTH - 120)

      const beams = Beam.generateBeams(notes.filter(n => n instanceof StaveNote))
      voice.draw(ctx, stave)
      beams.forEach(b => b.setContext(ctx).draw())
    })
  } catch (err) {
    console.error('VexFlow render error:', err)
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GrooveBuilder() {
  const { user } = useAuth()

  // ── Groove state
  const [meta,      setMeta]      = useState(BLANK_META)
  const [rows,      setRows]      = useState(DEFAULT_ROWS)
  const [grid,      setGrid]      = useState(() => emptyGrid(DEFAULT_ROWS, 16))
  const [title,     setTitle]     = useState('')
  const [currentId, setCurrentId] = useState(null)
  const [dirty,     setDirty]     = useState(false)

  // ── Library state
  const [grooves,     setGrooves]     = useState([])
  const [libDropOpen, setLibDropOpen] = useState(false)
  const [loadingLib,  setLoadingLib]  = useState(true)

  // ── Save state
  const [saving,  setSaving]  = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  // ── Derived
  const cols       = calcColumns(meta.timeSig, meta.feel)
  const boundaries = groupBoundaries(meta.beatGrouping, meta.timeSig, meta.feel)

  // ── Refs
  const notationRef = useRef(null)
  const libBtnRef   = useRef(null)
  const [libMenuPos, setLibMenuPos] = useState({ left: 0, top: 0 })

  // ── Load library
  const refreshLib = useCallback(async () => {
    try   { setGrooves(await fetchGrooves()) }
    catch (e) { console.error('Failed to load grooves', e) }
    finally   { setLoadingLib(false) }
  }, [])
  useEffect(() => { refreshLib() }, [refreshLib])

  // ── VexFlow render
  useEffect(() => {
    renderNotation(notationRef.current, rows, grid, meta.timeSig, meta.feel, meta.beatGrouping)
  }, [rows, grid, meta.timeSig, meta.feel, meta.beatGrouping])

  // ── Tab title
  useEffect(() => {
    const t = title.trim() || 'Untitled'
    document.title = t + (dirty ? ' ●' : '') + ' — Groove Builder'
  }, [title, dirty])

  // ── Ctrl+S
  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  // ── Grid helpers
  function toggleCell(instId, colIdx) {
    setGrid(g => {
      const row = [...(g[instId] || Array(cols).fill(0))]
      row[colIdx] = row[colIdx] ? 0 : 1
      return { ...g, [instId]: row }
    })
    setDirty(true)
  }

  function updateMeta(key, value) {
    setMeta(m => ({ ...m, [key]: value }))
    setDirty(true)
  }

  function applyTimeSig(ts) {
    const newGrouping = defaultGrouping(ts)
    const newCols     = calcColumns(ts, meta.feel)
    setMeta(m => ({ ...m, timeSig: ts, beatGrouping: newGrouping }))
    setGrid(g => resizeGrid(g, rows, newCols))
    setDirty(true)
  }

  function applyFeel(feel) {
    const newCols = calcColumns(meta.timeSig, feel)
    updateMeta('feel', feel)
    setGrid(g => resizeGrid(g, rows, newCols))
  }

  // ── Row management
  function addRow() {
    if (rows.length >= 5) return
    const available = INSTRUMENTS.find(i => !rows.includes(i.id))
    if (!available) return
    const newRows = [...rows, available.id]
    setRows(newRows)
    setGrid(g => ({ ...g, [available.id]: Array(cols).fill(0) }))
    setDirty(true)
  }

  function removeRow(idx) {
    if (rows.length <= 1) return
    const instId  = rows[idx]
    const newRows = rows.filter((_, i) => i !== idx)
    setRows(newRows)
    setGrid(g => { const next = { ...g }; delete next[instId]; return next })
    setDirty(true)
  }

  function changeRowInstrument(idx, newInstId) {
    const oldId   = rows[idx]
    const newRows = rows.map((id, i) => i === idx ? newInstId : id)
    setRows(newRows)
    setGrid(g => {
      const next    = { ...g }
      next[newInstId] = next[oldId] || Array(cols).fill(0)
      if (oldId !== newInstId) delete next[oldId]
      return next
    })
    setDirty(true)
  }

  function clearRow(instId) {
    setGrid(g => ({ ...g, [instId]: Array(cols).fill(0) }))
    setDirty(true)
  }

  function clearAll() {
    setGrid(emptyGrid(rows, cols))
    setDirty(true)
  }

  // ── Save / Load / Delete
  async function handleSave() {
    setSaving(true); setSaveMsg(null)
    try {
      const groove_data = { ...meta, rows, grid }
      const saved = await saveGroove({
        id: currentId,
        title: title || 'Untitled Groove',
        groove_data,
      })
      setCurrentId(saved.id); setDirty(false); setSaveMsg('Saved!')
      await refreshLib()
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (e) {
      setSaveMsg('Error saving'); console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAsNew() {
    setSaving(true); setSaveMsg(null)
    try {
      const groove_data = { ...meta, rows, grid }
      const saved = await saveGroove({ id: null, title: title || 'Untitled Groove', groove_data })
      setCurrentId(saved.id); setDirty(false); setSaveMsg('Saved as new!')
      await refreshLib()
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (e) {
      setSaveMsg('Error saving'); console.error(e)
    } finally {
      setSaving(false)
    }
  }

  function applyLoaded(groove) {
    const d = groove.groove_data || {}
    setMeta({
      timeSig:      d.timeSig      || BLANK_META.timeSig,
      feel:         d.feel         || 'straight',
      beatGrouping: d.beatGrouping || [1,1,1,1],
      tempo:        d.tempo        || 120,
      notes:        d.notes        || '',
    })
    const loadedRows = d.rows || DEFAULT_ROWS
    const loadedCols = calcColumns(d.timeSig || BLANK_META.timeSig, d.feel || 'straight')
    setRows(loadedRows)
    setGrid(resizeGrid(d.grid || {}, loadedRows, loadedCols))
    setTitle(groove.title || '')
    setCurrentId(groove.id)
    setDirty(false)
  }

  async function handleLoad(id) {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    try {
      const groove = await fetchGroove(id)
      applyLoaded(groove)
    } catch (e) { console.error('Failed to load groove', e) }
  }

  async function handleDelete(id, grooveTitle, e) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${grooveTitle}"?`)) return
    try {
      await deleteGroove(id)
      if (currentId === id) handleNew()
      await refreshLib()
    } catch (e) { console.error('Failed to delete groove', e) }
  }

  function handleNew() {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    setMeta(BLANK_META)
    setRows(DEFAULT_ROWS)
    setGrid(emptyGrid(DEFAULT_ROWS, 16))
    setTitle('')
    setCurrentId(null)
    setDirty(false)
    setSaveMsg(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="gb-page">

      {/* ── Sidebar ── */}
      <div className="gb-sidebar">

        {/* Header */}
        <div className="gb-sidebar-header">
          <h2>🥁 Groove Builder</h2>

          {/* Save bar */}
          <div className="gb-savebar">
            <button className="cc-btn-solid" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : currentId ? 'Save Changes' : 'Save Groove'}
            </button>
            {currentId && (
              <button className="cc-btn-ghost" onClick={handleSaveAsNew} disabled={saving}>
                Save As New
              </button>
            )}
            <button className="cc-btn-ghost" onClick={handleNew}>+ New</button>

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
                Library {grooves.length > 0 && `(${grooves.length})`}
              </button>
              {libDropOpen && (
                <div
                  className="cc-library-menu"
                  style={{ left: libMenuPos.left, top: libMenuPos.top }}
                >
                  {loadingLib ? (
                    <div className="cc-lib-item disabled">Loading…</div>
                  ) : grooves.length === 0 ? (
                    <div className="cc-lib-item disabled">No saved grooves</div>
                  ) : (
                    grooves.map(g => (
                      <div
                        key={g.id}
                        className={`cc-lib-item${currentId === g.id ? ' active' : ''}`}
                        onClick={() => { handleLoad(g.id); setLibDropOpen(false) }}
                      >
                        <span className="cc-lib-title">{g.title || 'Untitled'}</span>
                        <button
                          className="cc-lib-delete"
                          onClick={e => handleDelete(g.id, g.title || 'Untitled', e)}
                          title="Delete groove"
                        >✕</button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {currentId && !saveMsg && !dirty && (
              <span className="cc-editing-badge">Editing: {title || 'Untitled'}</span>
            )}
            {saveMsg && <span className="cc-save-msg">{saveMsg}</span>}
            {dirty && !saveMsg && <span className="cc-unsaved">● unsaved</span>}
          </div>
        </div>

        {/* Groove title */}
        <label className="cc-field span2">
          <span>Title</span>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); setDirty(true) }}
            placeholder="Groove name"
          />
        </label>

        {/* Tempo */}
        <label className="cc-field">
          <span>Tempo (BPM)</span>
          <input
            type="number" min="20" max="400" step="1"
            value={meta.tempo}
            onChange={e => updateMeta('tempo', parseInt(e.target.value, 10) || 120)}
          />
        </label>

        {/* Time signature */}
        <div className="cc-field">
          <span>Time Signature</span>
          <div className="gb-timesig-grid">
            {TIME_SIGS.map(ts => (
              <button
                key={ts.label}
                className={`gb-ts-btn${meta.timeSig.n === ts.n && meta.timeSig.d === ts.d ? ' active' : ''}`}
                onClick={() => applyTimeSig({ n: ts.n, d: ts.d })}
              >
                {ts.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feel */}
        <div className="cc-field">
          <span>Feel</span>
          <div className="gb-feel-toggle">
            <button
              className={`gb-feel-btn${meta.feel === 'straight' ? ' active' : ''}`}
              onClick={() => applyFeel('straight')}
            >Straight</button>
            <button
              className={`gb-feel-btn${meta.feel === 'triplet' ? ' active' : ''}`}
              onClick={() => applyFeel('triplet')}
            >Triplet</button>
          </div>
        </div>

        {/* Grid info */}
        <div className="gb-grid-info">
          {cols} columns · {meta.timeSig.n}/{meta.timeSig.d} · {meta.feel}
          {meta.feel === 'triplet' && ' (16th triplets)'}
        </div>

        {/* Notes */}
        <label className="cc-field">
          <span>Notes</span>
          <textarea
            className="gb-notes"
            value={meta.notes}
            onChange={e => updateMeta('notes', e.target.value)}
            placeholder="Ghost notes, feel description, context…"
            rows={4}
          />
        </label>

        {/* Clear */}
        <button className="cc-btn-ghost gb-clear-btn" onClick={clearAll}>
          Clear All
        </button>

      </div>

      {/* ── Main grid area ── */}
      <div className="gb-main">

        {/* Instrument rows */}
        <div className="gb-grid-wrap">
          <table className="gb-grid">
            <tbody>
              {rows.map((instId, rowIdx) => {
                const inst = INSTRUMENTS.find(i => i.id === instId) || { label: instId, short: instId }
                const hits = grid[instId] || Array(cols).fill(0)
                return (
                  <tr key={instId} className="gb-row">
                    {/* Row label + controls */}
                    <td className="gb-row-label">
                      <select
                        value={instId}
                        onChange={e => changeRowInstrument(rowIdx, e.target.value)}
                        className="gb-inst-select"
                        title="Change instrument"
                      >
                        {INSTRUMENTS.map(i => (
                          <option key={i.id} value={i.id} disabled={rows.includes(i.id) && i.id !== instId}>
                            {i.short}
                          </option>
                        ))}
                      </select>
                      <button
                        className="gb-row-clear"
                        onClick={() => clearRow(instId)}
                        title="Clear row"
                      >✕</button>
                    </td>

                    {/* Grid cells */}
                    {hits.map((hit, colIdx) => {
                      const isBeat    = boundaries.has(colIdx)
                      const isSubDiv4 = colIdx % 4 === 0
                      return (
                        <td
                          key={colIdx}
                          className={[
                            'gb-cell',
                            hit        ? 'gb-cell-on'   : '',
                            isBeat     ? 'gb-cell-beat'  : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => toggleCell(instId, colIdx)}
                        />
                      )
                    })}

                    {/* Remove row */}
                    <td className="gb-row-remove">
                      <button
                        onClick={() => removeRow(rowIdx)}
                        disabled={rows.length <= 1}
                        title="Remove row"
                        className="gb-remove-btn"
                      >−</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Add row button */}
          {rows.length < 5 && (
            <button className="gb-add-row-btn cc-btn-ghost" onClick={addRow}>
              + Add Instrument Row
            </button>
          )}
        </div>

        {/* VexFlow notation */}
        <div className="gb-notation-wrap">
          <div className="gb-notation-label">Notation Preview</div>
          <div ref={notationRef} className="gb-notation" />
        </div>

      </div>
    </div>
  )
}
