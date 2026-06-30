import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchGrooves } from '../lib/grooves'
import { fetchGrooveSheets, fetchGrooveSheet, saveGrooveSheet, deleteGrooveSheet } from '../lib/grooveSheets'
import { renderGrooveSVG } from '../lib/grooveRenderer'

// ── Groove notation row (renders SVG into a div ref) ─────────────────────────

function GrooveRow({ groove, index, total, onMoveUp, onMoveDown, onRemove }) {
  const svgRef   = useRef(null)
  const d        = groove.groove_data || {}
  const timeSig  = d.timeSig      || { n: 4, d: 4 }
  const feel     = d.feel         || 'straight'
  const grouping = d.beatGrouping || [1, 1, 1, 1]
  const rows     = d.rows         || []
  const grid     = d.grid         || {}
  const tempo    = d.tempo        || null
  const notes    = d.notes        || ''

  useEffect(() => {
    if (!svgRef.current || rows.length === 0) return
    svgRef.current.innerHTML = ''
    const svg = renderGrooveSVG(rows, grid, timeSig, feel, grouping)
    svgRef.current.appendChild(svg)
  }, [groove])

  return (
    <div className="gs-groove-row">
      <div className="gs-groove-header">
        <div className="gs-groove-meta">
          <span className="gs-groove-title">{groove.title || 'Untitled'}</span>
          <span className="gs-groove-tags">
            {timeSig.n}/{timeSig.d} · {feel}{feel === 'triplet' ? ' (16th triplets)' : ''}
            {tempo ? ` · ♩= ${tempo}` : ''}
          </span>
        </div>
        <div className="gs-groove-controls no-print">
          <button onClick={onMoveUp}   disabled={index === 0}         title="Move up">↑</button>
          <button onClick={onMoveDown} disabled={index === total - 1} title="Move down">↓</button>
          <button onClick={onRemove}   title="Remove from sheet" className="gs-remove">✕</button>
        </div>
      </div>
      <div ref={svgRef} className="gs-groove-svg" />
      {notes && <p className="gs-groove-notes">{notes}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GrooveSheet() {
  const [title,      setTitle]      = useState('')
  const [currentId,  setCurrentId]  = useState(null)
  const [dirty,      setDirty]      = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState(null)

  // All saved grooves (for the picker)
  const [allGrooves,   setAllGrooves]   = useState([])
  const [loadingAll,   setLoadingAll]   = useState(true)
  const [pickerOpen,   setPickerOpen]   = useState(false)

  // Grooves on this sheet (ordered array of full groove objects)
  const [sheetGrooves, setSheetGrooves] = useState([])

  // Sheet library
  const [sheets,       setSheets]       = useState([])
  const [libDropOpen,  setLibDropOpen]  = useState(false)
  const libBtnRef = useRef(null)
  const [libMenuPos, setLibMenuPos] = useState({ left: 0, top: 0 })

  // Load groove library + sheet library
  const refreshAll = useCallback(async () => {
    try {
      const [g, s] = await Promise.all([fetchGrooves(), fetchGrooveSheets()])
      setAllGrooves(g || [])
      setSheets(s || [])
    } catch (e) {
      console.error('Failed to load grooves/sheets', e)
    } finally {
      setLoadingAll(false)
    }
  }, [])

  useEffect(() => { refreshAll() }, [refreshAll])

  useEffect(() => {
    const t = title.trim() || 'Untitled Sheet'
    document.title = t + (dirty ? ' ●' : '') + ' — Groove Sheet'
  }, [title, dirty])

  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  // ── Sheet management ────────────────────────────────────────────────────────

  function addGroove(groove) {
    setSheetGrooves(sg => [...sg, groove])
    setDirty(true)
    setPickerOpen(false)
  }

  function removeGroove(idx) {
    setSheetGrooves(sg => sg.filter((_, i) => i !== idx))
    setDirty(true)
  }

  function moveUp(idx) {
    if (idx === 0) return
    setSheetGrooves(sg => {
      const next = [...sg]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
    setDirty(true)
  }

  function moveDown(idx) {
    setSheetGrooves(sg => {
      if (idx >= sg.length - 1) return sg
      const next = [...sg]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
    setDirty(true)
  }

  // ── Save / Load ─────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true); setSaveMsg(null)
    try {
      const groove_ids = sheetGrooves.map(g => g.id)
      const saved = await saveGrooveSheet({
        id: currentId,
        title: title || 'Untitled Sheet',
        groove_ids,
      })
      setCurrentId(saved.id); setDirty(false); setSaveMsg('Saved!')
      await refreshAll()
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
      const groove_ids = sheetGrooves.map(g => g.id)
      const saved = await saveGrooveSheet({ id: null, title: title || 'Untitled Sheet', groove_ids })
      setCurrentId(saved.id); setDirty(false); setSaveMsg('Saved as new!')
      await refreshAll()
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (e) {
      setSaveMsg('Error saving'); console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleLoad(id) {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    try {
      const sheet = await fetchGrooveSheet(id)
      const ids   = sheet.groove_ids || []
      const loaded = ids
        .map(id => allGrooves.find(g => g.id === id))
        .filter(Boolean)
      setSheetGrooves(loaded)
      setTitle(sheet.title || '')
      setCurrentId(sheet.id)
      setDirty(false)
      setLibDropOpen(false)
    } catch (e) { console.error('Failed to load sheet', e) }
  }

  async function handleDelete(id, sheetTitle, e) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${sheetTitle}"?`)) return
    try {
      await deleteGrooveSheet(id)
      if (currentId === id) handleNew()
      await refreshAll()
    } catch (e) { console.error('Failed to delete sheet', e) }
  }

  function handleNew() {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    setTitle(''); setCurrentId(null); setDirty(false)
    setSheetGrooves([]); setSaveMsg(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  // Grooves not already on the sheet
  const available = allGrooves.filter(g => !sheetGrooves.find(sg => sg.id === g.id))

  return (
    <div className="gs-page">

      {/* ── Sidebar ── */}
      <div className="gs-sidebar no-print">

        <div className="gs-sidebar-header">
          <h2>📄 Groove Sheet</h2>

          <div className="gb-savebar">
            <button className="cc-btn-solid" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : currentId ? 'Save Changes' : 'Save Sheet'}
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
                Library {sheets.length > 0 && `(${sheets.length})`}
              </button>
              {libDropOpen && (
                <div className="cc-library-menu" style={{ left: libMenuPos.left, top: libMenuPos.top }}>
                  {sheets.length === 0 ? (
                    <div className="cc-lib-item disabled">No saved sheets</div>
                  ) : (
                    sheets.map(s => (
                      <div
                        key={s.id}
                        className={`cc-lib-item${currentId === s.id ? ' active' : ''}`}
                        onClick={() => handleLoad(s.id)}
                      >
                        <span className="cc-lib-title">{s.title || 'Untitled'}</span>
                        <button
                          className="cc-lib-delete"
                          onClick={e => handleDelete(s.id, s.title || 'Untitled', e)}
                          title="Delete sheet"
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

        <label className="cc-field span2">
          <span>Song Title</span>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); setDirty(true) }}
            placeholder="Song name"
          />
        </label>

        <div className="gs-add-section">
          <button
            className="cc-btn-solid gs-add-btn"
            onClick={() => setPickerOpen(o => !o)}
            disabled={loadingAll || available.length === 0}
          >
            + Add Groove
          </button>

          {pickerOpen && (
            <div className="gs-picker">
              {available.length === 0 ? (
                <div className="gs-picker-empty">All grooves already added</div>
              ) : (
                available.map(g => {
                  const d  = g.groove_data || {}
                  const ts = d.timeSig || { n: 4, d: 4 }
                  return (
                    <button key={g.id} className="gs-picker-item" onClick={() => addGroove(g)}>
                      <span className="gs-picker-title">{g.title || 'Untitled'}</span>
                      <span className="gs-picker-meta">{ts.n}/{ts.d} · {d.feel || 'straight'}</span>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        <button
          className="cc-btn-solid gs-print-btn"
          onClick={() => window.print()}
        >
          🖨 Print Sheet
        </button>

      </div>

      {/* ── Print area ── */}
      <div className="gs-main">
        {title && <h1 className="gs-song-title">{title}</h1>}

        {sheetGrooves.length === 0 ? (
          <div className="gs-empty no-print">
            <p>Add grooves from the sidebar to build your sheet.</p>
          </div>
        ) : (
          sheetGrooves.map((groove, idx) => (
            <GrooveRow
              key={groove.id + idx}
              groove={groove}
              index={idx}
              total={sheetGrooves.length}
              onMoveUp={() => moveUp(idx)}
              onMoveDown={() => moveDown(idx)}
              onRemove={() => removeGroove(idx)}
            />
          ))
        )}
      </div>

    </div>
  )
}
