import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import '../src/index.css'
import BandPacket from '../src/pages/BandPacket'

async function checkGestures() {
  const region = document.querySelector('.bp-book-viewport')
  const result = document.querySelector('#gesture-result')
  if (!region) { result.textContent = 'Choose a chart or PDF first'; return }
  const title = document.querySelector('.bp-item-heading h2').textContent
  const page = document.querySelector('.bp-page-number').textContent
  const tick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const capture = region.setPointerCapture
  region.setPointerCapture = () => {} // Synthetic pointer IDs cannot acquire native capture.
  const rect = region.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2
  const send = async (type, id, dx, dy) => {
    region.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch', clientX: x + dx, clientY: y + dy, button: 0 }))
    await tick()
  }
  try {
    await send('pointerdown', 101, -40, 0)
    await send('pointerdown', 102, 40, 0)
    await send('pointermove', 101, -100, 0)
    await send('pointermove', 102, 100, 0)
    const zoom = Number.parseInt(document.querySelector('.bp-zoom-value').textContent)
    await send('pointerup', 102, 100, 0)
    await send('pointermove', 101, -200, 60)
    await send('pointercancel', 101, -200, 60)
    await send('pointerdown', 103, 100, 0)
    await send('pointermove', 103, -150, 10)
    await send('pointerup', 103, -150, 10)
    const unchanged = title === document.querySelector('.bp-item-heading h2').textContent && page === document.querySelector('.bp-page-number').textContent
    result.textContent = zoom > 100 && unchanged ? 'PASS: pinch zoom, drag, cancel, and swipe kept the same page/song' : `FAIL: zoom=${zoom}; unchanged=${unchanged}`
  } finally { region.setPointerCapture = capture }
}

function Review() {
  return <><BrowserRouter><Routes><Route path="/band/:token/:slug?" element={<BandPacket />} /></Routes></BrowserRouter>
    <details style={{ position: 'fixed', zIndex: 100, right: 4, top: 0, fontSize: 10, color: '#0a0a0a', background: '#fff' }}>
      <summary>ISOLATED SAMPLE · NO LIVE DATA</summary>
      <button onClick={checkGestures}>Run gesture regression</button><output id="gesture-result" />
    </details>
  </>
}
createRoot(document.getElementById('root')).render(<Review />)
