import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchTabs } from '../lib/tabs'
import { fetchTabSheets, fetchTabSheet, saveTabSheet, deleteTabSheet } from '../lib/tabSheets'

// ── Single tab row on the sheet ───────────────────────────────────────────────

function TabRow({ tab, index, total, onMoveUp, onMoveDown, onRemove }) {
  const d = tab.tab_data || {}
  const instrument  = d.instrument    || 'bass'
  const timeSig     = d.timeSignature || '4/4'
  const tempo       = d.tempo         || null
  const ascii       = d.ascii         || ''

  return (
    <div className="tsh-tab-row">
      <div className="tsh-tab-header">
        <div className="tsh-tab-meta">
          <span className="tsh-tab-title">{tab.title || 'Untitled'}</span>
          <span className="tsh-tab-tags">
            {instrument} · {timeSig}{tempo ? ` · ♩= ${tempo}` : ''}
          </span>
        </div>
        <div className="tsh-tab-controls no-print">
          <button onClick={onMoveUp}   disabled={index === 0}         title="Move up">↑</button>
          <button onClick={onMoveDown} disabled={index === total - 1} title="Move down">↓</button>
          <button onClick={onRemove}   title="Remove from sheet" className="tsh-remove">✕</button>
        </div>
      </div>
      {ascii
        ? <pre className="tsh-ascii">{ascii}</pre>
        : <p className="tsh-ascii-empty">No ASCII preview available — re-save this tab in Tab Studio to generate one.</p>
      }
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TabSheet() {
  const [title,      setTitle]      = useState('')
  const [currentId,  setCurrentId]  = useState(null)
  const [dirty,      setDirty]      = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState(null)

  // All saved tabs (for the picker)
  const [allTabs,    setAllTabs]    = useState([])
  const [loadingAll, setLoadingAll] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Tabs on this sheet (ordered array of full tab objects)
  const [sheetTabs,  setSheetTabs]  = useState([])

  // Sheet library
  const [sheets,     setSheets]     = useState([])
  const [libDropOpen, setLibDropOpen] = useState(false)
  const libBtnRef = useRef(null)
  const [libMenuPos, setLibMenuPos] = useState({ left: 0, top: 0 })

  const refreshAll = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([fetchTabs(), fetchTabSheets()])
      setAllTabs(t || [])
      setSheets(s || [])
    } catch (e) {
      console.error('Failed to load tabs/sheets', e)
    } finally {
      setLoadingAll(false)
    }
  }, [])

  useEffect(() => { refreshAll() }, [refreshAll])

  useEffect(() => {
    const t = title.trim() || 'Untitled Sheet'
    document.title = t + (dirty ? ' ●' : '') + ' — Tab Sheet'
  }, [title, dirty])

  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  // ── Sheet management ──────────────────────────────────────────────────────

  function addTab(tab) {
    setSheetTabs(st => [...st, tab])
    setDirty(true)
    setPickerOpen(false)
  }

  function removeTab(idx) {
    setSheetTabs(st => st.filter((_, i) => i !== idx))
    setDirty(true)
  }

  function moveUp(idx) {
    if (idx === 0) return
    setSheetTabs(st => {
      const next = [...st]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
    setDirty(true)
  }

  function moveDown(idx) {
    setSheetTabs(st => {
      if (idx >= st.length - 1) return st
      const next = [...st]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
    setDirty(true)
  }

  // ── Save / Load ───────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true); setSaveMsg(null)
    try {
      const tab_ids = sheetTabs.map(t => t.id)
      const saved = await saveTabSheet({
        id: currentId,
        title: title || 'Untitled Sheet',
        tab_ids,
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
      const tab_ids = sheetTabs.map(t => t.id)
      const saved = await saveTabSheet({ id: null, title: title || 'Untitled Sheet', tab_ids })
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
      const sheet = await fetchTabSheet(id)
      const ids   = sheet.tab_ids || []
      const loaded = ids
        .map(id => allTabs.find(t => t.id === id))
        .filter(Boolean)
      setSheetTabs(loaded)
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
      await deleteTabSheet(id)
      if (currentId === id) handleNew()
      await refreshAll()
    } catch (e) { console.error('Failed to delete sheet', e) }
  }

  function handleNew() {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    setTitle(''); setCurrentId(null); setDirty(false)
    setSheetTabs([]); setSaveMsg(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const available = allTabs.filter(t => !sheetTabs.find(st => st.id === t.id))

  return (
    <div className="tsh-page">

      {/* ── Sidebar ── */}
      <div className="tsh-sidebar no-print">

        <div className="tsh-sidebar-header">
          <h2>🎼 Tab Sheet</h2>

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
          <span>Song / Set Title</span>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); setDirty(true) }}
            placeholder="Song name"
          />
        </label>

        <div className="tsh-add-section">
          <button
            className="cc-btn-solid tsh-add-btn"
            onClick={() => setPickerOpen(o => !o)}
            disabled={loadingAll || available.length === 0}
          >
            + Add Tab
          </button>

          {pickerOpen && (
            <div className="tsh-picker">
              {available.length === 0 ? (
                <div className="tsh-picker-empty">All tabs already added</div>
              ) : (
                available.map(t => {
                  const d  = t.tab_data || {}
                  return (
                    <button key={t.id} className="tsh-picker-item" onClick={() => addTab(t)}>
                      <span className="tsh-picker-title">{t.title || 'Untitled'}</span>
                      <span className="tsh-picker-meta">{d.instrument || 'bass'} · {d.timeSignature || '4/4'}</span>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        <button
          className="cc-btn-solid tsh-print-btn"
          onClick={() => window.print()}
        >
          🖨 Print Sheet
        </button>

      </div>

      {/* ── Print area ── */}
      <div className="tsh-main">
        {title && <h1 className="tsh-song-title">{title}</h1>}

        {sheetTabs.length === 0 ? (
          <div className="tsh-empty no-print">
            <p>Add tabs from the sidebar to build your sheet.</p>
          </div>
        ) : (
          sheetTabs.map((tab, idx) => (
            <TabRow
              key={tab.id + idx}
              tab={tab}
              index={idx}
              total={sheetTabs.length}
              onMoveUp={() => moveUp(idx)}
              onMoveDown={() => moveDown(idx)}
              onRemove={() => removeTab(idx)}
            />
          ))
        )}
      </div>

    </div>
  )
}
