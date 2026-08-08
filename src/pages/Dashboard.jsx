import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { STUDIO_TOOLS } from '../lib/tools'
import { fetchDashboardPreferences, saveDashboardPreferences } from '../lib/dashboardPreferences'

const tools = STUDIO_TOOLS.map(tool => ({ ...tool, status: 'ready' }))

async function openToolSSO(baseUrl) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { window.open(baseUrl, '_blank', 'noopener'); return }
  const { access_token, refresh_token } = session
  const url = `${baseUrl.replace(/\/$/, '')}/#access_token=${access_token}&refresh_token=${refresh_token}&token_type=bearer`
  window.open(url, '_blank', 'noopener')
}

export default function Dashboard() {
  const { user } = useAuth()
  const defaultOrder = useMemo(() => tools.map(tool => tool.slug), [])
  const [order, setOrder] = useState(defaultOrder)
  const [hidden, setHidden] = useState([])
  const [customizing, setCustomizing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saveState, setSaveState] = useState('')
  const [dragged, setDragged] = useState(null)
  const saveTimer = useRef(null)

  const normalizeOrder = values => [...(values || []).filter(slug => defaultOrder.includes(slug)), ...defaultOrder.filter(slug => !(values || []).includes(slug))]

  useEffect(() => {
    let active = true
    setLoaded(false)
    fetchDashboardPreferences().then(prefs => {
      if (!active) return
      setOrder(normalizeOrder(prefs?.tool_order))
      setHidden((prefs?.hidden_tools || []).filter(slug => defaultOrder.includes(slug)))
    }).catch(error => {
      console.error('Could not load dashboard preferences', error)
      setSaveState('Preferences need the Supabase migration')
    }).finally(() => { if (active) setLoaded(true) })
    return () => { active = false }
  }, [user?.id])

  useEffect(() => {
    if (!loaded || !user?.id) return
    clearTimeout(saveTimer.current)
    setSaveState('Saving…')
    saveTimer.current = setTimeout(() => {
      saveDashboardPreferences(user.id, order, hidden)
        .then(() => { setSaveState('Saved to your account'); setTimeout(() => setSaveState(''), 1800) })
        .catch(error => { console.error('Could not save dashboard preferences', error); setSaveState('Could not save preferences') })
    }, 450)
    return () => clearTimeout(saveTimer.current)
  }, [order, hidden, loaded, user?.id])

  const orderedTools = order.map(slug => tools.find(tool => tool.slug === slug)).filter(Boolean)
  const visibleTools = orderedTools.filter(tool => !hidden.includes(tool.slug))
  const hiddenTools = orderedTools.filter(tool => hidden.includes(tool.slug))

  function moveTool(slug, direction) {
    setOrder(current => {
      const index = current.indexOf(slug), target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]; [next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }
  function dropTool(targetSlug) {
    if (!dragged || dragged === targetSlug) return setDragged(null)
    setOrder(current => { const next = current.filter(slug => slug !== dragged); next.splice(next.indexOf(targetSlug), 0, dragged); return next })
    setDragged(null)
  }

  return <div className="dashboard"><div className="container">
    <div className="dashboard-header">
      <div><h1>Studio Tools</h1><p className="dashboard-sub">Welcome back, {user?.email}</p></div>
      <div className="dashboard-actions">{saveState && <span className="dashboard-save-state">{saveState}</span>}<button className={customizing ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setCustomizing(value => !value)}>{customizing ? 'Done' : 'Customize Dashboard'}</button></div>
    </div>
    {customizing && <div className="dashboard-customizer"><div><strong>Arrange your Studio</strong><p>Drag cards, use the arrows, or hide tools you do not need. Changes follow your login.</p></div><button className="btn btn-secondary" onClick={() => { setOrder(defaultOrder); setHidden([]) }}>Reset Default</button></div>}
    <div className="tools-grid">
      {visibleTools.map((tool, index) => <div key={tool.slug} className={`tool-card ${tool.status}${customizing ? ' is-customizing' : ''}${dragged === tool.slug ? ' is-dragging' : ''}`} draggable={customizing} onDragStart={() => setDragged(tool.slug)} onDragOver={event => { if (customizing) event.preventDefault() }} onDrop={() => dropTool(tool.slug)}>
        {customizing && <div className="tool-custom-controls"><span className="tool-drag-handle" title="Drag to reorder">⠿</span><button onClick={() => moveTool(tool.slug,-1)} disabled={!index} title="Move earlier">↑</button><button onClick={() => moveTool(tool.slug,1)} disabled={index === visibleTools.length - 1} title="Move later">↓</button><button onClick={() => setHidden(current => [...current, tool.slug])} title="Hide this app">Hide</button></div>}
        <div className="tool-icon">{tool.emoji}</div><h3>{tool.title}</h3><p>{tool.description}</p>
        {tool.sso ? <button onClick={() => openToolSSO(tool.href)} className="btn btn-primary">Open Tool</button> : tool.external ? <a href={tool.href} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open Tool</a> : <Link to={tool.href} className="btn btn-primary">Open Tool</Link>}
      </div>)}
    </div>
    {customizing && <section className="hidden-tools-panel"><h2>Hidden Apps <span>{hiddenTools.length}</span></h2>{hiddenTools.length ? <div className="hidden-tools-list">{hiddenTools.map(tool => <button key={tool.slug} onClick={() => setHidden(current => current.filter(slug => slug !== tool.slug))}><span>{tool.emoji}</span><strong>{tool.title}</strong><small>Show app</small></button>)}</div> : <p>No hidden apps.</p>}</section>}
  </div></div>
}
