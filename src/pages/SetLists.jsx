import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchSetLists, saveSetList, deleteSetList } from '../lib/setlists'
import { fetchSongs, fetchSong } from '../lib/songs'
import { uploadSetListPdf } from '../lib/setlistPdfs'

const EMPTY_ACTIVE = { id: null, token: null }
const CUSTOM_SONG_TYPE = 'custom-song'

function isSongItem(item) {
  return Boolean(item) && (!item._type || item._type === CUSTOM_SONG_TYPE)
}

function buildSetColumns(items) {
  const columns = []
  let current = { key: 'opening', named: false, rows: [] }

  items.forEach((song, idx) => {
    if (song._type === 'set') {
      if (current.rows.length) columns.push(current)
      current = { key: `set-${idx}`, named: true, rows: [{ song, idx }] }
    } else {
      current.rows.push({ song, idx })
    }
  })

  if (current.rows.length) columns.push(current)
  return columns
}

function fmtDate(d) {
  if (!d) return null
  const [y, m, day] = d.split('-')
  return new Date(+y, +m - 1, +day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isPast(d) {
  if (!d) return false
  return new Date(d) < new Date(new Date().toDateString())
}

function SidebarSection({ title, items, activeId, onOpen, onDelete, onDuplicate }) {
  const [openMenuId, setOpenMenuId] = useState(null)
  if (items.length === 0) return null
  return (
    <div className="sl-section">
      <div className="sl-section-label">{title}</div>
      {items.map(sl => {
        const songCount = (sl.songs || []).filter(isSongItem).length
        return (
          <div
            key={sl.id}
            className={`sl-list-item${activeId === sl.id ? ' active' : ''}`}
          >
            <button
              type="button"
              className="sl-list-open"
              onClick={() => onOpen(sl)}
            >
              {sl.event_date && (
                <div className="sl-date-badge">{fmtDate(sl.event_date)}</div>
              )}
              <div className="sl-list-name">{sl.name}</div>
              <div className="sl-list-meta">
                {songCount} song{songCount !== 1 ? 's' : ''}
              </div>
            </button>
            <button
              type="button"
              className="sl-list-more"
              onClick={() => setOpenMenuId(current => current === sl.id ? null : sl.id)}
              aria-expanded={openMenuId === sl.id}
              aria-controls={`show-actions-${sl.id}`}
            >More</button>
            {openMenuId === sl.id && (
              <div className="sl-list-actions" id={`show-actions-${sl.id}`}>
                <button
                  type="button"
                  onClick={() => { setOpenMenuId(null); onDuplicate(sl) }}
                >Duplicate Show</button>
                <button
                  type="button"
                  className="danger"
                  onClick={e => { setOpenMenuId(null); onDelete(sl.id, sl.name, e) }}
                >Delete Show</button>
              </div>
            )}
          </div>
        )
      })}
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
  const [showLib,     setShowLib]     = useState(false)
  const [showDrafts,  setShowDrafts]  = useState(false)
  const [libQuery,    setLibQuery]    = useState('')
  const [dragIdx,     setDragIdx]     = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [uploadingPdf, setUploadingPdf] = useState(null)
  const [editingTimeKey, setEditingTimeKey] = useState(null)
  const nameRef = useRef(null)

  function focusNameField() {
    const el = nameRef.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => { el.focus(); el.select() }, 250)
  }

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
    setName('New Show')
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
      setItems(prev => [...prev, { _songId: s.id, title: s.title, song_text: s.song_text, meta: s.meta, duration: parseFloat(s.meta?.duration) || null }])
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

  function handleAddBreak() {
    setItems(prev => [...prev, { _type: 'break', label: 'Break', duration: 15 }])
    setDirty(true)
  }

  function handleAddNote() {
    setItems(prev => [...prev, { _type: 'note', label: 'Note', text: '' }])
    setDirty(true)
  }

  function handleAddCustomSong() {
    setItems(prev => [...prev, {
      _type: CUSTOM_SONG_TYPE,
      _customId: crypto.randomUUID(),
      title: 'Outside song',
      duration: null,
      pdf: null,
    }])
    setDirty(true)
  }

  function handleCustomTitleChange(idx, val) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, title: val } : it))
    setDirty(true)
  }

  async function handleCustomPdfChange(idx, file) {
    if (!file) return
    const customId = items[idx]?._customId
    setUploadingPdf(customId)
    setSaveMsg(null)
    try {
      const pdf = await uploadSetListPdf(file)
      setItems(prev => prev.map((it, i) =>
        (customId ? it._customId === customId : i === idx) ? { ...it, pdf } : it
      ))
      setDirty(true)
      setSaveMsg('PDF attached - save show to keep it')
      setTimeout(() => setSaveMsg(null), 3000)
    } catch (e) {
      setSaveMsg('Error: ' + (e?.message || 'PDF upload failed'))
    } finally {
      setUploadingPdf(null)
    }
  }

  function handleRemovePdf(idx) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, pdf: null } : it))
    setDirty(true)
  }

  function handleBreakLabelChange(idx, val) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, label: val } : it))
    setDirty(true)
  }

  function handleNoteTextChange(idx, val) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, text: val } : it))
    setDirty(true)
  }

  function handleAddSet() {
    setItems(prev => {
      const n = prev.filter(it => it._type === 'set').length
      const header = { _type: 'set', label: `Set ${n + 1}` }
      // First set on an existing list goes on top so it wraps the songs already there
      return n === 0 ? [header, ...prev] : [...prev, header]
    })
    setDirty(true)
  }

  function handleDeleteSet(idx) {
    let end = idx + 1
    while (end < items.length && items[end]._type !== 'set') end++
    const inside = end - idx - 1
    const label = items[idx].label || 'Set'
    if (inside > 0 && !window.confirm(`Delete "${label}" and the ${inside} item${inside !== 1 ? 's' : ''} in it? Songs stay in your library.`)) return
    setItems(prev => [...prev.slice(0, idx), ...prev.slice(end)])
    setDirty(true)
  }

  function handleItemDurationChange(idx, val) {
    const n = val === '' ? null : Math.round(parseFloat(val) * 4) / 4
    if (n !== null && (isNaN(n) || n <= 0)) return
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, duration: n } : it))
    setDirty(true)
  }

  async function handleDuplicate(sl) {
    try {
      const saved = await saveSetList({
        id: null,
        name: sl.name + ' (copy)',
        songs: sl.songs || [],
        event_date:    null,
        event_url:     null,
        event_details: sl.event_details || null,
      })
      await refreshLists()
      openForEdit({
        id: saved.id, share_token: saved.share_token, name: saved.name,
        songs: sl.songs || [], event_date: null, event_url: null,
        event_details: sl.event_details || null,
      })
    } catch (e) { console.error(e) }
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
            const syncDur = (s.meta?.duration != null && s.meta.duration !== '') ? parseFloat(s.meta.duration) : item.duration
            return { ...item, title: s.title, song_text: s.song_text, meta: s.meta, duration: syncDur ?? null }
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

  function handlePrintOriginalCharts() {
    if (!active?.id || dirty) {
      setSaveMsg('Save the show before printing original charts')
      setTimeout(() => setSaveMsg(null), 3000)
      return
    }
    window.location.assign(`/studio/setlists/${active.id}/print?mode=charts`)
  }

  async function handleCopyBandLink() {
    if (!active?.token || dirty) {
      setSaveMsg('Save the show before sharing its band packet')
      setTimeout(() => setSaveMsg(null), 3000)
      return
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/band/${active.token}`)
      setSaveMsg('Band packet link copied')
    } catch {
      setSaveMsg('Could not copy the band link')
    }
    setTimeout(() => setSaveMsg(null), 3000)
  }

  function handlePrintSetList() {
    if (!active?.id || dirty) {
      setSaveMsg('Save the show before printing its setlist')
      setTimeout(() => setSaveMsg(null), 3000)
      return
    }
    window.location.assign('/studio/setlists/' + active.id + '/print?mode=floor')
  }

  const editing = active !== null

  /* Song numbering restarts at each named set */
  let _sn = 0, _songTotal = 0
  const songNums = items.map(it => {
    if (it._type === 'set') { _sn = 0; return null }
    if (!isSongItem(it)) return null
    _songTotal++
    return ++_sn
  })
  const songCount  = _songTotal
  const chartSongCount = items.filter(it => !it._type).length
  const breakCount = items.filter(it => it._type === 'break').length
  const setCount   = items.filter(it => it._type === 'set').length
  const noteCount  = items.filter(it => it._type === 'note').length
  const totalMins = items.reduce((s, it) => s + (parseFloat(it.duration) || 0), 0)
  const setColumns = buildSetColumns(items)

  /* Per-set song count + running time, keyed by the set header's index */
  const setStats = {}
  {
    let cur = null
    items.forEach((it, i) => {
      if (it._type === 'set') { cur = i; setStats[i] = { songs: 0, mins: 0 }; return }
      if (cur === null) return
      setStats[cur].mins += parseFloat(it.duration) || 0
      if (isSongItem(it)) setStats[cur].songs++
    })
  }

  function fmtDuration(m) {
    const totalSecs = Math.round(m * 60)
    const h    = Math.floor(totalSecs / 3600)
    const mins = Math.floor((totalSecs % 3600) / 60)
    const secs = totalSecs % 60
    if (h > 0) return mins > 0 ? `${h}h ${mins}m` : `${h}h`
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }

  function fmtSongDur(m) {
    if (!m) return ''
    const totalSecs = Math.round(parseFloat(m) * 60)
    const mins = Math.floor(totalSecs / 60)
    const secs = totalSecs % 60
    return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins}:00`
  }

  function renderSongTime(song, idx) {
    const timeKey = song._customId || song._songId || `song-${idx}`
    if (editingTimeKey === timeKey) {
      return (
        <div className="sl-duration-editor">
          <input
            type="number"
            className="sl-duration-input"
            value={song.duration ?? ''}
            min="0.25" max="20" step="0.25"
            placeholder="min"
            autoFocus
            onChange={e => handleItemDurationChange(idx, e.target.value)}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Enter') setEditingTimeKey(null) }}
            title="Song length in minutes (0.25 = 15 sec)"
            aria-label={`Runtime for ${song.title || 'song'} in minutes`}
          />
          <button type="button" onClick={() => setEditingTimeKey(null)}>Done</button>
        </div>
      )
    }
    return (
      <button
        type="button"
        className="sl-duration-fixed"
        onClick={() => setEditingTimeKey(timeKey)}
        aria-label={`Change runtime for ${song.title || 'song'}`}
        title="Change runtime"
      >
        <span>{song.duration ? fmtSongDur(song.duration) : 'No time'}</span>
      </button>
    )
  }

  const libQ = libQuery.trim().toLowerCase()
  const displayLibrary = [...library]
    .sort((a, b) => {
      const ad = a.meta?.draft ? 1 : 0, bd = b.meta?.draft ? 1 : 0
      if (ad !== bd) return ad - bd
      return (a.title || '').localeCompare(b.title || '')
    })
    .filter(s => showDrafts || !s.meta?.draft)
    .filter(s => !libQ
      || (s.title || '').toLowerCase().includes(libQ)
      || (s.meta?.writer || '').toLowerCase().includes(libQ))

  return (
    <div className="sl-layout">

      {/* ── Left: performance history sidebar ── */}
      <div className="sl-sidebar">
        <div className="sl-sidebar-header">
          <span className="sl-sidebar-eyebrow">Show Builder</span>
          <h2>Shows</h2>
          <p>Plan the night. Share the same page.</p>
          <button className="cc-btn-solid" onClick={startNew}>New Show</button>
        </div>

        <div style={{ paddingTop: '0.75rem' }}>
          {loadingList ? (
            <p className="cc-hint">Loading…</p>
          ) : setlists.length === 0 ? (
            <p className="cc-hint">No shows yet — create one!</p>
          ) : (
            <>
              <SidebarSection
                title="Upcoming"
                items={upcoming}
                activeId={active?.id}
                onOpen={openForEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
              <SidebarSection
                title="Past Performances"
                items={past}
                activeId={active?.id}
                onOpen={openForEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Right: editor ── */}
      {editing ? (
        <div className="sl-editor">

          {/* Sticky header */}
          <div className="sl-editor-header">
            <div className="sl-editor-heading">
              <span className="sl-editor-kicker">Current show</span>
              <button
                type="button"
                className="sl-editor-name sl-editor-name-btn"
                onClick={focusNameField}
                title="Click to rename this show"
              >
                {name || 'Untitled Show'} <span className="sl-rename-pencil">Rename</span>
              </button>
              {/* Quick-jump dropdown */}
              {setlists.length > 0 && (
                <select
                  className="sl-jump-select"
                  value={active?.id || ''}
                  onChange={handleDropdownChange}
                  title="Jump to a different show"
                >
                  <option value="">Jump to…</option>
                  {upcoming.length > 0 && (
                    <optgroup label="Upcoming">
                      {upcoming.map(sl => (
                        <option key={sl.id} value={sl.id}>
                          {sl.event_date ? fmtDate(sl.event_date) + ' · ' : ''}{sl.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {past.length > 0 && (
                    <optgroup label="Past Performances">
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
                {saving ? 'Saving…' : 'Save Show'}
              </button>
              {items.length > 0 && (
                <button className="cc-btn-ghost" onClick={handlePrintSetList} title="Print a song-order reference sheet">
                  Print Setlist
                </button>
              )}
              {chartSongCount > 0 && (
                <button
                  className="cc-btn-ghost"
                  onClick={handlePrintOriginalCharts}
                  title="Reload and print every current saved song directly from your Chord Chart library."
                >
                  Print Charts
                </button>
              )}
              {items.length > 0 && (
                <button
                  className="cc-btn-ghost"
                  onClick={handleCopyBandLink}
                  title="Copy a read-only packet with setlists, charts, notes, breaks, and outside songs"
                >
                  Copy Band Link
                </button>
              )}
              {saveMsg  && <span className={saveMsg.startsWith('Error') ? 'cc-unsaved' : 'cc-save-msg'}>{saveMsg}</span>}
              {dirty && !saveMsg && <span className="cc-unsaved">● unsaved</span>}
            </div>
          </div>

          {/* Body */}
          <div className="sl-body">
            <div className="sl-order-panel">

              {/* Show name */}
              <label className="sl-name-label">
                <span>Show name</span>
                <input
                  ref={nameRef}
                  className="sl-name-field"
                  value={name}
                  onChange={e => { setName(e.target.value); setDirty(true) }}
                  placeholder="Show name… (venue, event, date)"
                />
              </label>

              {/* Event details card */}
              <div className="sl-event-card">
                <div className="sl-panel-title sl-numbered-title"><span>01</span> Event Details</div>
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
              <div className="sl-panel-header sl-order-header">
                <span className="sl-panel-title sl-numbered-title">
                  <span>02</span> Run of Show · {songCount} song{songCount !== 1 ? 's' : ''}
                  {setCount > 0 ? ` · ${setCount} set${setCount !== 1 ? 's' : ''}` : ''}
                  {breakCount > 0 ? ` · ${breakCount} break${breakCount !== 1 ? 's' : ''}` : ''}
                  {noteCount > 0 ? ` · ${noteCount} note${noteCount !== 1 ? 's' : ''}` : ''}
                </span>
                <div className="sl-order-toolbar">
                  {songCount > 0 && (
                    <button
                      className="sl-order-sync"
                      onClick={handleSyncAll}
                      disabled={saving}
                      title="Pull latest edits from your chord chart library"
                    >
                      Sync Charts
                    </button>
                  )}
                  <div className="sl-order-add-group">
                    <span className="sl-order-group-label">Add to show</span>
                    <button className="sl-order-add" onClick={handleAddSet} title="Add a named set divider; song numbering restarts in each set">
                      Set
                    </button>
                    <button className="sl-order-add" onClick={handleAddBreak}>
                      Break
                    </button>
                    <button className="sl-order-add" onClick={handleAddNote} title="Add a note or announcement reminder">
                      Note
                    </button>
                    <button className="sl-order-add outside" onClick={handleAddCustomSong} title="Add a timed song that is not in your chart library">
                      Outside Song
                    </button>
                    <button className={`sl-order-add primary${showLib ? ' active' : ''}`} onClick={() => setShowLib(p => !p)}>
                      {showLib ? 'Hide Library' : '+ Add Songs'}
                    </button>
                  </div>
                </div>
              </div>

              {totalMins > 0 && (
                <div className="sl-time-summary">
                  <span className="sl-time-label">Estimated run time</span>
                  <span className="sl-time-total">~{fmtDuration(totalMins)}</span>
                  <span className="sl-time-detail">
                    {songCount} song{songCount !== 1 ? 's' : ''}
                    {breakCount > 0 ? ` · ${breakCount} break${breakCount !== 1 ? 's' : ''}` : ''}
                  </span>
                </div>
              )}

              {items.length === 0 ? (
                <div className="sl-empty">
                  No songs yet — click <strong>+ Add Songs</strong> to pick from your library
                </div>
              ) : (
                <div className={`sl-song-list${setCount > 0 ? ' sl-set-columns' : ''}`}>
                  {setColumns.map(column => (
                    <div key={column.key} className={`sl-set-column${column.named ? ' named' : ''}`}>
                    {column.rows.map(({ song, idx }) => {
                    const dragClass = `${dragIdx === idx ? ' sl-dragging' : ''}${dragOverIdx === idx && dragIdx !== idx ? ' sl-drag-over' : ''}`
                    const dragProps = {
                      draggable: true,
                      onDragStart: e => handleDragStart(e, idx),
                      onDragOver:  e => handleDragOver(e, idx),
                      onDrop:      e => handleDrop(e, idx),
                      onDragEnd:   handleDragEnd,
                    }
                    if (song._type === 'set') {
                      const stats = setStats[idx] || { songs: 0, mins: 0 }
                      return (
                        <div key={idx} className={`sl-set-row${dragClass}`} {...dragProps}>
                          <span className="sl-drag-handle" title="Drag to reorder">⠿</span>
                          <span className="sl-row-kind">Set</span>
                          <input
                            className="sl-set-label-input"
                            value={song.label || ''}
                            placeholder="Set name…"
                            onChange={e => handleBreakLabelChange(idx, e.target.value)}
                            onClick={e => e.stopPropagation()}
                          />
                          <span className="sl-set-stats">
                            {stats.songs} song{stats.songs !== 1 ? 's' : ''}
                            {stats.mins > 0 ? ` · ~${fmtDuration(stats.mins)}` : ''}
                          </span>
                          <button className="cc-lib-delete" onClick={() => handleDeleteSet(idx)} title="Delete this set and the songs in it">✕</button>
                        </div>
                      )
                    }
                    if (song._type === 'break') {
                      return (
                        <div key={idx} className={`sl-break-row${dragClass}`} {...dragProps}>
                          <span className="sl-drag-handle" title="Drag to reorder">⠿</span>
                          <span className="sl-row-kind">Break</span>
                          <input
                            className="sl-break-label-input"
                            value={song.label || 'Break'}
                            onChange={e => handleBreakLabelChange(idx, e.target.value)}
                            onClick={e => e.stopPropagation()}
                          />
                          <input
                            type="number"
                            className="sl-duration-input"
                            value={song.duration ?? 15}
                            min="0.25" max="180" step="0.25"
                            onChange={e => handleItemDurationChange(idx, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            title="Break length in minutes (0.25 = 15 sec)"
                          />
                          <span className="sl-duration-unit">min</span>
                          <button className="cc-lib-delete" onClick={() => handleRemove(idx)} title="Remove break">✕</button>
                        </div>
                      )
                    }
                    if (song._type === 'note') {
                      return (
                        <div key={idx} className={`sl-note-row${dragClass}`} {...dragProps}>
                          <span className="sl-drag-handle" title="Drag to reorder">⠿</span>
                          <span className="sl-row-kind">Note</span>
                          <div className="sl-note-body">
                            <input
                              className="sl-note-label-input"
                              value={song.label || ''}
                              placeholder="Note title (e.g. Announcement)…"
                              onChange={e => handleBreakLabelChange(idx, e.target.value)}
                              onClick={e => e.stopPropagation()}
                            />
                            <textarea
                              className="sl-note-text-input"
                              value={song.text || ''}
                              placeholder="Type or paste what you don't want to forget — thank the venue, mention merch, introduce the band…"
                              rows={2}
                              onChange={e => handleNoteTextChange(idx, e.target.value)}
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                          <button className="cc-lib-delete" onClick={() => handleRemove(idx)} title="Remove note">✕</button>
                        </div>
                      )
                    }
                    if (song._type === CUSTOM_SONG_TYPE) {
                      const isUploading = uploadingPdf === song._customId
                      return (
                        <div key={song._customId || idx} className={`sl-song-row sl-custom-song-row${dragClass}`} {...dragProps}>
                          <span className="sl-drag-handle" title="Drag to reorder">⠿</span>
                          <span className="sl-song-num">{songNums[idx]}.</span>
                          <div className="sl-song-info sl-custom-song-info">
                            <input
                              className="sl-custom-title-input"
                              value={song.title || ''}
                              placeholder="Song title"
                              onChange={e => handleCustomTitleChange(idx, e.target.value)}
                              onClick={e => e.stopPropagation()}
                            />
                            <div className="sl-custom-song-meta">
                              <span className="sl-outside-badge">Outside library</span>
                              {song.pdf && <span className="sl-pdf-name">{song.pdf.name || 'Attached PDF'}</span>}
                              <label className={`sl-pdf-action${isUploading ? ' disabled' : ''}`} onClick={e => e.stopPropagation()}>
                                {isUploading ? 'Uploading...' : song.pdf ? 'Replace PDF' : 'Attach PDF'}
                                <input
                                  className="sl-pdf-file-input"
                                  type="file"
                                  accept="application/pdf,.pdf"
                                  disabled={isUploading}
                                  onChange={e => {
                                    const file = e.target.files?.[0]
                                    e.target.value = ''
                                    handleCustomPdfChange(idx, file)
                                  }}
                                />
                              </label>
                              {song.pdf && (
                                <button className="sl-pdf-remove" onClick={() => handleRemovePdf(idx)} type="button">
                                  Remove PDF
                                </button>
                              )}
                            </div>
                          </div>
                          {renderSongTime(song, idx)}
                          <div className="sl-song-controls">
                            <button className="cc-lib-delete" onClick={() => handleRemove(idx)} title="Remove from set">✕</button>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div key={idx} className={`sl-song-row${dragClass}`} {...dragProps}>
                        <span className="sl-drag-handle" title="Drag to reorder">⠿</span>
                        <span className="sl-song-num">{songNums[idx]}.</span>
                        <div className="sl-song-info">
                          <div className="sl-song-title">{song.title || 'Untitled'}</div>
                          {song.meta?.key && (
                            <div className="sl-song-key">
                              Key: {song.meta.key}{song.meta.capo ? ` · Capo ${song.meta.capo}` : ''}
                              {song.meta?.writer ? ` · ${song.meta.writer}` : ''}
                            </div>
                          )}
                        </div>
                        {renderSongTime(song, idx)}
                        <div className="sl-song-controls">
                          <button className="cc-lib-delete" onClick={() => handleRemove(idx)} title="Remove from set">✕</button>
                        </div>
                      </div>
                    )
                    })}
                    </div>
                  ))}
                </div>
              )}

              <div className="sl-mobile-addbar" aria-label="Show editing tools">
                <button className="sl-mobile-add-primary" onClick={() => setShowLib(p => !p)}>
                  {showLib ? 'Close Library' : '+ Library Song'}
                </button>
                <button className="sl-mobile-add-primary secondary" onClick={handleAddCustomSong}>+ Outside Song</button>
                <button onClick={handleAddSet} title="Add set divider">+ Set</button>
                <button onClick={handleAddBreak} title="Add break">+ Break</button>
                <button onClick={handleAddNote} title="Add note">+ Note</button>
              </div>
            </div>

            {/* Library picker */}
            {showLib && (
              <>
              <button className="sl-lib-backdrop" onClick={() => setShowLib(false)} aria-label="Close song library" />
              <div className="sl-lib-panel">
                <div className="sl-lib-sheet-handle" aria-hidden="true" />
                <div className="sl-panel-header">
                  <span className="sl-panel-title">Your Song Library</span>
                  <div className="sl-lib-header-actions">
                    <button
                      className="cc-btn-ghost"
                      style={{ fontSize: '0.7rem' }}
                      onClick={() => setShowDrafts(p => !p)}
                      title="Show or hide draft songs"
                    >
                      {showDrafts ? 'Hide Drafts' : 'Show Drafts'}
                    </button>
                    <button className="sl-lib-close" onClick={() => setShowLib(false)}>Close</button>
                  </div>
                </div>
                <input
                  className="sl-lib-search"
                  type="search"
                  value={libQuery}
                  onChange={e => setLibQuery(e.target.value)}
                  placeholder="Search songs…"
                />
                {loadingLib ? (
                  <p className="cc-hint" style={{ padding: '0.75rem' }}>Loading…</p>
                ) : displayLibrary.length === 0 ? (
                  <p className="cc-hint" style={{ padding: '0.75rem' }}>
                    {libQ ? 'No songs match your search.' : 'No saved songs yet.'}
                  </p>
                ) : (
                  displayLibrary.map(song => {
                    const inSet = items.some(it => it._songId === song.id)
                    return (
                      <div key={song.id} className={`sl-lib-row${inSet ? ' in-set' : ''}${song.meta?.draft ? ' draft' : ''}`}>
                        <span className="sl-lib-title">{song.meta?.draft ? '✏ ' : ''}{song.title || 'Untitled'}</span>
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
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="sl-empty-state">
          <span className="sl-empty-kicker">Show Builder</span>
          <h2>Build the night from one place.</h2>
          <p>Select a show from the archive or create a new one.</p>
          <button className="cc-btn-solid" onClick={startNew}>New Show</button>
        </div>
      )}
    </div>
  )
}
