import { useLayoutEffect, useRef, useState } from 'react'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// Reading gestures never navigate. Pointer capture keeps a pinch/pan in this page.
export default function BookViewport({ width, height, pageKey, pagesPerView = 1, onLayoutChange, children }) {
  const viewport = useRef(null)
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const current = useRef({ zoom: 1, x: 0, y: 0 })
  const [view, setView] = useState(current.current)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const fit = Math.min(size.width / width, size.height / height)

  function update(next) {
    const limitX = Math.max(0, (width * fit * next.zoom - size.width) / 2)
    const limitY = Math.max(0, (height * fit * next.zoom - size.height) / 2)
    current.current = { zoom: next.zoom, x: clamp(next.x, -limitX, limitX), y: clamp(next.y, -limitY, limitY) }
    setView(current.current)
  }

  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) })
      pointers.current.clear()
      gesture.current = null
      current.current = { zoom: 1, x: 0, y: 0 }
      setView(current.current)
    })
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    pointers.current.clear()
    gesture.current = null
    current.current = { zoom: 1, x: 0, y: 0 }
    setView(current.current)
  }, [pageKey, pagesPerView, width, height])

  function snapshot() {
    const points = [...pointers.current.values()]
    if (!points.length) { gesture.current = null; return }
    const rect = viewport.current.getBoundingClientRect()
    const midpoint = points.length > 1
      ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
      : points[0]
    gesture.current = {
      ...current.current,
      cx: midpoint.x - rect.left - rect.width / 2,
      cy: midpoint.y - rect.top - rect.height / 2,
      distance: points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0,
    }
  }

  function down(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)
    snapshot()
  }

  function move(event) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = [...pointers.current.values()]
    const start = gesture.current
    const rect = viewport.current.getBoundingClientRect()
    const midpoint = points.length > 1
      ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
      : points[0]
    const cx = midpoint.x - rect.left - rect.width / 2
    const cy = midpoint.y - rect.top - rect.height / 2
    const distance = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0
    const zoom = start.distance && distance ? clamp(start.zoom * distance / start.distance, 1, 5) : start.zoom
    const ratio = zoom / start.zoom
    update({ zoom, x: cx - (start.cx - start.x) * ratio, y: cy - (start.cy - start.y) * ratio })
  }

  function up(event) {
    pointers.current.delete(event.pointerId)
    snapshot()
  }

  return <section className="bp-book" aria-label={pagesPerView === 2 ? 'Songbook spread' : 'Songbook page'}>
    <div className="bp-zoom" aria-label="Page size">
      <div className="bp-page-layout" role="group" aria-label="Reading layout">
        <button type="button" aria-pressed={pagesPerView === 1} onClick={() => onLayoutChange(1)}>One page</button>
        <button type="button" aria-pressed={pagesPerView === 2} onClick={() => onLayoutChange(2)}>Two pages</button>
      </div>
      <button type="button" disabled={view.zoom <= 1} onClick={() => update({ ...view, zoom: Math.max(1, view.zoom - 0.5) })}>Smaller</button>
      <button type="button" onClick={() => update({ zoom: 1, x: 0, y: 0 })}>{pagesPerView === 2 ? 'Fit spread' : 'Fit page'}</button>
      <button type="button" disabled={view.zoom >= 5} onClick={() => update({ ...view, zoom: Math.min(5, view.zoom + 0.5) })}>Larger</button>
      <span className="bp-zoom-value" aria-live="polite">{Math.round(view.zoom * 100)}%</span>
    </div>
    <div ref={viewport} className="bp-book-viewport" tabIndex={0} aria-label="Chart. Pinch to zoom and drag to move. Use page buttons to turn pages."
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}>
      <div className="bp-book-paper" style={{ width, height, marginLeft: -width / 2, marginTop: -height / 2,
        transform: `translate(${view.x}px, ${view.y}px) scale(${fit * view.zoom})` }}>
        {children}
      </div>
    </div>
    <p className="bp-book-hint">Pinch to zoom · Drag to move · Use arrows to turn pages</p>
  </section>
}
