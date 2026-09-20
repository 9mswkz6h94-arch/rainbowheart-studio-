import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchSetListByToken } from '../lib/setlists'
import { fetchSetListPdfUrl } from '../lib/setlistPdfs'
import BandChartPage from '../components/BandChartPage'
import { bandEventDate, bandShareMessage, bandShareUrl } from '../lib/bandShare'
import { bookSpread, pageLabel } from '../lib/songbook.mjs'
import '../components/songbook.css'

const CUSTOM_SONG = 'custom-song'
const BandPdfPage = lazy(() => import('../components/BandPdfPage'))

function formatDate(value) {
  return bandEventDate(value)
}

function updatedLabel(value) {
  if (!value) return 'Update time unavailable'
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'Updated just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `Updated ${days} day${days === 1 ? '' : 's'} ago`
}

function formatDuration(value) {
  const minutes = parseFloat(value)
  if (!minutes) return ''
  const seconds = Math.round(minutes * 60)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
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
      <button type="button" className="bp-nav-close" onClick={onClose}>Hide setlist</button>
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
              onClick={() => { onSelect(entry.key); if (window.matchMedia('(max-width: 600px)').matches) onClose() }}
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
  const [listOpen, setListOpen] = useState(() => window.matchMedia('(min-width: 1000px)').matches)
  const [page, setPage] = useState(0)
  const [pageCount, setPageCount] = useState(0)
  const [pagesPerView, setPagesPerView] = useState(() => {
    try { return localStorage.getItem('band-pages-per-view') === '2' ? 2 : 1 } catch { return 1 }
  })
  const [toolsOpen, setToolsOpen] = useState(false)
  const [pdfs, setPdfs] = useState({})
  const [awake, setAwake] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  const wakeLockRef = useRef(null)
  const listToggleRef = useRef(null)
  const sidebarRef = useRef(null)
  const onPageCount = useCallback(count => setPageCount(count), [])

  const packet = useMemo(() => buildPacket(show?.songs), [show])
  const selectedIndex = Math.max(0, packet.entries.findIndex(entry => entry.key === selectedKey))
  const selected = packet.entries[selectedIndex] || null
  const hasPages = selected?.kind === 'chart' || (selected?.kind === CUSTOM_SONG && Boolean(selected.item.pdf?.path))
  const count = hasPages ? pageCount : 1
  const { start: currentPage, end: pageEnd } = bookSpread(page, count, pagesPerView)

  function changePageLayout(value) {
    setPage(currentPage)
    setPagesPerView(value)
    try { localStorage.setItem('band-pages-per-view', String(value)) } catch { /* Reading still works without storage. */ }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchSetListByToken(token)
      .then(saved => {
        if (cancelled) return
        setShow(saved)
        const canonicalUrl = bandShareUrl(window.location.origin, token, saved.name)
        if (window.location.pathname !== new URL(canonicalUrl).pathname) {
          window.history.replaceState({}, '', canonicalUrl)
        }
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
    if (!selected?.item.pdf?.path || selected.kind !== CUSTOM_SONG) return
    const path = selected.item.pdf.path
    if (pdfs[path]) return
    setPdfs(current => ({ ...current, [path]: { status: 'loading' } }))
    fetchSetListPdfUrl(token, path)
      .then(url => setPdfs(current => ({ ...current, [path]: { status: 'ready', url } })))
      .catch(err => setPdfs(current => ({ ...current, [path]: { status: 'error', error: err?.message || 'PDF could not be opened.' } })))
  }, [pdfs, selected, token])

  useEffect(() => {
    if (selected?.kind === CUSTOM_SONG && pdfs[selected.item.pdf?.path]?.status === 'error') setPageCount(1)
  }, [selected, pdfs])

  useEffect(() => {
    const handleKey = event => {
      if (event.key === 'Escape' && listOpen) { closeList(); return }
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.target.closest('input, textarea, select, button, a, [contenteditable="true"], .bp-sidebar')) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        turnPage(event.key === 'ArrowLeft' ? -1 : 1)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  useEffect(() => () => { wakeLockRef.current?.release?.() }, [])

  useEffect(() => {
    if (listOpen && window.matchMedia('(max-width: 600px)').matches) sidebarRef.current?.querySelector('button')?.focus()
  }, [listOpen])

  function closeList() {
    setListOpen(false)
    listToggleRef.current?.focus()
  }

  function selectEntry(key, lastPage = false) {
    setSelectedKey(key)
    setPage(lastPage ? Number.MAX_SAFE_INTEGER : 0)
    setPageCount(0)
  }

  function turnPage(offset) {
    if (!count) return
    const nextPage = currentPage + offset * pagesPerView
    if (nextPage >= 0 && nextPage < count) { setPage(nextPage); return }
    const next = packet.entries[selectedIndex + offset]
    if (next) selectEntry(next.key, offset < 0)
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

  async function shareShow() {
    const url = bandShareUrl(window.location.origin, token, show.name)
    const text = bandShareMessage(show)
    setShareStatus('')
    try {
      if (navigator.share) {
        await navigator.share({ title: show.name || 'Band show', text, url })
        setShareStatus('Show shared')
      } else {
        await navigator.clipboard.writeText(`${text}\n\nBand charts and show order:\n${url}`)
        setShareStatus('Event details and link copied')
      }
    } catch (error) {
      if (error?.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(`${text}\n\nBand charts and show order:\n${url}`)
        setShareStatus('Event details and link copied')
      } catch {
        setShareStatus('Sharing is unavailable on this device')
      }
    }
    window.setTimeout(() => setShareStatus(''), 3500)
  }

  if (loading) return <main className="bp-state"><span className="bp-eyebrow">Band view</span><h1>Loading the show...</h1></main>
  if (error) return <main className="bp-state error"><span className="bp-eyebrow">Band view</span><h1>We could not open this show.</h1><p>{error}</p></main>
  if (!selected) return <main className="bp-state"><span className="bp-eyebrow">Band view</span><h1>{show?.name || 'This show'} has no items yet.</h1></main>

  const pdfState = selected.item.pdf?.path ? pdfs[selected.item.pdf.path] : null
  const canFullscreen = Boolean(document.documentElement.requestFullscreen)
  const canWake = Boolean(navigator.wakeLock)

  return <div className="bp-root bp-songbook">
    <header className="bp-header">
      <div className="bp-show-copy">
        <span className="bp-eyebrow">Rainbow Heart Band View</span>
        <h1>{show.name || 'Show'}</h1>
        {show.event_date && <p>{formatDate(show.event_date)}</p>}
        <span className="bp-updated">{updatedLabel(show.updated_at)}</span>
      </div>
      <div className="bp-header-actions">
        <button ref={listToggleRef} type="button" aria-expanded={listOpen} aria-controls="band-setlist" onClick={() => listOpen ? closeList() : setListOpen(true)}>{listOpen ? 'Hide setlist' : 'Show setlist'}</button>
        <button type="button" aria-expanded={toolsOpen} aria-controls="band-tools" onClick={() => setToolsOpen(value => !value)}>{toolsOpen ? 'Hide tools' : 'Show tools'}</button>
      </div>
      <div id="band-tools" className="bp-header-actions bp-tools" hidden={!toolsOpen}>
        <button type="button" className="bp-share-button" onClick={shareShow}>Share show</button>
        <button type="button" onClick={() => window.location.reload()}>Refresh</button>
        {canWake && <button type="button" className={awake ? 'active' : ''} aria-pressed={awake} onClick={toggleWakeLock}>{awake ? 'Screen awake' : 'Keep awake'}</button>}
        {canFullscreen && <button type="button" onClick={() => document.documentElement.requestFullscreen()}>Full screen</button>}
        {shareStatus && <span className="bp-share-status" role="status">{shareStatus}</span>}
      </div>
      {toolsOpen && (show.event_details || show.event_url) && <details className="bp-show-details">
        <summary>Show notes and event details</summary>
        {show.event_details && <p>{show.event_details}</p>}
        {show.event_url && <a href={show.event_url} target="_blank" rel="noopener noreferrer">Open event page</a>}
      </details>}
    </header>

    <div className={`bp-layout${listOpen ? ' bp-list-open' : ''}`}>
      {listOpen && <aside ref={sidebarRef} id="band-setlist" className="bp-sidebar open" onKeyDown={event => {
        if (event.key !== 'Tab' || !window.matchMedia('(max-width: 600px)').matches) return
        const buttons = [...event.currentTarget.querySelectorAll('button')]
        const first = buttons[0], last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}>
        <SetNavigator packet={packet} selectedKey={selected.key} onSelect={key => { if (key !== selected.key) selectEntry(key) }} onClose={closeList} />
      </aside>}
      {listOpen && <button type="button" className="bp-scrim" aria-label="Close setlist" onClick={closeList} />}

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

        {selected.kind === 'chart' && <BandChartPage key={selected.key} item={selected.item} page={page} onCount={onPageCount} pagesPerView={pagesPerView} onLayoutChange={changePageLayout} />}

        {selected.kind === CUSTOM_SONG && <section className="bp-pdf-panel">
          {!selected.item.pdf?.path && <div className="bp-empty-document"><span className="bp-eyebrow">Outside song</span><h3>No PDF is attached.</h3><p>Use the title and timing above as the band reference.</p></div>}
          {pdfState?.status === 'loading' && <div className="bp-empty-document"><h3>Opening the original PDF...</h3><p>Only this chart is being loaded.</p></div>}
          {pdfState?.status === 'error' && <div className="bp-empty-document error"><h3>The PDF could not open.</h3><p>{pdfState.error}</p></div>}
          {pdfState?.url && <Suspense fallback={<p role="status">Loading PDF reader…</p>}>
            <BandPdfPage key={`${selected.key}-${pdfState.url}`} url={pdfState.url} title={entryTitle(selected)} page={page} onCount={onPageCount} pagesPerView={pagesPerView} onLayoutChange={changePageLayout} />
          </Suspense>}
        </section>}

        {selected.kind === 'break' && <section className="bp-marker bp-break"><span className="bp-eyebrow">Break</span><h3>{entryTitle(selected)}</h3>{selected.item.duration && <p>{formatDuration(selected.item.duration)}</p>}</section>}
        {selected.kind === 'note' && <section className="bp-marker bp-note"><span className="bp-eyebrow">Show note</span><h3>{entryTitle(selected)}</h3>{selected.item.text && <p>{selected.item.text}</p>}</section>}
      </main>
    </div>

    <footer className="bp-controls">
      <button type="button" onClick={() => turnPage(-1)} disabled={!count || (selectedIndex === 0 && currentPage === 0)}>
        <span>← {currentPage > 0 ? (pagesPerView === 2 ? 'Previous spread' : 'Previous page') : 'Previous song / item'}</span>
        <strong>{currentPage > 0 ? pageLabel(Math.max(0, currentPage - pagesPerView), currentPage) : entryTitle(packet.entries[selectedIndex - 1]) || 'Start of show'}</strong>
      </button>
      <div className="bp-controls-center">
        <span className="bp-page-number" aria-live="polite">{count ? `${pageLabel(currentPage, pageEnd)} of ${count}` : 'Loading pages…'}</span>
        <Link to={`/band/${token}/print?mode=packet`}>Print options</Link>
      </div>
      <button type="button" onClick={() => turnPage(1)} disabled={!count || (selectedIndex === packet.entries.length - 1 && pageEnd === count)}>
        <span>{pageEnd < count ? (pagesPerView === 2 ? 'Next spread' : 'Next page') : 'Next song / item'} →</span>
        <strong>{pageEnd < count ? pageLabel(pageEnd, Math.min(count, pageEnd + pagesPerView)) : entryTitle(packet.entries[selectedIndex + 1]) || 'End of show'}</strong>
      </button>
    </footer>
  </div>
}
