import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchSetList, fetchSetListByToken } from '../lib/setlists'
import { fetchSong } from '../lib/songs'
import { fetchSetListPdfUrl } from '../lib/setlistPdfs'
import { fitTitles, layout, parseSong } from '../lib/chartEngine'

const CUSTOM_SONG = 'custom-song'
const isSong = item => Boolean(item) && (!item._type || item._type === CUSTOM_SONG)
const songTitle = item => item?._type === CUSTOM_SONG
  ? item.title || 'Untitled'
  : item?.meta?.title || item?.title || 'Untitled'

function duration(value) {
  const minutes = parseFloat(value)
  if (!minutes) return ''
  const seconds = Math.round(minutes * 60)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function eventDate(value) {
  if (!value) return ''
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function settings(song) {
  const meta = { ...(song.meta || {}), title: song.meta?.title || song.title || 'Untitled' }
  return { meta, compact: meta.compact !== false, scale: meta.scale || 100, collapse: meta.collapse !== false }
}

function groupSets(items) {
  const sets = []
  let current = null
  items.forEach(item => {
    if (item._type === 'set') {
      current = { label: item.label || `Set ${sets.length + 1}`, items: [] }
      sets.push(current)
      return
    }
    if (!current) {
      current = { label: 'Set 1', items: [] }
      sets.push(current)
    }
    current.items.push(item)
  })
  return sets
}

function add(parent, tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  node.textContent = text
  parent.appendChild(node)
  return node
}

function addEventDetails(parent, show) {
  if (!show?.event_date && !show?.event_details && !show?.event_url) return
  const details = add(parent, 'div', 'slp-event-details', '')
  if (show.event_date) add(details, 'div', 'slp-event-date', eventDate(show.event_date))
  if (show.event_details) add(details, 'p', 'slp-event-notes', show.event_details)
  if (show.event_url) {
    const link = add(details, 'a', 'slp-event-url', show.event_url)
    link.href = show.event_url
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
  }
}

function floorPage(show, set, index) {
  const page = document.createElement('section')
  page.className = 'slp-floor-page'
  const header = add(page, 'header', 'slp-floor-header', '')
  add(header, 'div', 'slp-floor-show', show?.name || 'Show')
  addEventDetails(header, show)
  add(header, 'h2', '', set.label || `Set ${index + 1}`)
  const songs = set.items.filter(isSong)
  const total = set.items.reduce((sum, item) => sum + (parseFloat(item.duration) || 0), 0)
  add(header, 'div', 'slp-floor-summary', `${songs.length} song${songs.length === 1 ? '' : 's'}${total ? ` / about ${duration(total)}` : ''}`)

  const list = add(page, 'div', 'slp-floor-list', '')
  let number = 0
  set.items.forEach(item => {
    const row = add(list, 'div', 'slp-floor-row', '')
    if (isSong(item)) {
      row.classList.add('is-song')
      add(row, 'span', 'slp-floor-number', `${++number}.`)
      const title = add(row, 'span', 'slp-floor-title', songTitle(item))
      if (item._type === CUSTOM_SONG) title.dataset.outside = 'true'
      add(row, 'span', 'slp-floor-duration', duration(item.duration))
    } else if (item._type === 'break') {
      row.classList.add('is-break')
      add(row, 'span', 'slp-floor-symbol', 'BREAK')
      add(row, 'span', 'slp-floor-title', item.label || 'Break')
      add(row, 'span', 'slp-floor-duration', duration(item.duration))
    } else if (item._type === 'note') {
      row.classList.add('is-note')
      add(row, 'span', 'slp-floor-symbol', 'NOTE')
      const copy = add(row, 'span', 'slp-floor-note-copy', '')
      add(copy, 'strong', '', item.label || 'Note')
      if (item.text) add(copy, 'small', '', item.text)
    }
  })
  add(page, 'footer', 'slp-floor-footer', `${set.label || `Set ${index + 1}`} / floor setlist`)
  return page
}

function markerPage(show, item, setLabel) {
  const page = document.createElement('section')
  page.className = `slp-marker-page is-${item._type}`
  add(page, 'div', 'slp-marker-show', show?.name || 'Show')
  if (item._type === CUSTOM_SONG) {
    add(page, 'div', 'slp-marker-label', 'Outside Song')
    add(page, 'h2', '', item.title || 'Untitled')
    if (item.duration) add(page, 'div', 'slp-marker-duration', duration(item.duration))
    if (item.pdf) {
      const detail = add(page, 'div', 'slp-marker-detail', `Attached chart: ${item.pdf.name || 'PDF attached'}`)
      if (item._pdfUrl) {
        const link = add(detail, 'a', 'slp-pdf-link', 'Open attached PDF')
        link.href = item._pdfUrl
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
      }
    } else {
      add(page, 'p', 'slp-marker-detail', 'No chart attached')
    }
  } else if (item._type === 'break') {
    add(page, 'div', 'slp-marker-label', 'Break')
    add(page, 'h2', '', item.label || 'Break')
    if (item.duration) add(page, 'div', 'slp-marker-duration', duration(item.duration))
  } else if (item._type === 'note') {
    add(page, 'div', 'slp-marker-label', 'Show Note')
    add(page, 'h2', '', item.label || 'Note')
    if (item.text) add(page, 'p', 'slp-marker-note', item.text)
  }
  add(page, 'footer', 'slp-marker-footer', setLabel)
  return page
}

function setDivider(show, set, index) {
  const page = document.createElement('section')
  page.className = 'slp-marker-page is-set'
  add(page, 'div', 'slp-marker-show', show?.name || 'Show')
  addEventDetails(page, show)
  add(page, 'div', 'slp-marker-label', `Set ${index + 1}`)
  add(page, 'h2', '', set.label || `Set ${index + 1}`)
  add(page, 'p', 'slp-marker-detail', `${set.items.filter(isSong).length} songs`)
  return page
}

export default function SetListPrintV2({ publicPacket = false }) {
  const { id, token } = useParams()
  const [show, setShow] = useState(null)
  const [items, setItems] = useState([])
  const [mode, setMode] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('mode')
    return ['floor', 'packet', 'charts'].includes(requested) ? requested : 'packet'
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const measureRef = useRef(null)
  const documentRef = useRef(null)
  const sets = useMemo(() => groupSets(items), [items])
  const chartCount = items.filter(item => !item._type).length
  const songCount = items.filter(isSong).length

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const savedShow = publicPacket ? await fetchSetListByToken(token) : await fetchSetList(id)
        const loaded = await Promise.all((savedShow.songs || []).map(async entry => {
          if (entry._type === CUSTOM_SONG && entry.pdf?.path && publicPacket) {
            try {
              return { ...entry, _pdfUrl: await fetchSetListPdfUrl(token, entry.pdf.path) }
            } catch {
              return entry
            }
          }
          if (entry._type || !entry._songId || publicPacket) return entry
          try {
            return { ...entry, ...await fetchSong(entry._songId), _songId: entry._songId }
          } catch {
            return entry
          }
        }))
        if (!cancelled) { setShow(savedShow); setItems(loaded) }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'This show could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, publicPacket, token])

  useEffect(() => {
    if (!items.length || !measureRef.current || !documentRef.current) return
    let cancelled = false
    async function render() {
      await document.fonts.ready
      if (cancelled) return
      const output = documentRef.current
      output.innerHTML = ''
      for (let index = 0; index < sets.length; index += 1) {
        const set = sets[index]
        output.appendChild(mode === 'charts' ? setDivider(show, set, index) : floorPage(show, set, index))
        if (mode === 'floor') continue
        for (const item of set.items) {
          if (item._type) {
            output.appendChild(markerPage(show, item, set.label))
            continue
          }
          const { meta, compact, scale, collapse } = settings(item)
          const result = layout(parseSong(item.song_text || '', meta), 'full', {
            compact, collapse, scale,
            writeBars: meta.writeBars !== false,
            sheetRepeats: Boolean(meta.sheetRepeats),
          }, measureRef.current)
          const stage = document.createElement('div')
          stage.className = `stagewrap slp-stage${compact ? ' compact' : ''}`
          stage.innerHTML = result.html
          output.appendChild(stage)
        }
      }
      fitTitles(output)
    }
    render()
    return () => { cancelled = true }
  }, [items, mode, sets, show])

  useEffect(() => {
    if (!show) return
    const previous = document.title
    document.title = `${show.name} - ${publicPacket ? 'Band Packet' : 'Print Show'}`
    return () => { document.title = previous }
  }, [publicPacket, show])

  return <div className="slp-root">
    <div ref={measureRef} style={{ position: 'fixed', left: '-99999px', top: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden="true" />
    <div className="slp-toolbar">
      <div>
        <div className="slp-kicker">{publicPacket ? 'Read-only band packet' : 'Show print center'}</div>
        <h1>{show?.name || 'Print Show'}</h1>
        {show?.event_date && <p className="slp-toolbar-date">{eventDate(show.event_date)}</p>}
        {show?.event_details && <p className="slp-toolbar-notes">{show.event_details}</p>}
        {show?.event_url && <a className="slp-toolbar-link" href={show.event_url} target="_blank" rel="noopener noreferrer">Open event page</a>}
        <p>{sets.length} set{sets.length === 1 ? '' : 's'} / {songCount} songs / {chartCount} original charts</p>
      </div>
      <div className="slp-print-controls">
        <div className="slp-mode-picker" aria-label="Print format">
          <button className={mode === 'floor' ? 'active' : ''} onClick={() => setMode('floor')}>Floor Setlists</button>
          <button className={mode === 'packet' ? 'active' : ''} onClick={() => setMode('packet')}>Setlists + Charts</button>
          <button className={mode === 'charts' ? 'active' : ''} onClick={() => setMode('charts')}>Charts Only</button>
        </div>
        <div className="slp-actions">
          <Link className="cc-btn-ghost" to={publicPacket ? '/' : '/studio/setlists'}>
            {publicPacket ? 'Rainbow Heart Studio' : 'Back to Show Builder'}
          </Link>
          <button className="cc-btn-solid" onClick={() => window.print()} disabled={loading || !items.length}>Print Selected Format</button>
        </div>
      </div>
    </div>
    {loading ? <div className="slp-status">Loading the complete show...</div>
      : error ? <div className="slp-status error">{error}</div>
      : !items.length ? <div className="slp-status">This show has no printable items yet.</div>
      : <div ref={documentRef} className={`slp-document slp-mode-${mode}`} />}
  </div>
}
