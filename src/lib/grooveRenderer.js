// Shared groove rendering helpers used by GrooveBuilder and GrooveSheet

export const INSTRUMENTS = [
  { id: 'crash',        label: 'Crash',       short: 'Cr'  },
  { id: 'hihat_open',   label: 'Hi-Hat Open', short: 'HHo' },
  { id: 'hihat_closed', label: 'Hi-Hat',      short: 'HH'  },
  { id: 'ride',         label: 'Ride',        short: 'Rd'  },
  { id: 'tom1',         label: 'Tom 1',       short: 'T1'  },
  { id: 'tom2',         label: 'Tom 2',       short: 'T2'  },
  { id: 'snare',        label: 'Snare',       short: 'Sn'  },
  { id: 'floor_tom',    label: 'Floor Tom',   short: 'FT'  },
  { id: 'kick',         label: 'Kick',        short: 'K'   },
  { id: 'hihat_foot',   label: 'HH Foot',     short: 'HHf' },
]

export function subdivsPerBeat(d, feel) {
  if (d === 4) return feel === 'straight' ? 4 : 6
  if (d === 8) return feel === 'straight' ? 2 : 3
  return 4
}

export function calcColumns(timeSig, feel) {
  return timeSig.n * subdivsPerBeat(timeSig.d, feel)
}

export function renderGrooveSVG(rows, grid, timeSig, feel, beatGrouping) {
  const cols = calcColumns(timeSig, feel)
  const spb  = subdivsPerBeat(timeSig.d, feel)

  const LABEL_W = 36
  const TSIG_W  = 28
  const CELL_W  = 20
  const ROW_H   = 28
  const PAD_TOP = 8
  const PAD_BOT = 12

  const trackW = cols * CELL_W
  const totalW = LABEL_W + TSIG_W + trackW + 2
  const totalH = rows.length * ROW_H + PAD_TOP + PAD_BOT

  const ns  = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('width',   totalW)
  svg.setAttribute('height',  totalH)
  svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`)
  svg.style.fontFamily = 'Arial, sans-serif'

  const trackX = LABEL_W + TSIG_W

  // Time signature
  const tsNumer = document.createElementNS(ns, 'text')
  tsNumer.setAttribute('x', LABEL_W + TSIG_W / 2)
  tsNumer.setAttribute('y', PAD_TOP + ROW_H * 0.28)
  tsNumer.setAttribute('text-anchor', 'middle')
  tsNumer.setAttribute('font-size', '11')
  tsNumer.setAttribute('font-weight', 'bold')
  tsNumer.setAttribute('fill', '#2D3436')
  tsNumer.textContent = timeSig.n
  svg.appendChild(tsNumer)

  const tsDenom = document.createElementNS(ns, 'text')
  tsDenom.setAttribute('x', LABEL_W + TSIG_W / 2)
  tsDenom.setAttribute('y', PAD_TOP + ROW_H * 0.28 + 13)
  tsDenom.setAttribute('text-anchor', 'middle')
  tsDenom.setAttribute('font-size', '11')
  tsDenom.setAttribute('font-weight', 'bold')
  tsDenom.setAttribute('fill', '#2D3436')
  tsDenom.textContent = timeSig.d
  svg.appendChild(tsDenom)

  // Beat boundaries
  const beatBoundaries = new Set()
  let bCol = 0
  beatGrouping.forEach(beats => { beatBoundaries.add(bCol); bCol += beats * spb })
  beatBoundaries.add(cols)

  rows.forEach((instId, rowIdx) => {
    const inst  = INSTRUMENTS.find(i => i.id === instId) || { short: instId }
    const rowY  = PAD_TOP + rowIdx * ROW_H
    const lineY = rowY + ROW_H * 0.6

    // Label
    const lbl = document.createElementNS(ns, 'text')
    lbl.setAttribute('x', LABEL_W - 4)
    lbl.setAttribute('y', lineY + 4)
    lbl.setAttribute('text-anchor', 'end')
    lbl.setAttribute('font-size', '10')
    lbl.setAttribute('fill', '#636E72')
    lbl.textContent = inst.short
    svg.appendChild(lbl)

    // Rhythm line
    const line = document.createElementNS(ns, 'line')
    line.setAttribute('x1', trackX)
    line.setAttribute('x2', trackX + trackW)
    line.setAttribute('y1', lineY)
    line.setAttribute('y2', lineY)
    line.setAttribute('stroke', '#B2BEC3')
    line.setAttribute('stroke-width', '1')
    svg.appendChild(line)

    // Beat separators
    beatBoundaries.forEach(bc => {
      const x    = trackX + bc * CELL_W
      const full = bc === 0 || bc === cols
      const sep  = document.createElementNS(ns, 'line')
      sep.setAttribute('x1', x); sep.setAttribute('x2', x)
      sep.setAttribute('y1', lineY - (full ? 8 : 5))
      sep.setAttribute('y2', lineY + (full ? 4 : 3))
      sep.setAttribute('stroke', full ? '#636E72' : '#B2BEC3')
      sep.setAttribute('stroke-width', full ? '1.5' : '1')
      svg.appendChild(sep)
    })

    // Hit marks
    const hits = grid[instId] || Array(cols).fill(0)
    hits.forEach((hit, colIdx) => {
      if (!hit) return
      const cx = trackX + colIdx * CELL_W + CELL_W / 2
      const cy = lineY
      const r  = 3.5
      ;[[-1, -1, 1, 1], [1, -1, -1, 1]].forEach(([dx1, dy1, dx2, dy2]) => {
        const ln = document.createElementNS(ns, 'line')
        ln.setAttribute('x1', cx + dx1 * r); ln.setAttribute('y1', cy + dy1 * r)
        ln.setAttribute('x2', cx + dx2 * r); ln.setAttribute('y2', cy + dy2 * r)
        ln.setAttribute('stroke', '#2D3436')
        ln.setAttribute('stroke-width', '1.8')
        ln.setAttribute('stroke-linecap', 'round')
        svg.appendChild(ln)
      })
    })
  })

  return svg
}
