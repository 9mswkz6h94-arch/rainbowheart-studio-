import { useState, useEffect, useCallback } from 'react'
import { fetchSetLists, saveSetList, deleteSetList } from '../lib/setlists'
import { fetchSongs, fetchSong } from '../lib/songs'

const EMPTY = { id: null, token: null, name: '', songs: [] }

export default function SetLists() {
  const [setlists,    setSetlists]    = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [library,     setLibrary]     = useState([])
  const [loadingLib,  setLoadingLib]  = useState(true)

  /* Active set list being edited */
  const [active,  setActive]  = useState(null)   // null = nothing selected
  const [name,    setName]    = useState('')
  const [items,   setItems]   = useState([])      // [{_songId, title, song_text, meta}]
  const [dirty,   setDirty]   = useState(false)

  const [addingId,  setAddingId]  = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [saveMsg,   setSaveMsg]   = useState(null)
  const [shareMsg,  setShareMsg]  = useState(null)
  const [showLib,   setShowLib]   = useState(false)

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

  /* ── New / load for edit ── */
  function startNew() {
    setActive(EMPTY)
    setName('New Set List')
    setItems([])
    setDirty(false)
    setShowLib(true)
  }

  function openForEdit(sl) {
    setActive({ id: sl.id, token: sl.share_token })
    setName(sl.name)
    setItems(sl.songs || [])
    setDirty(false)
    setShowLib(false)
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

  /* ── Save ── */
  async function handleSave() {
    setSaving(true); setSaveMsg(null)
    try {
      const saved = await saveSetList({ id: active?.id || null, name, songs: items })
      setActive({ id: saved.id, token: saved.share_token })
      setDirty(false)
      setSaveMsg('Saved!')
      await refreshLists()
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (e) {
      setSaveMsg('Error saving')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  /* ── Delete ── */
  async function handleDelete(id, slName, e) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${slName}"?`)) return
    try {
      await deleteSetList(id)
      if (active?.id === id) { setActive(null); setName(''); setItems([]) }
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

      {/* ── Left: set list directory ── */}
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
            setlists.map(sl => (
              <div
                key={sl.id}
                className={`sl-list-item${active?.id === sl.id ? ' active' : ''}`}
                onClick={() => openForEdit(sl)}
              >
                <div>
                  <div className="sl-list-name">{sl.name}</div>
                  <div className="sl-list-meta">{(sl.songs || []).length} song{(sl.songs || []).length !== 1 ? 's' : ''}</div>
                </div>
                <button
                  className="cc-lib-delete"
                  onClick={e => handleDelete(sl.id, sl.name, e)}
                  title="Delete set list"
                >✕</button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right: editor ── */}
      {editing ? (
        <div className="sl-editor">

          {/* Sticky header */}
          <div className="cc-input-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', margin: 0, padding: '1rem 1.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
            <div className="cc-header-row">
              <input
                className="sl-name-input"
                value={name}
                onChange={e => { setName(e.target.value); setDirty(true) }}
                placeholder="Set list name"
              />
            </div>
            <div className="cc-savebar">
              <button className="cc-btn-solid cc-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Set List'}
              </button>
              {active?.token && <>
                <button className="cc-btn-ghost" onClick={handleShare}>Copy Share Link</button>
                <button className="cc-btn-ghost" onClick={handleOpenView}>Open Performer View ↗</button>
              </>}
              {saveMsg  && <span className="cc-save-msg">{saveMsg}</span>}
              {shareMsg && <span className="cc-save-msg">{shareMsg}</span>}
              {dirty && !saveMsg && <span className="cc-unsaved">● unsaved</span>}
            </div>
          </div>

          {/* Body: set order + library */}
          <div className="sl-body">

            {/* Set order */}
            <div className="sl-order-panel">
              <div className="sl-panel-header">
                <span className="sl-panel-title">Set Order · {items.length} song{items.length !== 1 ? 's' : ''}</span>
                <button
                  className="cc-btn-ghost"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => setShowLib(p => !p)}
                >
                  {showLib ? 'Hide Library' : '+ Add Songs'}
                </button>
              </div>

              {items.length === 0 ? (
                <div className="sl-empty">
                  No songs yet — click <strong>+ Add Songs</strong> to pick from your library
                </div>
              ) : (
                <div className="sl-song-list">
                  {items.map((song, idx) => (
                    <div key={idx} className="sl-song-row">
                      <span className="sl-song-num">{idx + 1}.</span>
                      <div className="sl-song-info">
                        <div className="sl-song-title">{song.title || 'Untitled'}</div>
                        {song.meta?.key && (
                          <div className="sl-song-key">Key: {song.meta.key}{song.meta.capo ? ` · Capo ${song.meta.capo}` : ''}</div>
                        )}
                      </div>
                      <div className="sl-song-controls">
                        <button
                          className="cc-step-btn"
                          onClick={() => handleMove(idx, -1)}
                          disabled={idx === 0}
                          title="Move up"
                        >↑</button>
                        <button
                          className="cc-step-btn"
                          onClick={() => handleMove(idx, 1)}
                          disabled={idx === items.length - 1}
                          title="Move down"
                        >↓</button>
                        <button
                          className="cc-lib-delete"
                          onClick={() => handleRemove(idx)}
                          title="Remove from set"
                        >✕</button>
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
                  <p className="cc-hint" style={{ padding: '0.75rem' }}>No saved songs yet — build some in the Chord Chart Studio first.</p>
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
