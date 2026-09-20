import { useLayoutEffect, useRef, useState } from 'react'
import { fitTitles, layout, parseSong } from '../lib/chartEngine'
import BookViewport from './BookViewport'

export default function BandChartPage({ item, page, onCount }) {
  const measure = useRef(null)
  const chart = useRef(null)
  const [count, setCount] = useState(0)
  const [error, setError] = useState(false)
  useLayoutEffect(() => {
    let cancelled = false
    async function render() {
      try {
        await document.fonts.ready
        if (cancelled) return
        const meta = { ...item.meta, title: item.meta?.title || item.title || 'Untitled' }
        const compact = meta.compact !== false
        const result = layout(parseSong(item.song_text || '', meta), 'full', {
          compact, collapse: meta.collapse !== false, scale: meta.scale || 100,
          writeBars: meta.writeBars !== false, sheetRepeats: Boolean(meta.sheetRepeats),
        }, measure.current)
        chart.current.className = `stagewrap bp-book-chart${compact ? ' compact' : ''}`
        // Title fitting must measure at natural paper size, outside the zoom transform.
        measure.current.innerHTML = result.html
        fitTitles(measure.current)
        chart.current.innerHTML = measure.current.innerHTML
        measure.current.innerHTML = ''
        const length = chart.current.querySelectorAll('.page').length
        setCount(length)
        onCount(length)
      } catch { if (!cancelled) { setError(true); onCount(1) } }
    }
    render()
    return () => { cancelled = true }
  }, [item, onCount])

  useLayoutEffect(() => {
    const active = Math.min(page, Math.max(0, count - 1))
    chart.current?.querySelectorAll('.page').forEach((element, index) => {
      element.hidden = index !== active
    })
  }, [page, count])

  return <>
    <div ref={measure} aria-hidden="true" style={{ position: 'fixed', left: '-99999px', top: 0, pointerEvents: 'none' }} />
    {error && <p role="alert">This chart could not be rendered. Choose another song from the setlist or open Print options.</p>}
    {!count && !error && <p role="status">Preparing chart pages…</p>}
    <BookViewport width={816} height={1032} pageKey={page}>
      <div ref={chart} className="stagewrap bp-book-chart" />
    </BookViewport>
  </>
}
