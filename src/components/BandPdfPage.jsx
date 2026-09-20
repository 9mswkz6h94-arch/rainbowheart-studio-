import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import BookViewport from './BookViewport'
import { bookSpread } from '../lib/songbook.mjs'

GlobalWorkerOptions.workerSrc = workerUrl

export default function BandPdfPage({ url, title, page, onCount, pagesPerView, onLayoutChange }) {
  const canvases = useRef([])
  const [pdf, setPdf] = useState(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(true)
  const [size, setSize] = useState({ width: 816, height: 1056 })
  const spread = bookSpread(page, pdf?.numPages || 0, pagesPerView)
  useEffect(() => {
    let cancelled = false
    const task = getDocument({ url, isEvalSupported: false })
    task.promise.then(document => {
      if (!cancelled) { setPdf(document); onCount(document.numPages) }
    }).catch(() => { if (!cancelled) { setError(true); setBusy(false); onCount(1) } })
    return () => { cancelled = true; task.destroy() }
  }, [url, onCount])

  useEffect(() => {
    if (!pdf) return undefined
    let cancelled = false
    const renderTasks = []
    setBusy(true)
    setError(false)
    async function render() {
      try {
        const sheets = await Promise.all(Array.from({ length: spread.length }, (_, index) => pdf.getPage(spread.start + index + 1)))
        if (cancelled) return
        const viewports = sheets.map(sheet => sheet.getViewport({ scale: 816 / sheet.getViewport({ scale: 1 }).width }))
        setSize({ width: spread.length === 2 ? 1648 : 816, height: Math.max(...viewports.map(viewport => viewport.height)) })
        // Cap resolution for tablet memory. The original remains available separately.
        const density = Math.min(2, window.devicePixelRatio || 1)
        sheets.forEach((sheet, index) => {
          const viewport = viewports[index], target = canvases.current[index]
          target.width = Math.ceil(viewport.width * density)
          target.height = Math.ceil(viewport.height * density)
          target.style.width = `${viewport.width}px`
          target.style.height = `${viewport.height}px`
          renderTasks.push(sheet.render({ canvasContext: target.getContext('2d'), viewport, transform: [density, 0, 0, density, 0, 0] }))
        })
        await Promise.all(renderTasks.map(task => task.promise))
        if (!cancelled) setBusy(false)
      } catch (reason) {
        if (!cancelled && reason?.name !== 'RenderingCancelledException') { setError(true); setBusy(false) }
      }
    }
    render()
    return () => { cancelled = true; renderTasks.forEach(task => task.cancel()) }
  }, [pdf, spread.start, spread.length])

  return <>
    {error && <p role="alert">The PDF page could not be displayed. Use Open original PDF below.</p>}
    {busy && <p role="status">Opening PDF page…</p>}
    <BookViewport {...size} pageKey={spread.start} pagesPerView={pagesPerView} onLayoutChange={onLayoutChange}>
      <div className="bp-pdf-spread" style={{ visibility: busy || error ? 'hidden' : 'visible' }}>
        {[0, 1].map(index => <canvas key={index} ref={element => { canvases.current[index] = element }} hidden={index >= spread.length} role="img" aria-label={`${title}, page ${spread.start + index + 1}`} />)}
      </div>
    </BookViewport>
    <a className="bp-original-link" href={url} target="_blank" rel="noopener noreferrer">Open original PDF</a>
  </>
}
