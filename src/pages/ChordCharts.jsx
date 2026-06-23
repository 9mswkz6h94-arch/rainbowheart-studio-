import { useState } from 'react'
import { parseChordMark, buildRoadmap } from '../lib/parseChordMark'
import ChartPreview from '../components/charts/ChartPreview'

const DEFAULT_META = {
  title:  '',
  band:   'Brother Jon & The Rainbow Hearts',
  writer: '',
  key:    '',
  meter:  '4/4',
  tempo:  '',
  capo:   '',
}

const PLACEHOLDER = `#intro
Am G F C

#v
Am          G
Singing a song to the world
F              C
Every note a gift for someone

#c
F    G    Am
This is the chorus
F       G      C
Loud and clear and true

#v
Am          G
Second verse same as the first
F              C
A little bit louder and a little bit worse

#c
F    G    Am
This is the chorus
F       G      C
Loud and clear and true

#b
Dm             Am
Bridge comes in now
F                 G
Rising to the sky`

export default function ChordCharts() {
  const [meta, setMeta]       = useState(DEFAULT_META)
  const [songText, setSongText] = useState('')
  const [variant, setVariant] = useState('full')

  const sections = songText.trim() ? parseChordMark(songText) : []
  const roadmap  = sections.length ? buildRoadmap(sections) : ''

  const set = (key) => (e) => setMeta(m => ({ ...m, [key]: e.target.value }))

  return (
    <div className="cc-page">

      {/* ── Input panel ── */}
      <div className="cc-input">
        <div className="cc-input-header">
          <h2>🎸 Chord Chart Builder</h2>
          <button className="btn btn-primary" onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </div>

        {/* Metadata */}
        <div className="cc-meta">
          <label className="cc-field span2">
            Song Title
            <input value={meta.title} onChange={set('title')} placeholder="Untitled" />
          </label>
          <label className="cc-field span2">
            Writer
            <input value={meta.writer} onChange={set('writer')} placeholder="Jonathan Owens" />
          </label>
          <label className="cc-field">
            Key
            <input value={meta.key} onChange={set('key')} placeholder="Am" />
          </label>
          <label className="cc-field">
            Meter
            <input value={meta.meter} onChange={set('meter')} placeholder="4/4" />
          </label>
          <label className="cc-field">
            Tempo
            <input value={meta.tempo} onChange={set('tempo')} placeholder="108 BPM" />
          </label>
          <label className="cc-field">
            Capo
            <input value={meta.capo} onChange={set('capo')} placeholder="Capo 2 · plays Gm" />
          </label>
        </div>

        {/* Variant */}
        <div className="cc-variants">
          {[
            ['full',   'Full Chart'],
            ['chords', 'Bass / Chords'],
            ['lyrics', 'Lyrics'],
          ].map(([v, label]) => (
            <button
              key={v}
              className={`cc-variant-btn${variant === v ? ' active' : ''}`}
              onClick={() => setVariant(v)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Song input */}
        <label className="cc-field cc-field-full">
          Song — ChordMark or chords over lyrics
          <textarea
            className="cc-textarea"
            value={songText}
            onChange={e => setSongText(e.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
          />
        </label>

        <p className="cc-hint">
          Use <code>#v</code> verse · <code>#c</code> chorus · <code>#b</code> bridge ·
          <code>#intro</code> · <code>#outro</code>.
          Put chord symbols on their own line above the lyrics.
        </p>
      </div>

      {/* ── Preview panel ── */}
      <div className="cc-preview">
        <ChartPreview
          meta={meta}
          sections={sections}
          roadmap={roadmap}
          variant={variant}
        />
      </div>

    </div>
  )
}
