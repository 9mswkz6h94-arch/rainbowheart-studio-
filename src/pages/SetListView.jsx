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

  const measureRef = useRef(null)
  const stageRef   = useRef(null)

  /* ── Fetch setlist by share token ── */
  useEffect(() => {
    async function load() {
      try {
        const sl = await fetchSetListByToken(token)
        setSetlist(sl)
      } catch (e) {
        setError('Set list not found or the link may be incorrect.')
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
    if (!song) return

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
      const song = setlist.songs[songIdx]
      document.title = song
        ? `${song.title} — ${setlist.name}`
        : setlist.name
    }
    return () => { document.title = 'Rainbow Hearts Chart Studio' }
  }, [setlist, songIdx])

  /* ── Print all charts ── */
  async function handlePrintAll() {
    if (!setlist || !measureRef.current || !stageRef.current) return
    setPrinting(true)
    await document.fonts.ready

    let allHtml = ''
    for (const song of setlist.songs) {
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

  /* ── Keyboard navigation ── */
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ── States ── */
  if (loading) return (
    <div className="slv-loading">
      <div className="slv-spinner" />
      <p>Loading set list…</p>
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

  return (
    <div className="slv-root">

      {/* Hidden off-screen measure div for layout engine */}
      <div
        ref={measureRef}
        style={{ position: 'fixed', left: '-99999px', top: 0, overflow: 'visible', pointerEvents: 'none' }}
        aria-hidden="true"
      />

      {/* ── Top bar ── */}
      <div className="slv-topbar">
        <div className="slv-set-name">{setlist.name}</div>
        <div className="slv-position">
          {current ? `${songIdx + 1} / ${total}` : '—'}
        </div>
        <button
          className="slv-print-btn"
          onClick={handlePrintAll}
          disabled={printing || total === 0}
        >
          {printing ? 'Preparing…' : '🖨 Print Full Set'}
        </button>
      </div>

      {/* ── Chart stage ── */}
      <div className="slv-stage-wrap">
        {total === 0 ? (
          <div className="slv-no-songs">This set list has no songs yet.</div>
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
                className={`slv-dot${i === songIdx ? ' active' : ''}`}
                onClick={() => setSongIdx(i)}
                title={s.title}
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
