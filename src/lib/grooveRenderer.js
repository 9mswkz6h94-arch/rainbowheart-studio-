// Shared groove rendering helpers used by GrooveBuilder, GrooveSheet and the
// Chart Studio Grooves sheet variant

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

/* Count syllable for a grid column — "1 e & a", "1 & a", "1 &" etc.
   Shared by the notation SVG and the Groove Builder editor header. */
export function countSyllable(colIdx, spb) {
  const beatIdx = Math.floor(colIdx / spb)
  const pos     = colIdx % spb
  if (pos === 0) return String(beatIdx + 1)
  if (spb === 4) return ['', 'e', '&', 'a'][pos]
  if (spb === 2) return '&'
  if (spb === 3) return ['', '&', 'a'][pos]
  if (spb === 6) return pos === 3 ? '&' : '·'
  return '·'
}

export function renderGrooveSVG(rows, grid, timeSig, feel, beatGrouping) {
  const cols = calcColumns(timeSig, feel)
  const spb  = subdivsPerBeat(timeSig.d, feel)

  const LABEL_W = 36
  const TSIG_W  = 28
  const CELL_W  = 20
  const ROW_H   = 28
  const PAD_TOP = 8
  const RHY_H   = 24   // composite rhythm lane (stems + beams, alphaTab style)
  const CNT_H   = 14   // count row ("1 e & a …")
  const PAD_BOT = 8

  const trackW = cols * CELL_W
  const totalW = LABEL_W + TSIG_W + trackW + 2
  const totalH = rows.length * ROW_H + PAD_TOP + RHY_H + CNT_H + PAD_BOT

  const ns  = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('width',   totalW)
  svg.setAttribute('height',  totalH)
  svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`)
  svg.style.fontFamily = 'Arial, sans-serif'

  const trackX = LABEL_W + TSIG_W
  const colX   = c => trackX + c * CELL_W + CELL_W / 2

  const mkLine = (x1, y1, x2, y2, stroke, w, cap) => {
    const ln = document.createElementNS(ns, 'line')
    ln.setAttribute('x1', x1); ln.setAttribute('y1', y1)
    ln.setAttribute('x2', x2); ln.setAttribute('y2', y2)
    ln.setAttribute('stroke', stroke)
    ln.setAttribute('stroke-width', w)
    if (cap) ln.setAttribute('stroke-linecap', cap)
    svg.appendChild(ln)
    return ln
  }
  const mkText = (x, y, size, fill, txt, bold) => {
    const t = document.createElementNS(ns, 'text')
    t.setAttribute('x', x); t.setAttribute('y', y)
    t.setAttribute('text-anchor', 'middle')
    t.setAttribute('font-size', size)
    t.setAttribute('fill', fill)
    if (bold) t.setAttribute('font-weight', 'bold')
    t.textContent = txt
    svg.appendChild(t)
    return t
  }

  // Time signature
  mkText(LABEL_W + TSIG_W / 2, PAD_TOP + ROW_H * 0.28,      11, '#2D3436', timeSig.n, true)
  mkText(LABEL_W + TSIG_W / 2, PAD_TOP + ROW_H * 0.28 + 13, 11, '#2D3436', timeSig.d, true)

  // Beat-group boundaries
  const beatBoundaries = new Set()
  let bCol = 0
  beatGrouping.forEach(beats => { beatBoundaries.add(bCol); bCol += beats * spb })
  beatBoundaries.add(cols)

  rows.forEach((instId, rowIdx) => {
    const inst  = INSTRUMENTS.find(i => i.id === instId) || { short: instId }
    const rowY  = PAD_TOP + rowIdx * ROW_H
    const lineY = rowY + ROW_H * 0.6

    // Label
    const lbl = mkText(LABEL_W - 4, lineY + 4, 10, '#636E72', inst.short)
    lbl.setAttribute('text-anchor', 'end')

    // Rhythm line
    mkLine(trackX, lineY, trackX + trackW, lineY, '#B2BEC3', 1)

    // Beat separators
    beatBoundaries.forEach(bc => {
      const x    = trackX + bc * CELL_W
      const full = bc === 0 || bc === cols
      mkLine(x, lineY - (full ? 8 : 5), x, lineY + (full ? 4 : 3), full ? '#636E72' : '#B2BEC3', full ? 1.5 : 1)
    })

    // Hit marks (X)
    const hits = grid[instId] || Array(cols).fill(0)
    hits.forEach((hit, colIdx) => {
      if (!hit) return
      const cx = colX(colIdx)
      const cy = lineY
      const r  = 3.5
      ;[[-1, -1, 1, 1], [1, -1, -1, 1]].forEach(([dx1, dy1, dx2, dy2]) => {
        mkLine(cx + dx1 * r, cy + dy1 * r, cx + dx2 * r, cy + dy2 * r, '#2D3436', 1.8, 'round')
      })
    })
  })

  /* ── Composite rhythm lane — the union of all hits, written like alphaTab's
     tab rhythm: stems down to a beam, double-beam ticks for 16th-level notes,
     a flag when a stem stands alone in its beam group ── */
  const laneTop = PAD_TOP + rows.length * ROW_H + 3
  const beamY   = laneTop + 16
  const INK     = '#2D3436'

  const hitCols = []
  for (let c = 0; c < cols; c++) {
    if (rows.some(id => (grid[id] || [])[c])) hitCols.push(c)
  }

  // Beam groups follow the beat grouping (e.g. 6/8 beams in threes)
  const groups = []
  let gStart = 0
  beatGrouping.forEach(beats => {
    const gCols = beats * spb
    groups.push([gStart, gStart + gCols - 1])
    gStart += gCols
  })

  // Is this column an eighth-note position (vs a deeper 16th-level subdivision)?
  const isEighthLevel = c => {
    const pos = c % spb
    if (spb === 4) return pos % 2 === 0   // 16ths in /4: e + a are deeper
    if (spb === 2) return pos === 0        // 16ths in /8
    if (spb === 6) return pos % 3 === 0    // 16th triplets in /4
    if (spb === 3) return pos === 0        // triplets in /8
    return true
  }

  groups.forEach(([g0, g1]) => {
    const stems = hitCols.filter(c => c >= g0 && c <= g1)
    if (!stems.length) return

    // Stems
    stems.forEach(c => mkLine(colX(c), laneTop, colX(c), beamY, INK, 1.6, 'round'))

    if (stems.length >= 2) {
      // Level-1 beam across the group's hits
      mkLine(colX(stems[0]), beamY, colX(stems[stems.length - 1]), beamY, INK, 2.6, 'round')
      // Level-2 ticks for 16th-level stems — join to an adjacent-column hit
      // when there is one, otherwise a short stub toward the beat it belongs to
      stems.forEach((c, i) => {
        if (isEighthLevel(c)) return
        const x = colX(c)
        const joinR = stems[i + 1] === c + 1
        const joinL = stems[i - 1] === c - 1
        if (joinR)      mkLine(x, beamY - 4, colX(c + 1), beamY - 4, INK, 2.2, 'round')
        else if (joinL) mkLine(colX(c - 1), beamY - 4, x, beamY - 4, INK, 2.2, 'round')
        else            mkLine(x - (c === g0 ? 0 : 7), beamY - 4, x + (c === g0 ? 7 : 0), beamY - 4, INK, 2.2, 'round')
      })
    } else {
      // Lone stem: flag (double for a 16th-level position)
      const x = colX(stems[0])
      mkLine(x, beamY, x + 6, beamY - 5, INK, 1.8, 'round')
      if (!isEighthLevel(stems[0])) mkLine(x, beamY - 4, x + 6, beamY - 9, INK, 1.8, 'round')
    }
  })

  /* ── Count row — "1 e & a 2 e & a …" ── */
  const cntY = laneTop + RHY_H + 8
  for (let c = 0; c < cols; c++) {
    const syl    = countSyllable(c, spb)
    const isBeat = c % spb === 0
    mkText(colX(c), cntY, isBeat ? 10 : 8.5, isBeat ? INK : '#9aa2a6', syl, isBeat)
  }

  return svg
}
