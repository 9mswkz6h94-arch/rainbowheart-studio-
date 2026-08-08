import { useEffect, useMemo, useState } from 'react'
import AlphaTabScore from '../components/AlphaTabScore'
import { buildNotationTex, loadNotationLibrary } from './NotationStudio'

const SHEET_KEY = 'rh_melody_sheets_v1'
const uid = () => (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`)
const loadSheets = () => { try { return JSON.parse(localStorage.getItem(SHEET_KEY) || '[]') } catch { return [] } }

export default function MelodySheet() {
  const [melodies, setMelodies] = useState(loadNotationLibrary)
  const [sheets, setSheets] = useState(loadSheets)
  const [id, setId] = useState(null)
  const [title, setTitle] = useState('')
  const [melodyIds, setMelodyIds] = useState([])
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const refresh = () => setMelodies(loadNotationLibrary())
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh) }
  }, [])

  useEffect(() => { document.title = `${title || 'Untitled'}${dirty ? ' ●' : ''} — Notation Sheet` }, [title, dirty])

  const selected = useMemo(() => melodyIds.map(mid => melodies.find(m => m.id === mid)).filter(Boolean), [melodyIds, melodies])
  const available = melodies.filter(m => !melodyIds.includes(m.id))

  function save() {
    const record = { id: id || uid(), title: title || 'Untitled Melody Sheet', melodyIds, updatedAt: new Date().toISOString() }
    const next = [...sheets.filter(s => s.id !== record.id), record].sort((a,b) => a.title.localeCompare(b.title))
    localStorage.setItem(SHEET_KEY, JSON.stringify(next)); setSheets(next); setId(record.id); setDirty(false)
  }
  function load(sheetId) {
    if (dirty && !confirm('Discard unsaved melody sheet changes?')) return
    const sheet = sheets.find(s => s.id === sheetId)
    if (!sheet) return
    setId(sheet.id); setTitle(sheet.title || ''); setMelodyIds(sheet.melodyIds || []); setDirty(false)
  }
  function newSheet() {
    if (dirty && !confirm('Discard unsaved melody sheet changes?')) return
    setId(null); setTitle(''); setMelodyIds([]); setDirty(false)
  }
  function move(index, direction) {
    const target = index + direction
    if (target < 0 || target >= melodyIds.length) return
    const next = [...melodyIds]; [next[index], next[target]] = [next[target], next[index]]
    setMelodyIds(next); setDirty(true)
  }

  return (
    <div className="ms-page">
      <aside className="ms-sidebar no-print">
        <header><h2>🗒️ Notation Sheet</h2></header>
        <div className="gb-savebar">
          <button className="cc-btn-solid" onClick={save}>{id ? 'Save Changes' : 'Save Sheet'}</button>
          <button className="cc-btn-ghost" onClick={newSheet}>+ New</button>
          <select aria-label="Melody sheet library" value={id || ''} onChange={e => load(e.target.value)}>
            <option value="">Library ({sheets.length})</option>
            {sheets.map(sheet => <option key={sheet.id} value={sheet.id}>{sheet.title}</option>)}
          </select>
          {dirty && <span className="cc-unsaved">● unsaved</span>}
        </div>
        <label className="cc-field"><span>Sheet title</span><input value={title} onChange={e => { setTitle(e.target.value); setDirty(true) }} placeholder="Song or collection name" /></label>
        <div className="ms-picker">
          <span className="ms-label">Add a saved melody</span>
          {available.length ? available.map(melody => <button key={melody.id} onClick={() => { setMelodyIds(ids => [...ids, melody.id]); setDirty(true) }}><strong>{melody.title || 'Untitled melody'}</strong><small>{melody.parts?.length || 1} part{melody.parts?.length === 1 ? '' : 's'} · {melody.timeSignature || '4/4'}</small></button>) : <p>{melodies.length ? 'All saved melodies are on this sheet.' : 'Save a melody in Notation Studio first.'}</p>}
        </div>
        <button className="cc-btn-solid ms-print" onClick={() => window.print()}>Print Sheet</button>
      </aside>
      <main className="ms-main">
        <div className="ms-paper">
          {title && <h1>{title}</h1>}
          {!selected.length ? <p className="ms-empty no-print">Add saved melodies from the left to build a printable sheet.</p> : selected.map((melody, index) => <section className="ms-score" key={`${melody.id}-${index}`}>
            <div className="ms-score-tools no-print"><button onClick={() => move(index,-1)} disabled={!index}>↑</button><button onClick={() => move(index,1)} disabled={index === selected.length - 1}>↓</button><button onClick={() => { setMelodyIds(ids => ids.filter((_,i) => i !== index)); setDirty(true) }}>Remove</button></div>
            <AlphaTabScore tex={buildNotationTex(melody)} />
          </section>)}
        </div>
      </main>
    </div>
  )
}
