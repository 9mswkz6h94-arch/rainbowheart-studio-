import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import BookViewport from './BookViewport'

GlobalWorkerOptions.workerSrc = workerUrl

export default function BandPdfPage({ url, title, page, onCount }) {
  const canvas = useRef(null)
  const [pdf, setPdf] = useState(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(true)
  const [size, setSize] = useState({ width: 816, height: 1056 })
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
    let renderTask
    setBusy(true)
    setError(false)
    async function render() {
      try {
        const sheet = await pdf.getPage(Math.min(page + 1, pdf.numPages))
        if (cancelled) return
        const natural = sheet.getViewport({ scale: 1 })
        const viewport = sheet.getViewport({ scale: 816 / natural.width })
        // Cap resolution for tablet memory. The original remains available separately.
        const density = Math.min(2, window.devicePixelRatio || 1)
        const target = canvas.current
        target.width = Math.ceil(viewport.width * density)
        target.height = Math.ceil(viewport.height * density)
        target.style.width = `${viewport.width}px`
        target.style.height = `${viewport.height}px`
        setSize({ width: viewport.width, height: viewport.height })
        renderTask = sheet.render({ canvasContext: target.getContext('2d'), viewport, transform: [density, 0, 0, density, 0, 0] })
        await renderTask.promise
        if (!cancelled) setBusy(false)
      } catch (reason) {
        if (!cancelled && reason?.name !== 'RenderingCancelledException') { setError(true); setBusy(false) }
      }
    }
    render()
    return () => { cancelled = true; renderTask?.cancel() }
  }, [pdf, page])

  return <>
    {error && <p role="alert">The PDF page could not be displayed. Use Open original PDF below.</p>}
    {busy && <p role="status">Opening PDF page…</p>}
    <BookViewport {...size} pageKey={page}>
      <canvas ref={canvas} role="img" aria-label={`${title}, page ${pdf ? Math.min(page + 1, pdf.numPages) : 1}`} style={{ visibility: busy || error ? 'hidden' : 'visible' }} />
    </BookViewport>
    <a className="bp-original-link" href={url} target="_blank" rel="noopener noreferrer">Open original PDF</a>
  </>
}
