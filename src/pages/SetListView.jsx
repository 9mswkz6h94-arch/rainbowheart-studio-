import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { fetchSetListByToken } from '../lib/setlists'
import { parseSong, layout, fitTitles, rescale } from '../lib/chartEngine'

export default function SetListView() {
  const { token } = useParams()

  const [setlist,    setSetlist]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [songIdx,    setSongIdx]    = useState(0)
  const [printing,   setPrinting]   = useState(false)
  const [darkCharts, setDarkCharts] = useState(() => {
    try { return localStorage.getItem('slv-dark-charts') === '1' } catch { return false }
  })

  const measureRef = useRef(null)
  const stageRef   = useRef(null)

  /* ── Fetch setlist by share token ── */
  useEffect(() => {
    async function load() {
      try {
        const sl = await fetchSetListByToken(token)
        setSetlist(sl)
      } catch (e) {
        setError('Show not found or the link may be incorrect.')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  /* ── Render a single song into the stage ── */
  const renderSong = useCallback(async (idx) => {
    if (!setlist || !measureRef.current || !stageRef.current) return
    const song = setlist.songs[idx]
    if (!song || song._type) return

    await document.fonts.ready

    const parsed = parseSong(song.song_text || '', song.meta || {})
    const opts   = { compact: true, collapse: true, writeBars: true }
    const { html } = layout(parsed, 'full', opts, measureRef.current)

    stageRef.current.className = 'stagewrap compact'
    stageRef.current.innerHTML = html
    fitTitles(stageRef.current)
    rescale(stageRef.current)
  }, [setlist])

  useEffect(() => {
    if (setlist) renderSong(songIdx)
  }, [setlist, songIdx, renderSong])

  /* ── Window resize ── */
  useEffect(() => {
    const handler = () => { if (stageRef.current) rescale(stageRef.current) }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  /* ── Update tab title ── */
  useEffect(() => {
    if (setlist) {
      const item = setlist.songs[songIdx]
      if (item?._type) {
        document.title = `${item.label || (item._type === 'set' ? 'Set' : 'Break')} — ${setlist.name}`
      } else if (item) {
        document.title = `${item.title} — ${setlist.name}`
      } else {
        document.title = setlist.name
      }
    }
    return () => { document.title = 'Rainbow Hearts Chart Studio' }
  }, [setlist, songIdx])

  /* ── Print all charts (skip breaks) ── */
  async function handlePrintAll() {
    if (!setlist || !measureRef.current || !stageRef.current) return
    setPrinting(true)
    await document.fonts.ready

    let allHtml = ''
    for (const song of setlist.songs) {
      if (song._type) continue
      const parsed = parseSong(song.song_text || '', song.meta || {})
      const opts   = { compact: true, collapse: true, writeBars: true }
      allHtml += layout(parsed, 'full', opts, measureRef.current).html
    }

    stageRef.current.className = 'stagewrap compact'
    stageRef.current.innerHTML = allHtml
    fitTitles(stageRef.current)

    const prevTitle = document.title
    document.title  = setlist.name

    window.addEventListener('afterprint', function done() {
      window.removeEventListener('afterprint', done)
      document.title = prevTitle
      setPrinting(false)
      renderSong(songIdx)
    }, { once: true })

    setTimeout(() => window.print(), 80)
  }

  /* ── Nav helpers ── */
  function goPrev() { setSongIdx(i => Math.max(0, i - 1)) }
  function goNext() { setSongIdx(i => Math.min((setlist?.songs.length ?? 1) - 1, i + 1)) }

  /* ── Keyboard navigation ──
     PageDown/PageUp cover Bluetooth page-turner pedals (AirTurn, Donner, etc.) */
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPrev()
      if (e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); goNext() }
      if (e.key === 'PageUp')                    { e.preventDefault(); goPrev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ── Keep the screen awake during a performance ── */
  useEffect(() => {
    let lock = null
    async function acquire() {
      try { lock = await navigator.wakeLock?.request('screen') } catch { /* unsupported or denied — fine */ }
    }
    function onVis() { if (document.visibilityState === 'visible') acquire() }
    acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      try { lock?.release() } catch { /* already released */ }
    }
  }, [])

  function toggleDarkCharts() {
    setDarkCharts(d => {
      try { localStorage.setItem('slv-dark-charts', d ? '0' : '1') } catch { /* private mode */ }
      return !d
    })
  }

  /* ── States ── */
  if (loading) return (
    <div className="slv-loading">
      <div className="slv-spinner" />
      <p>Loading show…</p>
    </div>
  )

  if (error) return (
    <div className="slv-loading">
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎵</div>
      <p style={{ color: '#ff6b6b' }}>{error}</p>
    </div>
  )

  const songs   = setlist?.songs || []
  const total   = songs.length
  const current = songs[songIdx]
  const isBreak = current?._type === 'break'
  const isSet   = current?._type === 'set'

  const songsOnly    = songs.filter(s => !s._type)
  const songPosition = current?._type
    ? null
    : songs.slice(0, songIdx + 1).filter(s => !s._type).length

  /* Current named set (if this setlist uses set dividers) */
  let setStart = -1
  for (let i = songIdx; i >= 0; i--) {
    if (songs[i]._type === 'set') { setStart = i; break }
  }
  let setEnd = songs.length
  for (let i = setStart + 1; i < songs.length; i++) {
    if (songs[i]._type === 'set') { setEnd = i; break }
  }
  const setLabel     = setStart >= 0 ? (songs[setStart].label || 'Set') : null
  const setSongCount = setStart >= 0 ? songs.slice(setStart + 1, setEnd).filter(s => !s._type).length : 0
  const posInSet     = setStart >= 0 && !current?._type
    ? songs.slice(setStart + 1, songIdx + 1).filter(s => !s._type).length
    : null

  const positionText = isBreak
    ? (current.label || 'Break')
    : isSet
      ? (current.label || 'Set')
      : setLabel && posInSet != null
        ? `${setLabel} · ${posInSet} / ${setSongCount}`
        : songPosition != null
          ? `${songPosition} / ${songsOnly.length}`
          : '—'

  /* First song of the set we're standing on (for the divider screen) */
  const upNext = isSet ? songs.slice(songIdx + 1, setEnd).find(s => !s._type) : null

  return (
    <div className={`slv-root${darkCharts ? ' slv-dark' : ''}`}>

      {/* Hidden off-screen measure div for layout engine */}
      <div
        ref={measureRef}
        style={{ position: 'fixed', left: '-99999px', top: 0, overflow: 'visible', pointerEvents: 'none' }}
        aria-hidden="true"
      />

      {/* ── Top bar ── */}
      <div className="slv-topbar">
        <div className="slv-set-name">{setlist.name}</div>
        <div className="slv-position">{positionText}</div>
        <button
          className="slv-print-btn"
          onClick={toggleDarkCharts}
          title="Toggle dark charts for dim stages"
        >
          {darkCharts ? '☀ Light' : '🌙 Dark'}
        </button>
        <button
          className="slv-print-btn"
          onClick={handlePrintAll}
          disabled={printing || songsOnly.length === 0}
        >
          {printing ? 'Preparing…' : '🖨 Print All Charts'}
        </button>
      </div>

      {/* ── Chart stage ── */}
      <div className="slv-stage-wrap">
        {total === 0 ? (
          <div className="slv-no-songs">This show has no songs yet.</div>
        ) : isBreak ? (
          <div className="slv-break-screen">
            <div className="slv-break-icon">☕</div>
            <div className="slv-break-label">{current.label || 'Break'}</div>
          </div>
        ) : isSet ? (
          <div className="slv-break-screen">
            <div className="slv-break-icon">🎼</div>
            <div className="slv-break-label slv-set-label-view">{current.label || 'Set'}</div>
            <div className="slv-set-meta">
              {setSongCount} song{setSongCount !== 1 ? 's' : ''}
            </div>
            {upNext && <div className="slv-set-next">Up first: {upNext.title || 'Untitled'}</div>}
          </div>
        ) : (
          <div ref={stageRef} className="stagewrap compact" />
        )}
      </div>

      {/* ── Bottom nav ── */}
      {total > 0 && (
        <div className="slv-nav">
          <button
            className={`slv-nav-btn${songIdx === 0 ? ' disabled' : ''}`}
            onClick={goPrev}
            disabled={songIdx === 0}
          >
            ← Prev
          </button>

          <div className="slv-song-dots">
            {songs.map((s, i) => (
              <button
                key={i}
                className={`slv-dot${i === songIdx ? ' active' : ''}${s._type === 'break' ? ' break' : ''}${s._type === 'set' ? ' set' : ''}`}
                onClick={() => setSongIdx(i)}
                title={s._type === 'break' ? (s.label || 'Break') : s._type === 'set' ? (s.label || 'Set') : s.title}
              />
            ))}
          </div>

          <button
            className={`slv-nav-btn${songIdx === total - 1 ? ' disabled' : ''}`}
            onClick={goNext}
            disabled={songIdx === total - 1}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
