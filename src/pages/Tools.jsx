import { Link } from 'react-router-dom'

const FREE_TOOLS = [
  {
    emoji: '🎙',
    title: 'Tuner',
    description: 'Chromatic and instrument tuner — Guitar (Standard + Drop D), Bass, and Ukulele. Listens through your mic, nothing recorded or sent anywhere.',
    href: '/studio/tuner',
  },
  {
    emoji: '🎵',
    title: 'Chord & Scale Explorer',
    description: 'See every chord and scale across all positions on Ukulele, Tenor Guitar, Guitarlele, Acoustic Guitar, and Bass.',
    href: '/tools/chord-scale-explorer',
  },
  {
    emoji: '🥁',
    title: 'Metronome',
    description: 'Precise click track with tap tempo and adjustable time signature. No account needed — open and play.',
    href: '/studio/metronome',
  },
]

export default function Tools() {
  return (
    <div className="container tools-page">
      <h1 className="tools-title">
        <span className="rainbow-text">Free Tools</span>
      </h1>
      <p className="tools-subtitle">No account needed — open and play.</p>
      <div className="tools-free-grid">
        {FREE_TOOLS.map(tool => (
          <Link key={tool.title} to={tool.href} className="tools-free-card">
            <div className="tools-free-icon">{tool.emoji}</div>
            <h3>{tool.title}</h3>
            <p>{tool.description}</p>
            <span className="tools-free-cta">Open →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
