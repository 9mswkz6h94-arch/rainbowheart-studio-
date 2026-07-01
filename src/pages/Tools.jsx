import { Link } from 'react-router-dom'
import { STUDIO_TOOLS } from '../lib/tools'

export default function Tools() {
  const freeTools = STUDIO_TOOLS.filter(t => t.free)
  const studioTools = STUDIO_TOOLS.filter(t => !t.free)

  return (
    <div className="container tools-page">
      <h1 className="tools-title">
        <span className="rainbow-text">Free Tools</span>
      </h1>
      <p className="tools-subtitle">No account needed — open and play.</p>
      <div className="tools-free-grid">
        {freeTools.map(tool => (
          <Link key={tool.slug} to={tool.href} className="tools-free-card">
            <div className="tools-free-icon">{tool.emoji}</div>
            <h3>{tool.title}</h3>
            <p>{tool.description}</p>
            <span className="tools-free-cta">Open →</span>
          </Link>
        ))}
      </div>

      <h2 className="section-title" style={{ marginTop: '3rem' }}>More in the Studio</h2>
      <p className="tools-subtitle">
        Unlocked with a free <Link to="/login">Studio Access</Link> account.
      </p>
      <div className="studio-showcase-grid">
        {studioTools.map(tool => (
          <div key={tool.slug} className="studio-preview-card">
            <div className="studio-preview-icon">{tool.emoji}</div>
            <div className="studio-preview-body">
              <h3>{tool.title}</h3>
              <p>{tool.description}</p>
            </div>
            <span className="studio-preview-lock">🔒 Studio</span>
          </div>
        ))}
      </div>
    </div>
  )
}
