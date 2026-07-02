import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { fetchSetListByToken } from '../lib/setlists'
import { buildPresentSequence } from '../lib/presentSequence'
import { openDisplayChannel, closePresentChannel } from '../lib/presentChannel'
import { abbr } from '../lib/chartEngine'

/** Renders one cue item's content. `big` = full center panel, otherwise a condensed preview. */
function CueBody({ item, showChords, big }) {
  if (!item) return <div className="pd-blank">—</div>

  if (item.type === 'transition') {
    return (
      <div className="pd-transition">
        <div className="pd-transition-title">{item.title}</div>
        <div className="pd-transition-meta">
          {[item.key && `Key ${item.key}`, item.tempo && `♩ = ${item.tempo}`, item.meter]
            .filter(Boolean).join('  ·  ')}
        </div>
      </div>
    )
  }

  if (item.type === 'break' || item.type === 'set') {
    return <div className="pd-divider-label">{item.label}</div>
  }

  // Instrumental sections (intros, solos, instrumental hits) have no lyric lines at all —
  // fall back to the chord/rhythm content even in lyrics-only mode, otherwise the section
  // renders as a bare title with nothing underneath it.
  const useChords = showChords || item.lyricLines.length === 0

  return (
    <div className="pd-section">
      {big && <div className="pd-section-song">{item.songTitle}</div>}
      <div className="pd-section-label">{item.label}</div>
      <div className="pd-section-body">
        {useChords
          ? item.chordLines.map((ln, i) => (
              ln.type === 'rhythm'
                ? <div key={i} className="pd-line pd-rhythm">{ln.bars.map(b => b.map(([c]) => c).join(' ')).join(' | ')}</div>
                : (
                  // Mirrors the chart engine's own .line/.seg/.ch/.ly structure (chartEngine.js
                  // renderLine): a flex row of chord-over-lyric-fragment columns that wraps and
                  // reads as one continuous line, chord sitting directly above its word — not a
                  // stack of separate chord/lyric blocks.
                  <div key={i} className={`pd-chartline${ln.bold ? ' pd-bold' : ''}`}>
                    {ln.segs.map((s, j) => (
                      <span key={j} className="pd-seg">
                        <span className="pd-ch">{s.chord || ' '}</span>
                        <span className="pd-ly">{s.text}</span>
                      </span>
                    ))}
                  </div>
                )
            ))
          : item.lyricLines.map((ln, i) => (
              <div key={i} className={`pd-line${ln.bold ? ' pd-bold' : ''}`}>{ln.text}</div>
            ))}
      </div>
    </div>
  )
}

/** Chart-style "STRUCTURE" progress bar for the song currently playing — same abbreviations
 *  (V1, C, Br…) as the printed chart's own structure line, with the active section highlighted. */
function StructureHeader({ transition, activeIndex }) {
  if (!transition) return null
  return (
    <div className="pd-structure-bar">
      <span className="pd-structure-song">{transition.title}</span>
      {transition.structure.map((label, i) => (
        <span key={i} className={`pd-structure-item${i === activeIndex ? ' active' : ''}`}>
          {abbr(label)}
        </span>
      ))}
    </div>
  )
}

