import React, { useEffect, useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation, Link } from 'react-router-dom'
import Home from '../src/pages/Home'
import Tools from '../src/pages/Tools'
import Login from '../src/pages/Login'
import Navbar from '../src/components/Navbar'
import Footer from '../src/components/Footer'
import '../src/index.css'
import './public-site-review.css'

function Destination() {
  const { pathname } = useLocation()
  return <section className="review-destination"><h1>Destination preserved</h1><p>This preview stops here. The production route is <code>{pathname}</code>.</p><p>No app, account, microphone, or data connection was opened.</p><Link to="/tools">Back to Tools</Link></section>
}
function Review() {
  const location = useLocation()
  const [large, setLarge] = useState(false)
  const [long, setLong] = useState(false)
  const [reduce, setReduce] = useState(false)
  const [captured, setCaptured] = useState('')
  useEffect(() => {
    const capture = e => {
      const a = e.target.closest('a')
      if (a && /^(https?:|mailto:|tel:)/.test(a.getAttribute('href') || '')) {
        e.preventDefault(); e.stopPropagation(); setCaptured(a.getAttribute('href'))
      }
    }
    const stopForm = e => { e.preventDefault(); e.stopImmediatePropagation(); setCaptured('Form submission blocked in isolated preview') }
    document.addEventListener('click', capture, true)
    document.addEventListener('submit', stopForm, true)
    return () => { document.removeEventListener('click', capture, true); document.removeEventListener('submit', stopForm, true) }
  }, [])
  useEffect(() => {
    if (!reduce) return
    const rules = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules])
    const reduced = rules.filter(rule => rule.conditionText === '(prefers-reduced-motion: reduce)')
    const style = document.createElement('style')
    style.dataset.reviewReducedMotion = 'forced-production-rules'
    style.textContent = reduced.map(rule => [...rule.cssRules].map(r => r.cssText).join('\n')).join('\n')
    document.head.append(style)
    return () => style.remove()
  }, [reduce])
  useLayoutEffect(() => {
    const targets = [...document.querySelectorAll('.public-site *, .public-site-nav *, .public-site-footer *')]
    targets.forEach(el => { if (el.hasAttribute('data-review-original-size')) { el.style.fontSize = el.dataset.reviewOriginalSize; delete el.dataset.reviewOriginalSize } })
    if (large) {
      const sizes = targets.map(el => getComputedStyle(el).fontSize)
      targets.forEach((el, i) => { el.dataset.reviewOriginalSize = el.style.fontSize; el.style.fontSize = `${parseFloat(sizes[i]) * 2}px` })
    }
    document.querySelectorAll('.public-tool-card h3, .service-card h3').forEach((el,i) => {
      if (!el.dataset.reviewOriginalText) el.dataset.reviewOriginalText = el.textContent
      el.textContent = long && i < 2 ? `${el.dataset.reviewOriginalText} — a very long practice and songwriting workshop title for returning musicians` : el.dataset.reviewOriginalText
    })
  }, [large,long,location.pathname])
  return <>
    <aside className="review-banner" aria-label="Preview controls">
      <strong>Local preview · no live accounts or data</strong>
      <button onClick={() => setLarge(v=>!v)} aria-pressed={large}>200% text</button>
      <button onClick={() => setLong(v=>!v)} aria-pressed={long}>Long labels</button>
      <button onClick={() => setReduce(v=>!v)} aria-pressed={reduce}>Reduced motion rules</button>
      <output aria-live="polite">{captured || 'External links are captured; nothing is sent.'}</output>
    </aside>
    <Navbar />
    <main><Routes><Route path="/" element={<Home />} /><Route path="/tools" element={<Tools />} /><Route path="/login" element={<Login />} /><Route path="*" element={<Destination />} /></Routes></main>
    <Footer />
  </>
}
const root = import.meta.hot?.data.root || createRoot(document.getElementById('root'))
root.render(<BrowserRouter><Review /></BrowserRouter>)
if (import.meta.hot) import.meta.hot.dispose(data => { data.root = root })
