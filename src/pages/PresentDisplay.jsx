import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { fetchSetListByToken } from '../lib/setlists'
import { buildPresentSequence } from '../lib/presentSequence'
import { openDisplayChannel, closePresentChannel } from '../lib/presentChannel'
import { abbr } from '../lib/chartEngine'
import { sectionKineticTheme, KineticWords } from '../lib/kineticType'
import FitBox from '../components/FitBox'

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

  if (item.type === 'note') {
    return (
      <div className="pd-note">
        <div className="pd-note-label">📝 {item.label}</div>
        <div className="pd-note-text">{item.text || '(empty note)'}</div>
      </div>
    )
  }

  // Instrumental sections (intros, solos, instrumental hits) have no lyric lines at all —
  // fall back to the chord/rhythm content even in lyrics-only mode, otherwise the section
  // renders as a bare title with nothing underneath it.
  const useChords = showChords || item.lyricLines.length === 0
  const theme = sectionKineticTheme(item.label)
  // Word-level stagger only makes sense in pure-lyrics mode, and only on the big center
  // panel - the side previews are condensed enough that per-word motion would just be noise.
  const kinetic = big && !useChords

  return (
    <div className="pd-section">
      {big && <div className="pd-section-song">{item.songTitle}</div>}
      <div className={`pd-section-label kt-label-${theme}`}>{item.label}</div>
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
                  <div
                    key={i}
                    className={`pd-chartline${ln.bold ? ' pd-bold' : ''}${big ? ` kt-block kt-${theme}` : ''}`}
                  >
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
              <div key={i} className={`pd-line${ln.bold ? ' pd-bold' : ''}`}>
                {kinetic ? <KineticWords text={ln.text} theme={theme} /> : ln.text}
              </div>
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

/** Full-show song list — always visible (unlike the structure bar, which hides on
 *  breaks/sets/notes), so you can see where you are in the whole set at a glance, not
 *  just within the current song. A single scrollable row rather than wrapping, so it stays
 *  compact regardless of setlist length; auto-scrolls the active song into view. */
function SongListHeader({ songList, activeSongIndex }) {
  const activeRef = useRef(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [activeSongIndex])

  if (!songList.length) return null
  return (
    <div className="pd-songlist-bar">
      {songList.map((s, i) => (
        <span
          key={s.songIndex}
          ref={s.songIndex === activeSongIndex ? activeRef : null}
          className={`pd-songlist-item${s.songIndex === activeSongIndex ? ' active' : ''}`}
        >
          {i + 1}. {s.title}
        </span>
      ))}
    </div>
  )
}

/**
 * A quiet visual metronome for the title/transition screen only — flashes both a thin bar at
 * the very bottom of the screen and a subtle background pulse once per beat, using the tempo
 * already pulled from the chart (meta.tempo/meter/note, same fields the printed chart's masthead
 * shows). Purely visual reference, not synced to real playback — restarts fresh each time the
 * transition screen appears. Re-keying the bar element every beat (rather than toggling a class)
 * is what makes the CSS flash-and-fade animation restart cleanly on each tick.
 */
function MetronomeBar({ tempo, tempoNote }) {
  const [beat, setBeat] = useState(0)

  useEffect(() => {
    const bpm = parseInt(tempo, 10)
    if (!bpm) return
    // chartEngine's own convention: a 'half' note tempo marking means the printed number
    // is a half-note beat, i.e. half the quarter-note BPM.
    const quarterBpm = tempoNote === 'half' ? bpm * 2 : bpm
    const beatMs = 60000 / quarterBpm
    const id = setInterval(() => setBeat(b => b + 1), beatMs)
    return () => clearInterval(id)
  }, [tempo, tempoNote])

  if (!parseInt(tempo, 10)) return null
  return (
    <>
      <div key={beat} className="pd-metronome-bar" />
      <div key={`bg-${beat}`} className="pd-metronome-pulse" />
    </>
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
  const songList = useMemo(() => (setlist?.songs || [])
    .map((s, songIndex) => ({ title: s.title || 'Untitled', songIndex, isReal: !s._type }))
    .filter(s => s.isReal), [setlist])

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
  // to whichever song is actually playing. Hidden entirely on break/set/note screens,
  // where "which song's structure" doesn't apply.
  let activeTransition = null
  if (current && !['break', 'set', 'note'].includes(current.type)) {
    for (let i = cueIndex; i >= 0; i--) {
      if (sequence[i]?.type === 'transition') { activeTransition = sequence[i]; break }
    }
  }
  const activeSectionIndex = current?.type === 'section' ? current.sectionIndex : -1

  // Nearest real song at or before the current cue — stays put through breaks/notes
  // between songs, and highlights the just-finished song rather than jumping to null.
  let activeSongIndex = null
  if (current) {
    for (const s of songList) {
      if (s.songIndex <= current.songIndex) activeSongIndex = s.songIndex
      else break
    }
  }

  return (
    <div className="pd-root">
      <button className="pd-fullscreen-btn" onClick={toggleFullscreen} title="Toggle fullscreen">⛶</button>
      {!connected && <div className="pd-waiting">Waiting for controller…</div>}

      <SongListHeader songList={songList} activeSongIndex={activeSongIndex} />
      <StructureHeader transition={activeTransition} activeIndex={activeSectionIndex} />

      <div className="pd-layout">
        <div className="pd-side pd-prev">
          <div className="pd-side-tag">Just finished</div>
          <FitBox className="pd-fitbox" deps={[cueIndex, showChords, prev]}>
            <CueBody item={prev} showChords={showChords} />
          </FitBox>
        </div>

        <FitBox className="pd-center" deps={[cueIndex, showChords, current]}>
          {/* Keyed on cueIndex so the kinetic-type spans are fresh DOM nodes each cue —
              otherwise React would just patch text into the existing word spans and the
              CSS entrance animations (which only fire on mount) would never replay. */}
          <CueBody key={cueIndex} item={current} showChords={showChords} big />
        </FitBox>

        <div className="pd-side pd-next">
          <div className="pd-side-tag">Coming up</div>
          <FitBox className="pd-fitbox" deps={[cueIndex, showChords, next]}>
            <CueBody item={next} showChords={showChords} />
          </FitBox>
        </div>
      </div>

      {current?.type === 'transition' && (
        <MetronomeBar tempo={current.tempo} tempoNote={current.tempoNote} />
      )}
    </div>
  )
}
