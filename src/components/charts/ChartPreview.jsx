export default function ChartPreview({ meta, sections, roadmap, variant }) {
  const variantLabel =
    variant === 'full'   ? 'FULL CHART' :
    variant === 'chords' ? 'BASS / CHORDS' :
                           'LYRICS'

  const title = meta.title || 'Untitled'

  return (
    <div className="chart-preview" id="chart-print-area">

      {/* ── Masthead ── */}
      <div className="chart-masthead">
        <div className="chart-title">{title}</div>
        <div className="chart-band">{meta.band || 'Brother Jon & The Rainbow Hearts'}</div>

        <div className="chart-spec-strip">
          {[
            ['KEY',    meta.key    || '—'],
            ['METER',  meta.meter  || '—'],
            ['TEMPO',  meta.tempo  || '—'],
            ['WRITER', meta.writer || '—'],
          ].map(([lbl, val]) => (
            <div key={lbl} className="chart-spec-item">
              <span className="chart-spec-label">{lbl}</span>
              <span className="chart-spec-val">{val}</span>
            </div>
          ))}
        </div>

        {meta.capo && <div className="chart-capo">{meta.capo}</div>}
        {roadmap   && <div className="chart-roadmap">{roadmap}</div>}
        <div className="chart-variant-badge">{variantLabel}</div>
      </div>

      {/* ── Body ── */}
      <div className="chart-body">
        {sections.length === 0 ? (
          <div className="chart-empty">
            Paste your song on the left to see the chart.
          </div>
        ) : (
          sections.map((section, idx) => (
            <div key={idx} className="chart-section">
              <div className="chart-section-label">
                {section.label}{section.count > 1 ? ` ${section.count}` : ''}
              </div>

              <div className="chart-section-body">
                {section.rows.map((row, ridx) => {
                  if (row.type === 'chord-lyric') {
                    if (variant === 'lyrics') {
                      return row.lyric
                        ? <div key={ridx} className="chart-lyric-line">{row.lyric}</div>
                        : null
                    }
                    if (variant === 'chords') {
                      return (
                        <div key={ridx} className="chart-chord-bar">
                          <span className="chart-chords">{row.chords}</span>
                          {row.lyric && (
                            <span className="chart-chord-cue">
                              {row.lyric.split(/\s+/).slice(0, 5).join(' ')}…
                            </span>
                          )}
                        </div>
                      )
                    }
                    // full
                    return (
                      <div key={ridx} className="chart-pair">
                        <div className="chart-chords">{row.chords}</div>
                        {row.lyric && <div className="chart-lyric-line">{row.lyric}</div>}
                      </div>
                    )
                  }

                  if (row.type === 'lyric') {
                    if (variant === 'chords') return null
                    return <div key={ridx} className="chart-lyric-line">{row.lyric}</div>
                  }

                  return null
                })}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}
