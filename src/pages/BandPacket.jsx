import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchSetListByToken } from '../lib/setlists'
import { fetchSetListPdfUrl } from '../lib/setlistPdfs'
import { fitTitles, layout, parseSong } from '../lib/chartEngine'

const CUSTOM_SONG = 'custom-song'

function formatDate(value) {
  if (!value) return ''
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatDuration(value) {
  const minutes = parseFloat(value)
  if (!minutes) return ''
  const seconds = Math.round(minutes * 60)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function chartSettings(song) {
  const meta = { ...(song.meta || {}), title: song.meta?.title || song.title || 'Untitled' }
  return {
    meta,
    compact: meta.compact !== false,
    scale: meta.scale || 100,
    collapse: meta.collapse !== false,
  }
}

function buildPacket(items) {
  const sets = []
  let current = null
  ;(items || []).forEach((item, sourceIndex) => {
    if (item._type === 'set') {
      current = { label: item.label || `Set ${sets.length + 1}`, entries: [] }
      sets.push(current)
      return
    }
    if (!current) {
      current = { label: 'Set 1', entries: [] }
      sets.push(current)
    }
    const kind = !item._type ? 'chart' : item._type
    current.entries.push({
      key: `${sets.length - 1}-${sourceIndex}`,
      item,
      kind,
      setLabel: current.label,
    })
  })
  return { sets, entries: sets.flatMap(set => set.entries) }
}

function entryTitle(entry) {
  if (!entry) return ''
  const { item, kind } = entry
  if (kind === 'break') return item.label || 'Break'
  if (kind === 'note') return item.label || 'Note'
  if (kind === 'chart') return item.meta?.title || item.title || 'Untitled'
  return item.title || 'Untitled'
}

function entryLabel(entry) {
  if (!entry) return ''
  if (entry.kind === CUSTOM_SONG) return 'Outside song'
  if (entry.kind === 'break') return 'Break'
  if (entry.kind === 'note') return 'Show note'
  return 'Chord chart'
}

function SetNavigator({ packet, selectedKey, onSelect, onClose }) {
  return <nav className="bp-nav" aria-label="Show contents">
    <div className="bp-nav-heading">
      <div>
        <span className="bp-eyebrow">Show order</span>
        <strong>{packet.entries.length} items</strong>
      </div>
      <button type="button" className="bp-nav-close" onClick={onClose}>Close</button>
    </div>
    {packet.sets.map((set, setIndex) => {
      let songNumber = 0
      return <section className="bp-set" key={`${set.label}-${setIndex}`}>
        <h2>{set.label}</h2>
        <div className="bp-set-items">
          {set.entries.map(entry => {
            const isSong = entry.kind === 'chart' || entry.kind === CUSTOM_SONG
            if (isSong) songNumber += 1
            return <button
              type="button"
              key={entry.key}
              className={`bp-nav-item bp-kind-${entry.kind}${selectedKey === entry.key ? ' active' : ''}`}
              aria-current={selectedKey === entry.key ? 'true' : undefined}
              onClick={() => { onSelect(entry.key); onClose() }}
            >
              <span className="bp-nav-number">{isSong ? songNumber : entry.kind === 'break' ? 'B' : 'N'}</span>
              <span className="bp-nav-copy">
                <strong>{entryTitle(entry)}</strong>
                <small>{entryLabel(entry)}{entry.item.duration ? ` / ${formatDuration(entry.item.duration)}` : ''}</small>
              </span>
            </button>
          })}
        </div>
      </section>
    })}
  </nav>
}

export default function BandPacket() {
  const { token } = useParams()
  const [show, setShow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedKey, setSelectedKey] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [chartHeight, setChartHeight] = useState(0)
  const [pdfs, setPdfs] = useState({})
  const [awake, setAwake] = useState(false)
  const measureRef = useRef(null)
  const chartRef = useRef(null)
  const chartViewportRef = useRef(null)
  const wakeLockRef = useRef(null)
  const touchStartRef = useRef(null)

  const packet = useMemo(() => buildPacket(show?.songs), [show])
  const selectedIndex = Math.max(0, packet.entries.findIndex(entry => entry.key === selectedKey))
  const selected = packet.entries[selectedIndex] || null

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchSetListByToken(token)
      .then(saved => {
        if (cancelled) return
        setShow(saved)
        const first = buildPacket(saved.songs).entries[0]
        setSelectedKey(first?.key || '')
      })
      .catch(err => { if (!cancelled) setError(err?.message || 'This band link could not be opened.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (!show) return undefined
    const previous = document.title
    document.title = `${show.name} - Band View`
    return () => { document.title = previous }
  }, [show])

  useEffect(() => {
    setZoom(1)
    if (!selected?.item.pdf?.path || selected.kind !== CUSTOM_SONG) return
    const path = selected.item.pdf.path
    if (pdfs[path]) return
    setPdfs(current => ({ ...current, [path]: { status: 'loading' } }))
    fetchSetListPdfUrl(token, path)
      .then(url => setPdfs(current => ({ ...current, [path]: { status: 'ready', url } })))
      .catch(err => setPdfs(current => ({ ...current, [path]: { status: 'error', error: err?.message || 'PDF could not be opened.' } })))
  }, [pdfs, selected, token])

  useEffect(() => {
    if (selected?.kind !== 'chart' || !chartRef.current || !measureRef.current) return undefined
    let cancelled = false
    async function renderChart() {
      await document.fonts.ready
      if (cancelled || !chartRef.current) return
      const { meta, compact, scale, collapse } = chartSettings(selected.item)
      const result = layout(parseSong(selected.item.song_text || '', meta), 'full', {
        compact,
        collapse,
        scale,
        writeBars: meta.writeBars !== false,
        sheetRepeats: Boolean(meta.sheetRepeats),
      }, measureRef.current)
      chartRef.current.className = `stagewrap bp-chart-stage${compact ? ' compact' : ''}`
      chartRef.current.innerHTML = result.html
      fitTitles(chartRef.current)
    }
    renderChart()
    return () => { cancelled = true }
  }, [selected])

  useEffect(() => {
    if (selected?.kind !== 'chart' || !chartViewportRef.current || !chartRef.current) return undefined
    const viewport = chartViewportRef.current
    const stage = chartRef.current
    const resize = () => {
      const pageWidth = 816
      const fit = Math.min(1, Math.max(0.28, (viewport.clientWidth - 16) / pageWidth))
      const scale = fit * zoom
      stage.style.transform = `scale(${scale})`
      setChartHeight(Math.ceil(stage.scrollHeight * scale))
    }
    const frame = requestAnimationFrame(resize)
    const observer = new ResizeObserver(resize)
    observer.observe(viewport)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [selected, zoom])

  useEffect(() => {
    const handleKey = event => {
      if (event.key === 'ArrowLeft') selectOffset(-1)
      if (event.key === 'ArrowRight') selectOffset(1)
      if (event.key === 'Escape') setListOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  useEffect(() => () => { wakeLockRef.current?.release?.() }, [])

  function selectOffset(offset) {
    const next = packet.entries[selectedIndex + offset]
    if (next) {
      setSelectedKey(next.key)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function toggleWakeLock() {
    if (awake) {
      await wakeLockRef.current?.release?.()
      wakeLockRef.current = null
      setAwake(false)
      return
    }
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      wakeLockRef.current.addEventListener('release', () => setAwake(false))
      setAwake(true)
    } catch {
      setAwake(false)
    }
  }

  function handleTouchStart(event) {
    touchStartRef.current = event.changedTouches[0]?.clientX ?? null
  }

  function handleTouchEnd(event) {
    if (touchStartRef.current === null) return
    const distance = (event.changedTouches[0]?.clientX ?? touchStartRef.current) - touchStartRef.current
    touchStartRef.current = null
    if (Math.abs(distance) < 70) return
    selectOffset(distance < 0 ? 1 : -1)
  }

  if (loading) return <main className="bp-state"><span className="bp-eyebrow">Band view</span><h1>Loading the show...</h1></main>
  if (error) return <main className="bp-state error"><span className="bp-eyebrow">Band view</span><h1>We could not open this show.</h1><p>{error}</p></main>
  if (!selected) return <main className="bp-state"><span className="bp-eyebrow">Band view</span><h1>{show?.name || 'This show'} has no items yet.</h1></main>

  const pdfState = selected.item.pdf?.path ? pdfs[selected.item.pdf.path] : null
  const canFullscreen = Boolean(document.documentElement.requestFullscreen)
  const canWake = Boolean(navigator.wakeLock)

  return <div className="bp-root" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
    <div
      ref={measureRef}
      className="bp-measure"
      style={{ position: 'fixed', left: '-99999px', top: 0, overflow: 'visible', pointerEvents: 'none' }}
      aria-hidden="true"
    />
    <header className="bp-header">
      <div className="bp-show-copy">
        <span className="bp-eyebrow">Rainbow Heart Band View</span>
        <h1>{show.name || 'Show'}</h1>
        {show.event_date && <p>{formatDate(show.event_date)}</p>}
      </div>
      <div className="bp-header-actions">
        <button type="button" onClick={() => setListOpen(true)}>Show order</button>
        {canWake && <button type="button" className={awake ? 'active' : ''} aria-pressed={awake} onClick={toggleWakeLock}>{awake ? 'Screen awake' : 'Keep awake'}</button>}
        {canFullscreen && <button type="button" onClick={() => document.documentElement.requestFullscreen()}>Full screen</button>}
      </div>
      {(show.event_details || show.event_url) && <details className="bp-show-details">
        <summary>Show notes and event details</summary>
        {show.event_details && <p>{show.event_details}</p>}
        {show.event_url && <a href={show.event_url} target="_blank" rel="noopener noreferrer">Open event page</a>}
      </details>}
    </header>

    <div className="bp-layout">
      <aside className={`bp-sidebar${listOpen ? ' open' : ''}`}>
        <SetNavigator packet={packet} selectedKey={selected.key} onSelect={setSelectedKey} onClose={() => setListOpen(false)} />
      </aside>
      {listOpen && <button type="button" className="bp-scrim" aria-label="Close show order" onClick={() => setListOpen(false)} />}

      <main className="bp-viewer">
        <div className="bp-item-heading">
          <div>
            <span className="bp-eyebrow">{selected.setLabel} / {entryLabel(selected)}</span>
            <h2>{entryTitle(selected)}</h2>
          </div>
          <div className="bp-item-meta">
            {selected.item.duration && <span>{formatDuration(selected.item.duration)}</span>}
            <span>{selectedIndex + 1} of {packet.entries.length}</span>
          </div>
        </div>

        {selected.kind === 'chart' && <>
          <div className="bp-zoom" aria-label="Chart size">
            <button type="button" onClick={() => setZoom(value => Math.max(0.75, value - 0.25))} aria-label="Make chart smaller">Smaller</button>
            <button type="button" onClick={() => setZoom(1)}>Fit width</button>
            <button type="button" onClick={() => setZoom(value => Math.min(2, value + 0.25))} aria-label="Make chart larger">Larger</button>
          </div>
          <div className="bp-chart-viewport" ref={chartViewportRef} style={{ minHeight: chartHeight || undefined }}>
            <div ref={chartRef} className="stagewrap bp-chart-stage" />
          </div>
        </>}

        {selected.kind === CUSTOM_SONG && <section className="bp-pdf-panel">
          {!selected.item.pdf?.path && <div className="bp-empty-document"><span className="bp-eyebrow">Outside song</span><h3>No PDF is attached.</h3><p>Use the title and timing above as the band reference.</p></div>}
          {pdfState?.status === 'loading' && <div className="bp-empty-document"><h3>Opening the original PDF...</h3><p>Only this chart is being loaded.</p></div>}
          {pdfState?.status === 'error' && <div className="bp-empty-document error"><h3>The PDF could not open.</h3><p>{pdfState.error}</p></div>}
          {pdfState?.url && <>
            <div className="bp-pdf-actions">
              <span>{selected.item.pdf.name || 'Original PDF'}</span>
              <a href={pdfState.url} target="_blank" rel="noopener noreferrer">Open original PDF</a>
            </div>
            <iframe className="bp-pdf-frame" src={`${pdfState.url}#view=FitH&toolbar=1`} title={`${entryTitle(selected)} original PDF`} loading="lazy" />
          </>}
        </section>}

        {selected.kind === 'break' && <section className="bp-marker bp-break"><span className="bp-eyebrow">Break</span><h3>{entryTitle(selected)}</h3>{selected.item.duration && <p>{formatDuration(selected.item.duration)}</p>}</section>}
        {selected.kind === 'note' && <section className="bp-marker bp-note"><span className="bp-eyebrow">Show note</span><h3>{entryTitle(selected)}</h3>{selected.item.text && <p>{selected.item.text}</p>}</section>}
      </main>
    </div>

    <footer className="bp-controls">
      <button type="button" onClick={() => selectOffset(-1)} disabled={selectedIndex === 0}><span>Previous</span><strong>{entryTitle(packet.entries[selectedIndex - 1]) || 'Start of show'}</strong></button>
      <div className="bp-controls-center">
        <button type="button" onClick={() => setListOpen(true)}>Show order</button>
        <Link to={`/band/${token}/print?mode=packet`}>Print options</Link>
      </div>
      <button type="button" onClick={() => selectOffset(1)} disabled={selectedIndex === packet.entries.length - 1}><span>Next</span><strong>{entryTitle(packet.entries[selectedIndex + 1]) || 'End of show'}</strong></button>
    </footer>
  </div>
}
