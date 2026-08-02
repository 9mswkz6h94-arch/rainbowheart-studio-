import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { fetchSetListByToken } from '../lib/setlists'
import { buildPresentSequence } from '../lib/presentSequence'
import { openDisplayChannel, closePresentChannel } from '../lib/presentChannel'
import { sectionKineticTheme, KineticWords } from '../lib/kineticType'
import FitBox from '../components/FitBox'

/**
 * The crowd-facing screen — a projector/TV showing just the lyric, nothing else. This is
 * a separate route from PresentDisplay (the performer's cue sheet) on purpose: they're
 * both driven by the same controller broadcast at once, but the band's monitor needs the
 * song list, structure bar, and chord toggle, while the audience just needs something that
 * reads like a lyric video. Two things never reach this screen no matter what the band has
 * toggled on their own monitor: chords (never useful to a crowd) and note text (backstage
 * directions like "banter about the new album here" aren't meant to be read by the room).
 */
function AudienceBody({ item }) {
  if (!item) return null

  if (item.type === 'transition') {
    return (
      <div className="pa-title">
        <div className="pa-title-song">{item.title}</div>
      </div>
    )
  }

  if (item.type === 'break' || item.type === 'set') {
    return <div className="pa-divider">{item.label}</div>
  }

  // Notes are backstage-only — hold on a neutral screen rather than exposing the text.
  if (item.type === 'note') return <div className="pa-hold" />

  const theme = sectionKineticTheme(item.label)

  // Instrumental sections (intros, solos) have no lyric lines — show the section as a
  // title card instead of falling back to chords, which the audience should never see.
  if (item.lyricLines.length === 0) {
    return <div className={`pa-instrumental kt-label-${theme}`}>{item.label}</div>
  }

  return (
    <div className="pa-lyric">
      {item.lyricLines.map((ln, i) => (
        <div key={i} className={`pa-line${ln.bold ? ' pa-bold' : ''}`}>
          <KineticWords text={ln.text} theme={theme} />
        </div>
      ))}
    </div>
  )
}

export default function PresentAudience() {
  const { token } = useParams()

  const [setlist,   setSetlist]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [cueIndex,  setCueIndex]  = useState(0)
  const [connected, setConnected] = useState(false)

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

  /* Self-heals like PresentDisplay's own channel: reconnects automatically if the socket
     drops (tab backgrounded, wifi blip) instead of sitting on a dead channel all night. */
  useEffect(() => {
    let cancelled = false
    let retryTimer = null
    let channel = null

    function connect() {
      channel = openDisplayChannel(token, state => {
        setConnected(true)
        if (typeof state.cueIndex === 'number') setCueIndex(state.cueIndex)
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

  if (loading) return <div className="pa-loading"><div className="pa-spinner" /></div>
  if (error)   return <div className="pa-loading"><p style={{ color: '#ff6b6b' }}>{error}</p></div>

  const current = sequence[cueIndex]

  return (
    <div className="pa-root">
      <button className="pa-fullscreen-btn" onClick={toggleFullscreen} title="Toggle fullscreen">⛶</button>
      {!connected && <div className="pa-waiting">●</div>}

      <FitBox className="pa-stage" deps={[cueIndex, current]}>
        {/* Keyed on cueIndex so the kinetic-type spans are fresh DOM nodes each cue and the
            CSS entrance animations (mount-only) replay every time, not just on first load. */}
        <AudienceBody key={cueIndex} item={current} />
      </FitBox>
    </div>
  )
}
