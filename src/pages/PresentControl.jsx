import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { fetchSetListByToken } from '../lib/setlists'
import { buildPresentSequence } from '../lib/presentSequence'
import { openControllerChannel, closePresentChannel } from '../lib/presentChannel'

/** Short glanceable text for a cue item — lets the singer confirm they're on the right one. */
function cuePreview(item) {
  if (!item) return ''
  if (item.type === 'transition') return item.title
  if (item.type === 'break' || item.type === 'set') return item.label
  return item.lyricLines[0]?.text || item.songTitle
}

export default function PresentControl() {
  const { token } = useParams()

  const [setlist,    setSetlist]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [cueIndex,   setCueIndex]   = useState(0)
  const [showChords, setShowChords] = useState(() => {
    try { return localStorage.getItem('present-show-chords') === '1' } catch { return false }
  })
  const [copied,    setCopied]    = useState(false)
  const [connected, setConnected] = useState(false)
  const [midiDevice, setMidiDevice] = useState(null)

  const channelRef = useRef(null)
  // Kept up to date every render so a reconnect can re-track the *current* position,
  // not whatever cueIndex/showChords were when the channel-open effect last ran.
  const stateRef = useRef({ cueIndex, showChords })
  stateRef.current = { cueIndex, showChords }

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
  const total    = sequence.length
  const current  = sequence[cueIndex]

  /* ── Open the Realtime channel and track cue state via Presence. Self-heals: if the
     channel ever drops (tab backgrounded, wifi blip, laptop sleep) the local UI keeps
     working fine — cueIndex is plain React state — but the broadcast silently stops
     unless something notices and rejoins. Without this, that failure is invisible: the
     driver keeps clicking Next, the counter keeps incrementing, and the display just
     never hears about it again. ── */
  useEffect(() => {
    let cancelled = false
    let retryTimer = null

    function connect() {
      const channel = openControllerChannel(token)
      channelRef.current = channel
      channel.subscribe(status => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          setConnected(true)
          channel.track(stateRef.current)
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
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
      closePresentChannel(channelRef.current)
    }
  }, [token])

  /* Re-broadcast whenever the cue or the chords toggle changes */
  useEffect(() => {
    channelRef.current?.track({ cueIndex, showChords })
  }, [cueIndex, showChords])

  const goNext = useCallback(() => setCueIndex(i => Math.min(total - 1, i + 1)), [total])
  const goPrev = useCallback(() => setCueIndex(i => Math.max(0, i - 1)), [])

  /* ── Keyboard nav — covers Bluetooth clickers (arrow keys) and page-turner pedals ── */
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPrev()
      if (e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); goNext() }
      if (e.key === 'PageUp')                    { e.preventDefault(); goPrev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  /* ── MIDI foot pedal (e.g. a sustain pedal plugged into a keyboard's pedal jack) ──
     A pedal press arrives as a MIDI message over USB, not a keystroke — Control Change
     #64 (the standard "sustain" controller) is the common case, but some pedals send
     Note On or Program Change instead, so all three are treated as a "click". Since a
     single-button pedal can't send Next and Prev separately, one click advances and a
     second click within 350ms counts as a double-click that goes back instead — the
     click is held for that window before acting, so every press has a brief delay
     while it waits to see if a second one follows.

     Connection is triggered by an explicit button tap (connectMIDI), not automatically
     on page load — browsers require a real user gesture to reliably grant the MIDI
     permission prompt; requesting it from an effect on mount can silently fail. */
  const midiAccessRef = useRef(null)
  const midiStateRef  = useRef({ clickTimer: null, clickCount: 0, lastCCValue: {} })

  const connectMIDI = useCallback(() => {
    if (!navigator.requestMIDIAccess) { setMidiDevice('unsupported'); return }

    function registerClick() {
      const s = midiStateRef.current
      s.clickCount++
      if (s.clickCount === 1) {
        s.clickTimer = setTimeout(() => {
          if (s.clickCount === 1) goNext()
          else goPrev()
          s.clickCount = 0
        }, 350)
      }
    }

    function onMIDIMessage(e) {
      const [status, data1, data2] = e.data
      const type = status & 0xf0
      const s = midiStateRef.current
      if (type === 0xb0) {
        // Latching/toggle footswitches (e.g. a PSK FS-2 in its default polarity) flip the
        // CC value on *every* physical press — off→on AND on→off — rather than sending a
        // clean press/release pair. Reacting to any change of state (not just off→on) means
        // every real press registers exactly once, and wiring polarity stops mattering.
        const key = `${e.target.id}:${data1}`
        const prevVal = s.lastCCValue[key] || 0
        s.lastCCValue[key] = data2
        if ((prevVal >= 64) !== (data2 >= 64)) registerClick()
      } else if (type === 0x90 && data2 > 0) {
        registerClick()
      } else if (type === 0xc0) {
        registerClick()
      }
    }

    function attachAll(midiAccess) {
      for (const input of midiAccess.inputs.values()) input.onmidimessage = onMIDIMessage
      const first = [...midiAccess.inputs.values()][0]
      setMidiDevice(first ? first.name : 'connected — no device detected')
    }

    navigator.requestMIDIAccess().then(access => {
      midiAccessRef.current = access
      attachAll(access)
      access.onstatechange = () => attachAll(access)
    }).catch(() => setMidiDevice('permission denied'))
  }, [goNext, goPrev])

  useEffect(() => {
    return () => {
      clearTimeout(midiStateRef.current.clickTimer)
      const access = midiAccessRef.current
      if (access) for (const input of access.inputs.values()) input.onmidimessage = null
    }
  }, [])

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

  function toggleChords() {
    setShowChords(v => {
      try { localStorage.setItem('present-show-chords', v ? '0' : '1') } catch { /* private mode */ }
      return !v
    })
  }

  function copyDisplayLink() {
    const url = `${window.location.origin}/present/${token}/display`
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  if (loading) return (
    <div className="pc-loading"><div className="pc-spinner" /><p>Loading show…</p></div>
  )
  if (error) return (
    <div className="pc-loading"><p style={{ color: '#ff6b6b' }}>{error}</p></div>
  )

  return (
    <div className="pc-root">
      <div className="pc-topbar">
        <div className="pc-set-name">{setlist.name}</div>
        <div className={`pc-conn${connected ? ' pc-conn-ok' : ''}`}>
          {connected ? '🟢 Live' : '🔴 Reconnecting…'}
        </div>
        <button className="pc-link-btn" onClick={copyDisplayLink}>
          {copied ? '✓ Copied' : '📺 Copy Display Link'}
        </button>
      </div>

      <div className="pc-stage">
        {total === 0 ? (
          <div className="pc-empty">This show has no songs yet.</div>
        ) : (
          <>
            <div className="pc-song-title">{current.type === 'section' ? current.songTitle : ''}</div>
            <div className={`pc-cue-label pc-cue-${current.type}`}>
              {current.type === 'transition' ? current.title
                : current.type === 'break' || current.type === 'set' ? current.label
                : current.label}
            </div>
            {current.type === 'transition' && (
              <div className="pc-transition-meta">
                {[current.key && `Key ${current.key}`, current.tempo && `♩ = ${current.tempo}`, current.meter]
                  .filter(Boolean).join('  ·  ')}
              </div>
            )}
            <div className="pc-preview">{cuePreview(current)}</div>
          </>
        )}
      </div>

      <div className="pc-nav">
        <button className="pc-nav-btn" onClick={goPrev} disabled={cueIndex === 0}>← Prev</button>
        <div className="pc-position">{total ? `${cueIndex + 1} / ${total}` : '—'}</div>
        <button className="pc-nav-btn" onClick={goNext} disabled={cueIndex >= total - 1}>Next →</button>
      </div>

      <button className="pc-chords-toggle" onClick={toggleChords}>
        {showChords ? '🎸 Chords: On' : '🎤 Chords: Off'}
      </button>

      {midiDevice ? (
        <div className="pc-midi-tag">🎹 {midiDevice} — 1 click Next, 2 quick clicks Prev</div>
      ) : (
        <button className="pc-midi-connect-btn" onClick={connectMIDI}>
          🎹 Connect MIDI Pedal
        </button>
      )}
    </div>
  )
}
