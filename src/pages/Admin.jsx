import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const HEARTBEATS_URL = 'https://heartbeats-practice-app.netlify.app'

async function openHeartBeatsSSO() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { window.open(HEARTBEATS_URL, '_blank', 'noopener'); return }
  const { access_token, refresh_token } = session
  window.open(
    `${HEARTBEATS_URL}/#access_token=${access_token}&refresh_token=${refresh_token}&token_type=bearer`,
    '_blank', 'noopener'
  )
}

const liveTools = [
  {
    emoji: '🎸',
    title: 'Chord Chart Builder',
    description: 'Generate print-ready chord charts — full chart, bass/chords, and lyrics sheets.',
    href: '/studio/chord-charts',
  },
  {
    emoji: '🎤',
    title: 'Shows',
    description: 'Build set lists for your shows. Share a link for full chord charts on any device at the gig.',
    href: '/studio/setlists',
  },
  {
    emoji: '📚',
    title: 'Heart Beats Practice App',
    description: 'Daily practice cards, streaks, badges, and lesson tracking for students.',
    sso: true,
  },
]

const devTools = [
  {
    emoji: '📣',
    title: 'Band Social HUD',
    description: 'Step-by-step Facebook post planner for show announcements — caption builder, 18-step checklist, assignee tracking.',
    href: '/tools/band-social-hud.html',
    external: true,
  },
  {
    emoji: '🎼',
    title: 'Tab Builder',
    description: 'Build and export standalone guitar tabs.',
    comingSoon: true,
  },
]

function ToolCard({ tool }) {
  const action = tool.comingSoon ? null : tool.sso ? (
    <button onClick={openHeartBeatsSSO} className="btn btn-primary">Open Tool</button>
  ) : tool.external ? (
    <a href={tool.href} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open Tool</a>
  ) : (
    <Link to={tool.href} className="btn btn-primary">Open Tool</Link>
  )

  return (
    <div className={`tool-card${tool.comingSoon ? ' coming-soon' : ''}`}>
      <div className="tool-icon">{tool.emoji}</div>
      <h3>{tool.title}</h3>
      <p>{tool.description}</p>
      {action ?? <span className="coming-soon-badge">Coming Soon</span>}
    </div>
  )
}

export default function Admin() {
  const { user } = useAuth()

  return (
    <div className="admin-hub">
      <div className="container">
        <div className="admin-hub-header">
          <div className="admin-hub-title-row">
            <h1>Admin Hub</h1>
            <span className="admin-badge">ADMIN</span>
          </div>
          <p className="dashboard-sub">Signed in as {user?.email}</p>
        </div>

        <section className="admin-section">
          <h2 className="admin-section-label">Live Tools</h2>
          <div className="tools-grid">
            {liveTools.map(t => <ToolCard key={t.title} tool={t} />)}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-label-row">
            <h2 className="admin-section-label">In Development</h2>
            <span className="dev-label-note">Not yet live on the public site</span>
          </div>
          <div className="tools-grid">
            {devTools.map(t => (
              <div key={t.title} className={`tool-card${t.comingSoon ? ' coming-soon' : ''}`}>
                <span className="dev-badge">DEV</span>
                <div className="tool-icon">{t.emoji}</div>
                <h3>{t.title}</h3>
                <p>{t.description}</p>
                {t.comingSoon ? (
                  <span className="coming-soon-badge">Coming Soon</span>
                ) : t.external ? (
                  <a href={t.href} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open Tool</a>
                ) : (
                  <Link to={t.href} className="btn btn-primary">Open Tool</Link>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
