import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const tools = [
  {
    emoji: '🎸',
    title: 'Chord Chart Builder',
    description: 'Generate print-ready chord charts in the Rainbow Hearts style — full chart, bass/chords, and lyrics sheets.',
    status: 'ready',
    href: '/studio/chord-charts',
  },
  {
    emoji: '🎵',
    title: 'Tab Builder',
    description: 'Build and export guitar tabs.',
    status: 'coming-soon',
  },
  {
    emoji: '📚',
    title: 'Heart Beats Practice App',
    description: 'Daily practice cards, streaks, badges, and lesson tracking for your students.',
    status: 'ready',
    href: 'https://heartbeats-practice-app.netlify.app',
    external: true,
  },
]

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="dashboard">
      <div className="container">
        <div className="dashboard-header">
          <h1>Studio Tools</h1>
          <p className="dashboard-sub">Welcome back, {user?.email}</p>
        </div>
        <div className="tools-grid">
          {tools.map((tool) => (
            <div key={tool.title} className={`tool-card ${tool.status}`}>
              <div className="tool-icon">{tool.emoji}</div>
              <h3>{tool.title}</h3>
              <p>{tool.description}</p>
              {tool.status === 'ready' ? (
                tool.external ? (
                  <a href={tool.href} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open Tool</a>
                ) : (
                  <Link to={tool.href} className="btn btn-primary">Open Tool</Link>
                )
              ) : (
                <span className="coming-soon-badge">Coming Soon</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
