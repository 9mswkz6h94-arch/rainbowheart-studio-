import { useAuth } from '../context/AuthContext'

const tools = [
  {
    emoji: '🎸',
    title: 'Chord Chart Builder',
    description: 'Generate print-ready chord charts in the Rainbow Hearts style.',
    status: 'ready',
    href: '#chord-charts',
  },
  {
    emoji: '🎵',
    title: 'Tab Builder',
    description: 'Build and export guitar tabs.',
    status: 'coming-soon',
  },
  {
    emoji: '📚',
    title: 'Student Practice App',
    description: 'Lesson tracking, session recordings, and progress notes.',
    status: 'coming-soon',
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
                <a href={tool.href} className="btn btn-primary">
                  Open Tool
                </a>
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
