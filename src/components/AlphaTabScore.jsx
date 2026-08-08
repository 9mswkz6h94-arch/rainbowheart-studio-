import { useEffect, useRef, useState } from 'react'

const ALPHATAB_SRC = 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/alphaTab.min.js'
const ALPHATAB_ROOT = 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/'

let loader
function loadAlphaTab() {
  if (window.alphaTab) return Promise.resolve(window.alphaTab)
  if (loader) return loader
  loader = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-rh-alphatab]')
    const script = existing || document.createElement('script')
    if (!existing) {
      script.src = ALPHATAB_SRC
      script.dataset.rhAlphatab = '1'
      document.head.appendChild(script)
    }
    script.addEventListener('load', () => resolve(window.alphaTab), { once: true })
    script.addEventListener('error', () => reject(new Error('Could not load alphaTab')), { once: true })
  })
  return loader
}

export default function AlphaTabScore({ tex, playback = true, onReady }) {
  const hostRef = useRef(null)
  const apiRef = useRef(null)
  const [status, setStatus] = useState('Loading notation…')

  useEffect(() => {
    let alive = true
    loadAlphaTab().then(() => {
      if (!alive || !hostRef.current) return
      const api = new window.alphaTab.AlphaTabApi(hostRef.current, {
        core: { fontDirectory: ALPHATAB_ROOT + 'font/' },
        display: { staveProfile: 'score' },
        player: playback ? {
          enablePlayer: true,
          enableCursor: true,
          soundFont: ALPHATAB_ROOT + 'soundfont/sonivox.sf2',
          scrollElement: hostRef.current,
        } : { enablePlayer: false },
      })
      apiRef.current = api
      api.renderFinished.on(() => {
        if (!alive) return
        setStatus('Ready')
        onReady?.()
      })
      api.error.on(error => alive && setStatus(error?.message || 'Notation error'))
      api.tex(tex)
    }).catch(error => alive && setStatus(error.message))
    return () => {
      alive = false
      try { apiRef.current?.destroy() } catch {}
      apiRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!apiRef.current) return
    try { apiRef.current.tex(tex); setStatus('Rendering…') }
    catch (error) { setStatus(error.message) }
  }, [tex])

  return (
    <div className="ats-wrap">
      <div ref={hostRef} className="ats-score" />
      <div className="ats-controls no-print">
        {playback && <>
          <button type="button" onClick={() => apiRef.current?.playPause()}>▶ Play / Pause</button>
          <button type="button" onClick={() => apiRef.current?.stop()}>■ Stop</button>
        </>}
        <span>{status}</span>
      </div>
    </div>
  )
}
