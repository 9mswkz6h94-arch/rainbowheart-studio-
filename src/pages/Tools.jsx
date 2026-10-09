import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { STUDIO_TOOLS } from '../lib/tools'

export default function Tools() {
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'instant' })
    else window.scrollTo({ top: 0, behavior: 'instant' })
  }, [hash])
  const freeTools = STUDIO_TOOLS.filter(tool => tool.free)
  const studioTools = STUDIO_TOOLS.filter(tool => !tool.free)
  return (
    <div className="public-site public-tools" id="public-main" tabIndex={-1}>
      <header className="container public-tools-header">
        <p className="public-eyebrow">Rainbow Heart Studio · Tools</p>
        <h1>Make room for music.</h1>
        <p>Start with a practice tool, or sign in to work with your saved music in the Studio.</p>
        <a href="#free-tools" className="public-text-link">Explore the free tools ↓</a>
      </header>
      <section id="free-tools" className="container public-section" aria-labelledby="free-tools-title">
        <h2 id="free-tools-title">Free tools. No sign-in needed.</h2>
        <p className="public-section-lead">Open a tool and get started. The tuner asks for microphone access when you use it.</p>
        <div className="public-tool-grid">
          {freeTools.map(tool => (
            <article className="public-tool-card" key={tool.slug}>
              <span className="public-status">Free · No sign-in</span>
              <h3>{tool.title}</h3>
              <p>{tool.description}</p>
              <Link to={tool.href} className="public-text-link">Open {tool.title} →</Link>
            </article>
          ))}
        </div>
      </section>
      <section className="container public-section" aria-labelledby="studio-tools-title">
        <h2 id="studio-tools-title">Inside the Studio</h2>
        <p className="public-section-lead">These tools use Studio sign-in. Access to linked apps may depend on your account. Signing in does not book lessons or enroll you in a program.</p>
        <Link to="/login" className="btn btn-primary">Sign in to Studio →</Link>
        <div className="public-tool-grid public-studio-grid">
          {studioTools.map(tool => (
            <article className="public-tool-card" key={tool.slug}>
              <span className="public-status">{tool.sso ? 'Linked Studio app' : 'Studio sign-in'}</span>
              <h3>{tool.title}</h3>
              <p>{tool.description}</p>
              {tool.slug === 'kodaly-song-binder' && <p className="public-tool-note">For Kodály curriculum planning. This is separate from the performance Song Binder being developed.</p>}
              <Link to={tool.sso ? '/studio' : tool.href} className="public-text-link">
                {tool.sso ? `Find ${tool.title} in Studio` : `Open ${tool.title}`} →
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="container public-section">
        <div className="public-development">
          <p className="public-status">In development</p>
          <h2>Performance Song Binder</h2>
          <p>A separate performance Song Binder is being developed. It is not available from this catalog, and offline use is not promised.</p>
          <p>For current show planning, use Show Planner in the Studio.</p>
          <Link to="/studio/setlists" className="public-text-link">Open Show Planner →</Link>
        </div>
      </section>
      <section className="public-section public-tools-intro">
        <div className="container">
          <h2>Looking for a lesson?</h2>
          <p>Tell us what you'd like to learn. We'll talk through the options with you.</p>
          <a href="mailto:info@rainbowheart.studio?subject=Lesson%20inquiry" className="public-text-link">Ask about lessons →</a>
          <Link to="/#education" className="public-text-link">About the developing Education offering →</Link>
        </div>
      </section>
    </div>
  )
}
