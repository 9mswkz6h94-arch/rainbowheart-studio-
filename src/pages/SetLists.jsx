import { useState, useEffect, useCallback, useRef } from 'react'
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

function SidebarSection({ title, items, activeId, onOpen, onDelete, onDuplicate }) {
  if (items.length === 0) return null
  return (
    <div className="sl-section">
      <div className="sl-section-label">{title}</div>
      {items.map(sl => {
        const songCount = (sl.songs || []).filter(s => !s._type).length
        return (
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
                {songCount} song{songCount !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              className="sl-dup-btn"
              onClick={e => { e.stopPropagation(); onDuplicate(sl) }}
              title="Duplicate show"
            >⧉</button>
            <button
              className="cc-lib-delete"
              onClick={e => { e.stopPropagation(); onDelete(sl.id, sl.name, e) }}
              title="Delete"
            >✕</button>
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
  const [shareMsg,    setShareMsg]    = useState(null)
  const [showLib,     setShowLib]     = useState(false)
  const [showDrafts,  setShowDrafts]  = useState(false)
  const [libQuery,    setLibQuery]    = useState('')
  const [dragIdx,     setDragIdx]     = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
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

  function handleBreakLabelChange(idx, val) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, label: val } : it))
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

  function handlePrintSetList() {
    const w = window.open('', '_blank')
    if (!w) return
    let sn = 0, printTotal = 0, rows = ''
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const dur = parseFloat(item.duration) || 0
      printTotal += dur
      if (item._type === 'set') {
        sn = 0
        const stats = setStats[i] || { songs: 0, mins: 0 }
        const sub = stats.mins > 0 ? `~${fmtDuration(stats.mins)}` : ''
        rows += `<tr class="set-row"><td></td><td colspan="2">${item.label || 'Set'}</td><td class="dur">${sub}</td></tr>`
      } else if (item._type === 'break') {
        const durStr = dur ? fmtSongDur(dur) : ''
        rows += `<tr class="break-row"><td colspan="3">— ${item.label || 'Break'} —</td><td class="dur">${durStr}</td></tr>`
      } else {
        sn++
        const key = item.meta?.key
          ? `Key of ${item.meta.key}${item.meta.capo ? ` · Capo ${item.meta.capo}` : ''}`
          : ''
        const writer = item.meta?.writer ? item.meta.writer : ''
        const durStr = dur ? fmtSongDur(dur) : ''
        rows += `<tr><td class="num">${sn}.</td><td class="title">${item.title || 'Untitled'}${writer ? `<span class="writer"> — ${writer}</span>` : ''}</td><td class="key">${key}</td><td class="dur">${durStr}</td></tr>`
      }
    }
    const totalStr = printTotal > 0 ? fmtDuration(printTotal) : ''
    const dateStr = eventDate ? fmtDate(eventDate) : ''
    w.document.write(`<!DOCTYPE html><html><head><title>${name}</title><style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Space Mono', 'Courier New', monospace; padding: 2rem; color: #111; }
      h1 { font-size: 1.6rem; margin-bottom: 0.25rem; }
      .sub { color: #555; font-size: 0.85rem; margin-bottom: 0.15rem; }
      .total-badge { display: inline-block; margin-top: 0.5rem; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; padding: 0.3rem 0.75rem; font-size: 0.9rem; font-weight: 700; }
      .details { color: #555; font-size: 0.82rem; white-space: pre-wrap; margin-bottom: 1.5rem; margin-top: 0.75rem; border-left: 3px solid #ddd; padding-left: 0.75rem; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      tr { border-bottom: 1px solid #eee; }
      td { padding: 0.5rem 0.5rem; vertical-align: top; }
      .num { width: 2.5rem; font-weight: 700; color: #888; }
      .title { font-weight: 600; font-size: 0.95rem; }
      .writer { font-weight: 400; color: #888; font-size: 0.82rem; }
      .key { color: #555; font-size: 0.82rem; white-space: nowrap; }
      .dur { color: #888; font-size: 0.82rem; text-align: right; white-space: nowrap; width: 3rem; }
      tr.break-row td { text-align: center; color: #888; font-style: italic; font-size: 0.85rem; padding: 0.6rem; border-bottom: 2px dashed #ccc; }
      tr.break-row .dur { text-align: right; font-style: normal; }
      tr.set-row td { font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.95rem; padding-top: 1.1rem; border-bottom: 2px solid #111; }
      tr.set-row .dur { font-weight: 400; }
      .total-row td { border-top: 2px solid #111; font-weight: 700; padding-top: 0.6rem; }
      @media print { body { padding: 1rem; } }
    </style></head><body>
      <h1>${name}</h1>
      ${dateStr ? `<div class="sub">📅 ${dateStr}</div>` : ''}
      ${eventUrl ? `<div class="sub">🔗 ${eventUrl}</div>` : ''}
      ${totalStr ? `<div class="sub" style="margin-top:0.4rem">⏱ ~${totalStr} total</div>` : ''}
      ${eventDetails ? `<div class="details">${eventDetails.replace(/</g, '&lt;')}</div>` : ''}
      <table><tbody>${rows}${totalStr ? `<tr class="total-row"><td></td><td>Total</td><td></td><td class="dur">~${totalStr}</td></tr>` : ''}</tbody></table>
    </body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 200)
  }

  const editing = active !== null

  /* Song numbering restarts at each named set */
  let _sn = 0, _songTotal = 0
  const songNums = items.map(it => {
    if (it._type === 'set') { _sn = 0; return null }
    if (it._type) return null
    _songTotal++
    return ++_sn
  })
  const songCount  = _songTotal
  const breakCount = items.filter(it => it._type === 'break').length
  const setCount   = items.filter(it => it._type === 'set').length
  const totalMins = items.reduce((s, it) => s + (parseFloat(it.duration) || 0), 0)

  /* Per-set song count + running time, keyed by the set header's index */
  const setStats = {}
  {
    let cur = null
    items.forEach((it, i) => {
      if (it._type === 'set') { cur = i; setStats[i] = { songs: 0, mins: 0 }; return }
      if (cur === null) return
      setStats[cur].mins += parseFloat(it.duration) || 0
      if (!it._type) setStats[cur].songs++
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
        <div className="cc-input-header" style={{ margin: '-1.25rem -1.25rem 0', padding: '1rem 1.25rem 0.75rem' }}>
          <div className="cc-header-row">
            <h2 style={{ fontSize: '1rem', margin: 0 }}>🎤 Shows</h2>
          </div>
          <div className="cc-savebar">
            <button className="cc-btn-solid" onClick={startNew}>+ New Show</button>
          </div>
        </div>

        <div style={{ paddingTop: '0.75rem' }}>
          {loadingList ? (
            <p className="cc-hint">Loading…</p>
          ) : setlists.length === 0 ? (
            <p className="cc-hint">No shows yet — create one!</p>
          ) : (
            <>
              <SidebarSection
                title="📅 Upcoming"
                items={upcoming}
                activeId={active?.id}
                onOpen={openForEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
              <SidebarSection
                title="✓ Past Performances"
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
          <div className="cc-input-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', margin: 0, padding: '1rem 1.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
            <div className="cc-header-row" style={{ gap: '0.75rem' }}>
              <span
                className="sl-editor-name sl-editor-name-btn"
                onClick={focusNameField}
                title="Click to rename this show"
              >
                {name || 'Untitled Show'} <span className="sl-rename-pencil">✏</span>
              </span>
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
                {saving ? 'Saving…' : 'Save Show'}
              </button>
              {items.length > 0 && (
                <button className="cc-btn-ghost" onClick={handlePrintSetList} title="Print a song-order reference sheet">
                  🖨 Print Set
                </button>
              )}
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

              {/* Show name */}
              <label className="sl-name-label">
                <span>✏ Show name</span>
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
                <span className="sl-panel-title">
                  Set Order · {songCount} song{songCount !== 1 ? 's' : ''}
                  {setCount > 0 ? ` · ${setCount} set${setCount !== 1 ? 's' : ''}` : ''}
                  {breakCount > 0 ? ` · ${breakCount} break${breakCount !== 1 ? 's' : ''}` : ''}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {songCount > 0 && (
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
                    onClick={handleAddSet}
                    title="Add a named set divider (Set 1, Set 2, Encore…) — song numbering restarts each set"
                  >
                    🎼 Add Set
                  </button>
                  <button
                    className="cc-btn-ghost"
                    style={{ fontSize: '0.75rem' }}
                    onClick={handleAddBreak}
                  >
                    ☕ Add Break
                  </button>
                  <button
                    className="cc-btn-ghost"
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => setShowLib(p => !p)}
                  >
                    {showLib ? 'Hide Library' : '+ Add Songs'}
                  </button>
                </div>
              </div>

              {totalMins > 0 && (
                <div className="sl-time-summary">
                  <span className="sl-time-icon">⏱</span>
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
                <div className="sl-song-list">
                  {items.map((song, idx) => {
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
                          <span className="sl-set-icon">🎼</span>
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
                          <span className="sl-break-icon">☕</span>
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
                        <input
                          type="number"
                          className="sl-duration-input"
                          value={song.duration ?? ''}
                          min="0.25" max="20" step="0.25"
                          placeholder="min"
                          onChange={e => handleItemDurationChange(idx, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          title="Song length in minutes (0.25 = 15 sec)"
                        />
                        {song.duration ? <span className="sl-dur-badge">{fmtSongDur(song.duration)}</span> : null}
                        <div className="sl-song-controls">
                          <button className="cc-lib-delete" onClick={() => handleRemove(idx)} title="Remove from set">✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Library picker */}
            {showLib && (
              <div className="sl-lib-panel">
                <div className="sl-panel-header">
                  <span className="sl-panel-title">Your Song Library</span>
                  <button
                    className="cc-btn-ghost"
                    style={{ fontSize: '0.7rem' }}
                    onClick={() => setShowDrafts(p => !p)}
                    title="Show or hide draft songs"
                  >
                    {showDrafts ? 'Hide Drafts' : 'Show Drafts'}
                  </button>
                </div>
                <input
                  className="sl-lib-search"
                  type="search"
                  value={libQuery}
                  onChange={e => setLibQuery(e.target.value)}
                  placeholder="🔍 Search songs…"
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
            )}
          </div>
        </div>
      ) : (
        <div className="sl-empty-state">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎵</div>
          <div>Select a show or create a new one</div>
        </div>
      )}
    </div>
  )
}