export default function PresentDisplay() {
  const { token } = useParams()

  const [setlist,    setSetlist]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [cueIndex,   setCueIndex]   = useState(0)
  const [showChords, setShowChords] = useState(false)
  const [connected,  setConnected]  = useState(false)

  useEffect(() => {
    async function load() {
      try {
        setSetlist(await fetchSetListByToken(token))
      } catch (e) {
        setError('Show not found or the link may be incorrect.')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const sequence = useMemo(() => setlist ? buildPresentSequence(setlist) : [], [setlist])

  /* Self-heals like the controller's channel: if this socket drops (tab backgrounded,
     wifi blip), reconnect automatically instead of sitting on a dead channel forever. */
  useEffect(() => {
    let cancelled = false
    let retryTimer = null
    let channel = null

    function connect() {
      channel = openDisplayChannel(token, state => {
        setConnected(true)
        if (typeof state.cueIndex === 'number') setCueIndex(state.cueIndex)
        if (typeof state.showChords === 'boolean') setShowChords(state.showChords)
      })
      channel.subscribe(status => {
        if (cancelled) return
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnected(false)
          closePresentChannel(channel)
          retryTimer = setTimeout(connect, 1500)
        }
      })
    }

    connect()
    return () => {
      cancelled = true
      clearTimeout(retryTimer)
      closePresentChannel(channel)
    }
  }, [token])

  /* ── Keep the screen awake ── */
  useEffect(() => {
    let lock = null
    async function acquire() {
      try { lock = await navigator.wakeLock?.request('screen') } catch { /* unsupported or denied */ }
    }
    function onVis() { if (document.visibilityState === 'visible') acquire() }
    acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      try { lock?.release() } catch { /* already released */ }
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
  }, [])

  if (loading) return <div className="pd-loading"><div className="pd-spinner" /><p>Loading show…</p></div>
  if (error)   return <div className="pd-loading"><p style={{ color: '#ff6b6b' }}>{error}</p></div>

  const total = sequence.length
  const current = sequence[cueIndex]
  const prev = cueIndex > 0 ? sequence[cueIndex - 1] : null
  const next = cueIndex < total - 1 ? sequence[cueIndex + 1] : null

  // Nearest transition at or before the current cue — anchors the structure progress bar
  // to whichever song is actually playing. Hidden entirely on break/set dividers, where
  // "which song's structure" doesn't apply.
  let activeTransition = null
  if (current && current.type !== 'break' && current.type !== 'set') {
    for (let i = cueIndex; i >= 0; i--) {
      if (sequence[i]?.type === 'transition') { activeTransition = sequence[i]; break }
    }
  }
  const activeSectionIndex = current?.type === 'section' ? current.sectionIndex : -1

  return (
    <div className="pd-root">
      <button className="pd-fullscreen-btn" onClick={toggleFullscreen} title="Toggle fullscreen">⛶</button>
      {!connected && <div className="pd-waiting">Waiting for controller…</div>}

      <StructureHeader transition={activeTransition} activeIndex={activeSectionIndex} />

      <div className="pd-layout">
        <div className="pd-side pd-prev">
          <div className="pd-side-tag">Just finished</div>
          <FitBox className="pd-fitbox" deps={[cueIndex, showChords, prev]}>
            <CueBody item={prev} showChords={showChords} />
          </FitBox>
        </div>

        <FitBox className="pd-center" deps={[cueIndex, showChords, current]}>
          <CueBody item={current} showChords={showChords} big />
        </FitBox>

        <div className="pd-side pd-next">
          <div className="pd-side-tag">Coming up</div>
          <FitBox className="pd-fitbox" deps={[cueIndex, showChords, next]}>
            <CueBody item={next} showChords={showChords} />
          </FitBox>
        </div>
      </div>
    </div>
  )
}

/**
 * Shrinks its content to fit the available height/width instead of letting a long section
 * (6–8 lines) overflow or clip off a stage monitor. Uses `zoom` (not `transform: scale`) so
 * the box itself shrinks and the browser reflows around it — same technique SetListView
 * already uses (`fitPerformerStage`) to fit chart pages to the screen. Scaling down the whole
 * already-wrapped block (rather than shrinking font-size directly) keeps the chart's line
 * breaks and proportions intact instead of causing it to rewrap into a different shape.
 * Used for the center panel and both side previews, so "just finished" and "coming up" are
 * always fully visible too, not just the current section.
 */
function FitBox({ children, deps, className }) {
  const outerRef = useRef(null)
  const innerRef = useRef(null)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    function fit() {
      inner.style.zoom = 1
      const availH = outer.clientHeight
      const availW = outer.clientWidth
      const needH  = inner.scrollHeight
      const needW  = inner.scrollWidth
      const scale  = Math.min(1, availH / (needH || 1), availW / (needW || 1))
      inner.style.zoom = Math.max(0.3, scale)
    }

    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return (
    <div className={className} ref={outerRef}>
      <div ref={innerRef} style={{ width: '100%' }}>{children}</div>
    </div>
  )
}
