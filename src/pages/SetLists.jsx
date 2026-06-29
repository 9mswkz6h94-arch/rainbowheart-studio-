import { useState, useEffect, useCallback } from 'react'
import { fetchSetLists, saveSetList, deleteSetList } from '../lib/setlists'
import { fetchSongs, fetchSong } from '../lib/songs'

const EMPTY_ACTIVE = { id: null, token: null }

function fmtDate(d) {
  if (!d) return null
  const [y, m, day] = d.split('-')
  return new Date(+y, +m - 1, +day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isPast(d) {
  if (!d) return false
  return new Date(d) < new Date(new Date().toDateString())
}

function SidebarSection({ title, items, activeId, onOpen, onDelete }) {
  if (items.length === 0) return null
  return (
    <div className="sl-section">
      <div className="sl-section-label">{title}</div>
      {items.map(sl => (
        <div
          key={sl.id}
          className={`sl-list-item${activeId === sl.id ? ' active' : ''}`}
          onClick={() => onOpen(sl)}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {sl.event_date && (
              <div className="sl-date-badge">{fmtDate(sl.event_date)}</div>
            )}
            <div className="sl-list-name">{sl.name}</div>
            <div className="sl-list-meta">
              {(sl.songs || []).length} song{(sl.songs || []).length !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            className="cc-lib-delete"
            onClick={e => { e.stopPropagation(); onDelete(sl.id, sl.name, e) }}
            title="Delete"
          >✕</button>
        </div>
      ))}
    </div>
  )
}

export default function SetLists() {
  const [setlists,    setSetlists]    = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [library,     setLibrary]     = useState([])
  const [loadingLib,  setLoadingLib]  = useState(true)

  /* Active set list being edited */
  const [active,        setActive]        = useState(null)
  const [name,          setName]          = useState('')
  const [eventDate,     setEventDate]     = useState('')
  const [eventUrl,      setEventUrl]      = useState('')
  const [eventDetails,  setEventDetails]  = useState('')
  const [items,         setItems]         = useState([])
  const [dirty,         setDirty]         = useState(false)

  const [addingId,    setAddingId]    = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState(null)
  const [shareMsg,    setShareMsg]    = useState(null)
  const [showLib,     setShowLib]     = useState(false)
  const [dragIdx,     setDragIdx]     = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  /* ── Load data ── */
  const refreshLists = useCallback(async () => {
    setLoadingList(true)
    try   { setSetlists(await fetchSetLists()) }
    catch (e) { console.error(e) }
    finally   { setLoadingList(false) }
  }, [])

  const loadLibrary = useCallback(async () => {
    setLoadingLib(true)
    try   { setLibrary(await fetchSongs()) }
    catch (e) { console.error(e) }
    finally   { setLoadingLib(false) }
  }, [])

  useEffect(() => { refreshLists(); loadLibrary() }, [refreshLists, loadLibrary])

  /* ── Group setlists ── */
  const upcoming = setlists.filter(sl => !isPast(sl.event_date))
  const past     = setlists.filter(sl =>  isPast(sl.event_date))

  /* ── New / load for edit ── */
  function startNew() {
    setActive(EMPTY_ACTIVE)
    setName('New Set List')
    setEventDate('')
    setEventUrl('')
    setEventDetails('')
    setItems([])
    setDirty(false)
    setShowLib(true)
  }

  function openForEdit(sl) {
    setActive({ id: sl.id, token: sl.share_token })
    setName(sl.name)
    setEventDate(sl.event_date || '')
    setEventUrl(sl.event_url || '')
    setEventDetails(sl.event_details || '')
    setItems(sl.songs || [])
    setDirty(false)
    setShowLib(false)
  }

  function handleDropdownChange(e) {
    const id = e.target.value
    if (!id) return
    const sl = setlists.find(s => s.id === id)
    if (sl) openForEdit(sl)
  }

  /* ── Song management ── */
  async function handleAddSong(songId) {
    if (items.some(it => it._songId === songId)) return
    setAddingId(songId)
    try {
      const s = await fetchSong(songId)
      setItems(prev => [...prev, { _songId: s.id, title: s.title, song_text: s.song_text, meta: s.meta }])
      setDirty(true)
    } catch (e) { console.error(e) }
    finally { setAddingId(null) }
  }

  function handleRemove(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  function handleMove(idx, dir) {
    const next = [...items]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setItems(next)
    setDirty(true)
  }

  function handleDragStart(e, idx) {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIdx(idx)
  }

  function handleDrop(e, idx) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return }
    const next = [...items]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(idx, 0, moved)
    setItems(next)
    setDirty(true)
    setDragIdx(null)
    setDragOverIdx(null)
  }

  function handleDragEnd() {
    setDragIdx(null)
    setDragOverIdx(null)
  }

  async function handleSyncAll() {
    if (items.length === 0) return
    setSaving(true); setSaveMsg('Syncing…')
    try {
      const updated = await Promise.all(
        items.map(async item => {
          if (!item._songId) return item
          try {
            const s = await fetchSong(item._songId)
            return { ...item, title: s.title, song_text: s.song_text, meta: s.meta }
          } catch { return item }
        })
      )
      setItems(updated)
      setDirty(true)
      setSaveMsg('Charts synced — save to keep')
      setTimeout(() => setSaveMsg(null), 3000)
    } catch (e) {
      setSaveMsg('Sync failed: ' + (e?.message || 'unknown'))
    } finally {
      setSaving(false)
    }
  }

  /* ── Save ── */
  async function handleSave() {
    setSaving(true); setSaveMsg(null)
    try {
      const saved = await saveSetList({
        id: active?.id || null,
        name,
        songs: items,
        event_date:    eventDate    || null,
        event_url:     eventUrl     || null,
        event_details: eventDetails || null,
      })
      setActive({ id: saved.id, token: saved.share_token })
      setDirty(false)
      setSaveMsg('Saved!')
      await refreshLists()
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (e) {
      setSaveMsg('Error: ' + (e?.message || 'save failed'))
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  /* ── Delete ── */
  async function handleDelete(id, slName) {
    if (!window.confirm(`Delete "${slName}"?`)) return
    try {
      await deleteSetList(id)
      if (active?.id === id) {
        setActive(null); setName(''); setEventDate(''); setEventUrl(''); setEventDetails(''); setItems([])
      }
      await refreshLists()
    } catch (e) { console.error(e) }
  }

  /* ── Share / open ── */
  function handleShare() {
    if (!active?.token) return
    const url = `${window.location.origin}/setlist/${active.token}`
    navigator.clipboard.writeText(url).then(() => {
      setShareMsg('Link copied!')
      setTimeout(() => setShareMsg(null), 2500)
    })
  }

  function handleOpenView() {
    if (!active?.token) return
    window.open(`${window.location.origin}/setlist/${active.token}`, '_blank')
  }

  const editing = active !== null

  return (
    <div className="sl-layout">

      {/* ── Left: performance history sidebar ── */}
      <div className="sl-sidebar">
        <div className="cc-input-header" style={{ margin: '-1.25rem -1.25rem 0', padding: '1rem 1.25rem 0.75rem' }}>
          <div className="cc-header-row">
            <h2 style={{ fontSize: '1rem', margin: 0 }}>🎵 Set Lists</h2>
          </div>
          <div className="cc-savebar">
            <button className="cc-btn-solid" onClick={startNew}>+ New Set List</button>
          </div>
        </div>

        <div style={{ paddingTop: '0.75rem' }}>
          {loadingList ? (
            <p className="cc-hint">Loading…</p>
          ) : setlists.length === 0 ? (
            <p className="cc-hint">No set lists yet — create one!</p>
          ) : (
            <>
              <SidebarSection
                title="📅 Upcoming"
                items={upcoming}
                activeId={active?.id}
                onOpen={openForEdit}
                onDelete={handleDelete}
              />
              <SidebarSection
                title="✓ Past Performances"
                items={past}
                activeId={active?.id}
                onOpen={openForEdit}
                onDelete={handleDelete}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Right: editor ── */}
      {editing ? (
        <div className="sl-editor">

          {/* Sticky header */}
          <div className="cc-input-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', margin: 0, padding: '1rem 1.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
            <div className="cc-header-row" style={{ gap: '0.75rem' }}>
              <input
                className="sl-name-input"
                value={name}
                onChange={e => { setName(e.target.value); setDirty(true) }}
                placeholder="Set list name"
              />
              {/* Quick-jump dropdown */}
              {setlists.length > 0 && (
                <select
                  className="sl-jump-select"
                  value={active?.id || ''}
                  onChange={handleDropdownChange}
                  title="Jump to a different set list"
                >
                  <option value="">Jump to…</option>
                  {upcoming.length > 0 && (
                    <optgroup label="📅 Upcoming">
                      {upcoming.map(sl => (
                        <option key={sl.id} value={sl.id}>
                          {sl.event_date ? fmtDate(sl.event_date) + ' · ' : ''}{sl.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {past.length > 0 && (
                    <optgroup label="✓ Past Performances">
                      {past.map(sl => (
                        <option key={sl.id} value={sl.id}>
                          {sl.event_date ? fmtDate(sl.event_date) + ' · ' : ''}{sl.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
            </div>
            <div className="cc-savebar">
              <button className="cc-btn-solid cc-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Set List'}
              </button>
              {active?.token && <>
                <button className="cc-btn-ghost" onClick={handleShare}>Copy Share Link</button>
                <button className="cc-btn-ghost" onClick={handleOpenView}>Open Performer View ↗</button>
              </>}
              {saveMsg  && <span className={saveMsg.startsWith('Error') ? 'cc-unsaved' : 'cc-save-msg'}>{saveMsg}</span>}
              {shareMsg && <span className="cc-save-msg">{shareMsg}</span>}
              {dirty && !saveMsg && <span className="cc-unsaved">● unsaved</span>}
            </div>
          </div>

          {/* Body */}
          <div className="sl-body">
            <div className="sl-order-panel">

              {/* Event details card */}
              <div className="sl-event-card">
                <div className="sl-panel-title" style={{ marginBottom: '0.75rem' }}>Event Details</div>
                <div className="sl-event-fields">
                  <label className="sl-event-label">
                    <span>Date</span>
                    <input
                      type="date"
                      className="sl-event-input"
                      value={eventDate}
                      onChange={e => { setEventDate(e.target.value); setDirty(true) }}
                    />
                  </label>
                  <label className="sl-event-label">
                    <span>Event Page URL</span>
                    <input
                      type="url"
                      className="sl-event-input"
                      value={eventUrl}
                      onChange={e => { setEventUrl(e.target.value); setDirty(true) }}
                      placeholder="https://facebook.com/events/..."
                    />
                  </label>
                </div>
                <label className="sl-event-label" style={{ marginTop: '0.5rem' }}>
                  <span>Notes / Venue Details</span>
                  <textarea
                    className="sl-event-textarea"
                    value={eventDetails}
                    onChange={e => { setEventDetails(e.target.value); setDirty(true) }}
                    placeholder="Venue name, address, door time, notes for the band…"
                    rows={3}
                  />
                </label>
                {eventUrl && (
                  <a href={eventUrl} target="_blank" rel="noopener noreferrer" className="sl-event-link">
                    Open Event Page ↗
                  </a>
                )}
              </div>

              {/* Set order */}
              <div className="sl-panel-header" style={{ marginTop: '1.25rem' }}>
                <span className="sl-panel-title">Set Order · {items.length} song{items.length !== 1 ? 's' : ''}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {items.length > 0 && (
                    <button
                      className="cc-btn-ghost"
                      style={{ fontSize: '0.75rem' }}
                      onClick={handleSyncAll}
                      disabled={saving}
                      title="Pull latest edits from your chord chart library"
                    >
                      ↻ Sync Charts
                    </button>
                  )}
                  <button
                    className="cc-btn-ghost"
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => setShowLib(p => !p)}
                  >
                    {showLib ? 'Hide Library' : '+ Add Songs'}
                  </button>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="sl-empty">
                  No songs yet — click <strong>+ Add Songs</strong> to pick from your library
                </div>
              ) : (
                <div className="sl-song-list">
                  {items.map((song, idx) => (
                    <div
                      key={idx}
                      className={`sl-song-row${dragIdx === idx ? ' sl-dragging' : ''}${dragOverIdx === idx && dragIdx !== idx ? ' sl-drag-over' : ''}`}
                      draggable
                      onDragStart={e => handleDragStart(e, idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDrop={e => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                    >
                      <span className="sl-drag-handle" title="Drag to reorder">⠿</span>
                      <span className="sl-song-num">{idx + 1}.</span>
                      <div className="sl-song-info">
                        <div className="sl-song-title">{song.title || 'Untitled'}</div>
                        {song.meta?.key && (
                          <div className="sl-song-key">
                            Key: {song.meta.key}{song.meta.capo ? ` · Capo ${song.meta.capo}` : ''}
                            {song.meta?.writer ? ` · ${song.meta.writer}` : ''}
                          </div>
                        )}
                      </div>
                      <div className="sl-song-controls">
                        <button className="cc-lib-delete" onClick={() => handleRemove(idx)} title="Remove from set">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Library picker */}
            {showLib && (
              <div className="sl-lib-panel">
                <div className="sl-panel-header">
                  <span className="sl-panel-title">Your Song Library</span>
                </div>
                {loadingLib ? (
                  <p className="cc-hint" style={{ padding: '0.75rem' }}>Loading…</p>
                ) : library.length === 0 ? (
                  <p className="cc-hint" style={{ padding: '0.75rem' }}>No saved songs yet.</p>
                ) : (
                  library.map(song => {
                    const inSet = items.some(it => it._songId === song.id)
                    return (
                      <div key={song.id} className={`sl-lib-row${inSet ? ' in-set' : ''}`}>
                        <span className="sl-lib-title">{song.title || 'Untitled'}</span>
                        {inSet ? (
                          <span className="sl-lib-added">✓ Added</span>
                        ) : (
                          <button
                            className="cc-btn-solid"
                            style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem' }}
                            onClick={() => handleAddSong(song.id)}
                            disabled={addingId === song.id}
                          >
                            {addingId === song.id ? '…' : '+ Add'}
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="sl-empty-state">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎵</div>
          <div>Select a set list or create a new one</div>
        </div>
      )}
    </div>
  )
}
