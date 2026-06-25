/**
 * Rainbow Hearts Chart Studio — Engine
 * Ported from RainbowHearts_ChartStudio_10.html
 *
 * Exports:
 *   parseSong(src, meta)         → song model
 *   layout(song, key, opts, el)  → { html, N, cols }
 *   fitTitles(rootEl)
 *   rescale(stageEl)
 *   shiftKey(key, n, acc)
 */

/* ── Chord / transposition helpers ── */
const SCALE_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const SCALE_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
const NOTE_IDX = {
  C:0,'B#':0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,Fb:4,
  F:5,'E#':5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,Cb:11
}

function spellNote(note, shift, acc) {
  const i = NOTE_IDX[note]
  if (i == null) return note
  const j = ((i + (shift || 0)) % 12 + 12) % 12
  return (acc === 'flat' ? SCALE_FLAT : SCALE_SHARP)[j]
}

export function shiftKey(key, n, acc) {
  if (!key) return key
  const m = String(key).match(/^([A-G](?:#|b)?)(.*)$/)
  return m ? spellNote(m[1], n, acc) + m[2] : key
}

function respell(ch, acc, shift) {
  if (!ch || ch === '%') return ch
  return ch.split('/').map(part => {
    const m = part.match(/^([A-G](?:#|b)?)(.*)$/)
    return m ? spellNote(m[1], shift, acc) + m[2] : part
  }).join('/')
}

const CHORD_RE = /^(%|[A-G](#|b)?(maj|min|m|dim|aug|sus|add|M)?[0-9]*(\/[A-G](#|b)?)?)(\.*)$/
const isChordTok = t => CHORD_RE.test(t)
const isChordLine = l => {
  const t = l.trim().split(/\s+/).filter(Boolean)
  return t.length > 0 && t.every(isChordTok)
}

function barsFromTokens(tokens, bpb, acc, shift) {
  const bars = []; let cur = [], curB = 0
  const flush = () => { if (cur.length) { bars.push(cur); cur = []; curB = 0 } }
  for (const tok of tokens) {
    const m = tok.match(/^(.*?)(\.*)$/)
    const chord = respell(m[1] || tok, acc, shift)
    const dots = m[2].length
    if (dots === 0) { flush(); bars.push([[chord, bpb]]) }
    else {
      cur.push([chord, dots]); curB += dots
      if (curB >= bpb) { bars.push(cur); cur = []; curB = 0 }
    }
  }
  flush()
  return bars
}

function placeChords(tokens, lyric, acc, shift) {
  const chords = tokens
    .filter(t => !t.startsWith('%'))
    .map(t => respell(t.replace(/\.+$/, ''), acc, shift))
  const parts = lyric.split('_')
  if (parts.length === 1) return [{ chord: chords[0] || '', text: lyric }]
  const segs = []
  if (parts[0] !== '') segs.push({ chord: '', text: parts[0] })
  for (let k = 1; k < parts.length; k++) segs.push({ chord: chords[k - 1] || '', text: parts[k] })
  return segs
}

const CODE = {
  v:'Verse', c:'Chorus', b:'Bridge', pc:'Pre-Chorus',
  verse:'Verse', chorus:'Chorus', bridge:'Bridge',
  'pre-chorus':'Pre-Chorus', prechorus:'Pre-Chorus',
  intro:'Intro', solo:'Solo', instrumental:'Instrumental',
  inst:'Instrumental', interlude:'Interlude',
  outro:'Outro', tag:'Tag', hook:'Hook', refrain:'Refrain',
  vamp:'Vamp', breakdown:'Breakdown', coda:'Coda',
  ending:'Ending', chant:'Chant', drop:'Drop', turnaround:'Turnaround'
}

const titleCaseWords = s =>
  s.split(/\s+/).map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ')
const boldMark = s => {
  const b = /^\s*\*\s?/.test(s)
  return [b, b ? s.replace(/^\s*\*\s?/, '') : s]
}

function resolveLabel(raw) {
  raw = (raw || '').trim()
  if (!raw) return { label: 'Section', explicit: true }
  const parts = raw.split(/\s+/)
  const first = parts[0].toLowerCase()
  let m
  if (parts.length === 1 && (m = first.match(/^([a-z][a-z-]*?)(\d+)$/)) && CODE[m[1]])
    return { label: CODE[m[1]] + ' ' + m[2], explicit: true }
  if (CODE[first]) {
    const base = CODE[first]
    const rest = parts.slice(1).join(' ').trim()
    if (rest === '') return { label: base, explicit: false, base }
    if (/^\d+$/.test(rest)) return { label: base + ' ' + rest, explicit: true }
    return { label: base + ' ' + titleCaseWords(rest), explicit: true }
  }
  return { label: titleCaseWords(raw), explicit: true }
}

/* ── Parser ── */
export function parseSong(src, meta) {
  const bpb    = parseInt((meta.meter || '4/4').split('/')[0], 10) || 4
  const acc    = meta.accidentals || 'flat'
  const tShift = parseInt(meta.transpose, 10) || 0
  const capoFret   = parseInt(meta.capo, 10) || 0
  const capoShapes = meta.capoShapes !== false
  const shift = tShift - ((capoShapes && capoFret > 0) ? capoFret : 0)

  const raw  = src.replace(/\r/g, '').split('\n')
  const secs = []; let cur = null

  for (const line0 of raw) {
    const line = line0.replace(/\s+$/, '')
    if (/^\s*#/.test(line)) {
      cur = { raw: line.trim().replace(/^#\s*/, ''), lines: [] }
      secs.push(cur)
    } else if (line.trim() === '') {
      continue
    } else if (cur) {
      cur.lines.push(line)
    } else {
      cur = { raw: '', lines: [line] }; secs.push(cur)
    }
  }

  secs.forEach(s => {
    const r = resolveLabel(s.raw)
    s.label = r.label; s.explicit = r.explicit; s.base = r.base || null
  })

  const bcounts = {}
  secs.forEach(s => { if (!s.explicit && s.base) bcounts[s.base] = (bcounts[s.base] || 0) + 1 })
  const bseen = {}
  secs.forEach(s => {
    if (!s.explicit && s.base && bcounts[s.base] > 1) {
      bseen[s.base] = (bseen[s.base] || 0) + 1
      s.label = s.base + ' ' + bseen[s.base]
    }
    s.sig = s.lines.join('\n')
  })

  const firstSig = {}
  secs.forEach((s, i) => { if (firstSig[s.sig] === undefined) firstSig[s.sig] = i })
  secs.forEach((s, i) => { const f = firstSig[s.sig]; s.repeatOf = (f < i) ? secs[f].label : null })

  const full = [], grid = [], lyrics = []

  for (const s of secs) {
    const F  = { label: s.label, repeatOf: s.repeatOf, lines: [] }
    const G  = { label: s.label, repeatOf: s.repeatOf, lines: [] }
    const Ly = { label: s.label, lines: [] }
    const L  = s.lines; let i = 0

    while (i < L.length) {
      if (isChordLine(L[i])) {
        const toks = L[i].trim().split(/\s+/)
        if (i + 1 < L.length && !isChordLine(L[i + 1])) {
          const [bld, lyr] = boldMark(L[i + 1])
          F.lines.push({ type: 'pair', bold: bld, segs: placeChords(toks, lyr, acc, shift) })
          const bars = barsFromTokens(toks, bpb, acc, shift)
          G.lines.push({ chord: true, bars, text: bars.map(b => '|' + b.map(x => x[0]).join(' ')).join(' ') + ' |' })
          G.lines.push({ chord: false, bold: bld, text: lyr.replace(/_/g, '').trim() })
          Ly.lines.push({ bold: bld, text: lyr.replace(/_/g, '').trim() })
          i += 2
        } else {
          F.lines.push({ type: 'rhythm', bars: barsFromTokens(toks, bpb, acc, shift) })
          const bars = barsFromTokens(toks, bpb, acc, shift)
          G.lines.push({ chord: true, bars, text: bars.map(b => '|' + b.map(x => x[0]).join(' ')).join(' ') + ' |' })
          i += 1
        }
      } else {
        const [bld, lyr] = boldMark(L[i])
        F.lines.push({ type: 'pair', bold: bld, segs: [{ chord: '', text: lyr.replace(/_/g, '') }] })
        Ly.lines.push({ bold: bld, text: lyr.replace(/_/g, '').trim() })
        i += 1
      }
    }
    full.push(F); grid.push(G); lyrics.push(Ly)
  }

  const tabLines = Array.isArray(meta.tab) ? meta.tab : []
  return { meta, structure: secs.map(s => s.label), full, grid, lyrics, tab: tabLines }
}

/* ── Renderers ── */
const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const ABBR = {
  Verse: 'V', Chorus: 'C', Instrumental: 'Inst', 'Pre-Chorus': 'PC',
  Bridge: 'Br', Intro: 'Intro', Outro: 'Outro', Interlude: 'Int', Solo: 'Solo'
}
function abbr(label) {
  for (const k in ABBR) { if (label.startsWith(k)) return (ABBR[k] + label.slice(k.length)).replace(/ /g, '') }
  return label
}
const slashes = n => Array(Math.max(1, n)).fill('/').join('&nbsp;')

function rhythmRows(rows) {
  let out = ''
  for (const bars of rows) {
    for (let i = 0; i < bars.length; i += 4) {
      const chunk = bars.slice(i, i + 4)
      const bh = chunk.map(bar => {
        const grp = bar.map(([c, b]) =>
          `<div class="grp"><div class="rch">${c ? esc(c) : '&nbsp;'}</div><div class="slashes">${slashes(b)}</div></div>`
        ).join('')
        return `<div class="rbar">${grp}</div>`
      })
      out += '<div class="rhythm">' + bh.join('<div class="rsep"></div>') + '</div>'
    }
  }
  return `<div class="rhythm-wrap">${out}</div>`
}

function renderLine(segs, cls) {
  const cells = segs.map(s =>
    `<span class="seg"><span class="ch">${s.chord ? esc(s.chord) : '&nbsp;'}</span><span class="ly">${esc(s.text)}</span></span>`
  ).join('')
  return `<div class="${cls || 'line'}">${cells}</div>`
}

function secFull(song, collapse, withTab, withUke) {
  let arr = []
  const tabBlk = blk =>
    arr.push(`<div class="section"><div class="seclabel">${esc(blk.label || 'Tab')}</div><pre class="tabblk">${esc((blk.lines || []).join('\n'))}</pre></div>`)
  if (withTab) (song.tab || []).filter(t => t.target === 'full').forEach(tabBlk)
  if (withUke) (song.tab || []).filter(t => t.target === 'uke').forEach(tabBlk)

  arr = arr.concat(song.full.map(sec => {
    let h = `<div class="section"><div class="seclabel">${esc(sec.label)}</div>`
    if (collapse && sec.repeatOf) return h + `<div class="repeat-ref">Repeat ${esc(sec.repeatOf)}</div></div>`
    const L = sec.lines; let i = 0
    while (i < L.length) {
      if (L[i].type === 'rhythm') {
        const g = []
        while (i < L.length && L[i].type === 'rhythm') { g.push(L[i].bars); i++ }
        h += rhythmRows(g)
      } else {
        const hook = i === 0 && !sec.label.startsWith('Intro') && !sec.label.startsWith('Solo') && !sec.label.startsWith('Instrumental')
        const cls = 'line' + (hook ? ' hook' : '') + (L[i].bold ? ' bold' : '')
        h += renderLine(L[i].segs, cls)
        i++
      }
    }
    return h + '</div>'
  }))
  return arr
}

function gridBars(bars) {
  let out = ''
  for (let i = 0; i < bars.length; i += 4) {
    const row = bars.slice(i, i + 4).map(bar => {
      const lab = bar.map(([c]) => c === '%' ? '&#37;' : esc(c)).join(' ')
      return `<div class="gbar"><div class="gbar-ch">${lab || '&nbsp;'}</div></div>`
    }).join('')
    out += `<div class="gbars">${row}</div>`
  }
  return out
}

function secGrid(song, collapse, withTab, write) {
  let arr = []
  if (withTab) (song.tab || []).filter(t => t.target === 'bass').forEach(blk =>
    arr.push(`<div class="section"><div class="seclabel">${esc(blk.label || 'Tab')}</div><pre class="tabblk">${esc((blk.lines || []).join('\n'))}</pre></div>`)
  )
  arr = arr.concat(song.grid.map(sec => {
    let h = `<div class="section"><div class="seclabel">${esc(sec.label)}</div>`
    if (collapse && sec.repeatOf) return h + `<div class="repeat-ref">Repeat ${esc(sec.repeatOf)}</div></div>`
    for (const ln of sec.lines) {
      if (ln.chord && write && ln.bars) h += gridBars(ln.bars)
      else {
        const cls = ln.chord ? 'grid-chord' : ('grid-cue' + (ln.bold ? ' bold' : ''))
        h += `<div class="${cls}">${esc(ln.text)}</div>`
      }
    }
    return h + '</div>'
  }))
  return arr
}

function secLyrics(song) {
  return song.lyrics.map(sec => {
    let h = `<div class="section"><div class="seclabel">${esc(sec.label)}</div>`
    sec.lines.forEach((o, j) => {
      const cls = 'lyric-big' + (j === 0 ? ' hook' : '') + (o.bold ? ' bold' : '')
      h += `<div class="${cls}">${esc(o.text)}</div>`
    })
    return h + '</div>'
  })
}

function tempoHTML(m) {
  if (!m.tempo) return '&mdash;'
  const glyph = (m.note || 'quarter') === 'half'
    ? '<svg viewBox="0 0 10 16" style="width:.58em;height:1em;display:inline-block;vertical-align:-.12em;margin-right:2px"><rect x="7" y="1.2" width="1.4" height="11" fill="currentColor"/><ellipse cx="4" cy="12" rx="3.4" ry="2.5" fill="none" stroke="currentColor" stroke-width="1.5" transform="rotate(-22 4 12)"/></svg>'
    : '&#9833;'
  return `${glyph} = ${esc(m.tempo)}`
}

function masthead(song) {
  const m = song.meta
  const acc      = m.accidentals || 'flat'
  const tShift   = parseInt(m.transpose, 10) || 0
  const capoFret = parseInt(m.capo, 10) || 0
  const capoShapes = m.capoShapes !== false
  const soundKey = shiftKey(m.key, tShift, acc)

  let capoSub = ''
  if (capoFret > 0 && capoShapes) {
    const shapeKey = shiftKey(m.key, tShift - capoFret, acc)
    capoSub = 'Capo ' + capoFret + (shapeKey ? (' · play in ' + shapeKey) : '')
  } else if (m.capo) {
    capoSub = 'Capo ' + m.capo
  }

  const keyVal = (soundKey ? esc(soundKey) : '&mdash;') +
    (tShift ? ` <span style="font-size:.58em;color:var(--lab);font-family:'Space Mono',monospace">(${tShift > 0 ? '+' : ''}${tShift})</span>` : '')

  const cells = [
    ['Key',    keyVal,         capoSub ? esc(capoSub) : ''],
    ['Meter',  esc(m.meter) || '&mdash;', ''],
    ['Tempo',  tempoHTML(m),   ''],
    ['Writer', esc(m.writer) || '&mdash;', ''],
  ]
  const spec = cells.map(([lab, val, sub]) =>
    `<div class="cell"><div class="lab">${lab}</div><div class="val">${val}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`
  ).join('')

  const structure = song.structure.map(s => m.structFull ? s : abbr(s)).join(' &middot; ')

  return `<svg class="ebsvg"><text class="eyebrow">${esc(m.band || '').toUpperCase()}</text></svg>`
    + `<svg class="titlesvg"><text class="title">${esc(m.title || '').toUpperCase()}</text></svg>`
    + `<div class="spec">${spec}</div>`
    + `<div class="structure"><span class="skey">STRUCTURE</span> ${structure}</div>`
}

/* ── fitTitles — size SVG text to fill width ── */
export function fitTitles(root) {
  root.querySelectorAll('.titlesvg').forEach(svg => {
    const t = svg.querySelector('text')
    const T = svg.getBoundingClientRect().width
    if (!T) return
    if (!(t.textContent || '').trim()) { svg.setAttribute('height', 0); return }
    t.removeAttribute('textLength')
    let fs = 100; t.style.fontSize = fs + 'px'
    const w = t.getComputedTextLength() || 1
    fs = fs * (T / w); t.style.fontSize = fs + 'px'
    t.setAttribute('x', T / 2)
    t.setAttribute('y', fs * 0.72)
    t.setAttribute('textLength', T)
    t.setAttribute('lengthAdjust', 'spacingAndGlyphs')
    svg.setAttribute('height', Math.ceil(fs * 0.76))
  })
  root.querySelectorAll('.ebsvg').forEach(svg => {
    const t = svg.querySelector('text')
    const T = svg.getBoundingClientRect().width
    if (!T) return
    const fs = parseFloat(getComputedStyle(t).fontSize)
    t.setAttribute('x', T / 2)
    t.setAttribute('y', fs * 0.85)
    t.setAttribute('textLength', T)
    t.setAttribute('lengthAdjust', 'spacing')
    svg.setAttribute('height', Math.ceil(fs * 1.15))
  })
}

/* ── Layout engine — packs sections into Letter pages ── */
const DPI    = 96
const PAGE_H = 11 * DPI   // 1056px
const COL_W  = 333         // two-column width
const FULL_W = 697         // single-column width

export function layout(song, key, opts, measureEl) {
  const compact    = opts.compact
  const PAD_T      = (compact ? 0.4  : 0.45) * DPI
  const PAD_B      = (compact ? 0.42 : 0.6)  * DPI
  const PBODY_GAP  = compact ? 9 : 14
  const FOOTER_CLR = 100  // conservative: reserve space for footer + rendering headroom (measured heights often underestimate actual rendered heights)

  const VAR = {
    full:   ['Full Chart',    () => secFull(song, opts.collapse, opts.tabOnFull, opts.tabOnUke)],
    bass:   ['Bass / Chords', () => secGrid(song, opts.collapse, opts.tabOnBass)],
    chords: ['Chords',        () => secGrid(song, opts.collapse, false, opts.writeBars)],
    lyrics: ['Lyrics',        () => secLyrics(song)],
  }
  const [vlabel, builder] = VAR[key] || VAR['full']
  const secs = builder()

  /* Measure section heights offscreen */
  measureEl.className = compact ? 'compact' : ''
  measureEl.innerHTML =
    `<div class="page"><header>${masthead(song)}</header>`
    + `<div id="mD" class="col rc-narrow" style="width:${COL_W}px">${secs.join('')}</div>`
    + `<div id="mS" class="col"           style="width:${FULL_W}px">${secs.join('')}</div></div>`
  fitTitles(measureEl)

  const head = measureEl.querySelector('header').offsetHeight
  const mb   = el => parseFloat(getComputedStyle(el).marginBottom) || 0
  const D    = [...measureEl.querySelector('#mD').children].map(c => c.offsetHeight + mb(c))
  const S    = [...measureEl.querySelector('#mS').children].map(c => c.offsetHeight + mb(c))

  /* Detect whether single-column is needed */
  const widths = []
  measureEl.querySelectorAll('#mS .line, #mS .lyric-big, #mS .grid-chord').forEach(el => {
    const fw = el.style.flexWrap, ws = el.style.whiteSpace, w = el.style.width
    el.style.flexWrap = 'nowrap'; el.style.whiteSpace = 'nowrap'; el.style.width = 'max-content'
    widths.push(el.scrollWidth)
    el.style.flexWrap = fw; el.style.whiteSpace = ws; el.style.width = w
  })
  const maxw       = widths.reduce((a, b) => Math.max(a, b), 0)
  const frac       = widths.filter(w => w > COL_W).length / Math.max(1, widths.length)
  const autoSingle = frac > 0.30 || maxw > COL_W * 1.6
  const ov         = (song.meta.layout || 'auto').toLowerCase()
  let cols = ov === 'single' ? 1 : ov === 'double' ? 2 : (autoSingle ? 1 : 2)

  const fullHasTab = (opts.tabOnFull && (song.tab || []).some(t => t.target === 'full'))
    || (opts.tabOnUke && (song.tab || []).some(t => t.target === 'uke'))
  if (key === 'bass' || key === 'chords' || (key === 'full' && fullHasTab)) cols = 1

  /* Pack sections into pages */
  const sh    = cols === 1 ? S : D
  const colw  = cols === 1 ? FULL_W : COL_W
  const bodyH = PAGE_H - PAD_T - PAD_B - head - PBODY_GAP - FOOTER_CLR
  const pages = [[[]]]

  for (let i = 0; i < sh.length; i++) {
    const curp = pages[pages.length - 1]
    const last = curp[curp.length - 1]
    const sum  = last.reduce((a, j) => a + sh[j], 0)
    if (last.length === 0 || sum + sh[i] <= bodyH) last.push(i)
    else if (curp.length < cols) curp.push([i])
    else pages.push([[i]])
  }

  const N = pages.length; let html = ''
  pages.forEach((pcols, p) => {
    let colHTML = ''
    for (let c = 0; c < cols; c++) {
      const items = (pcols[c] || []).map(i => secs[i]).join('')
      colHTML += `<div class="col${cols === 2 ? ' rc-narrow' : ''}" style="width:${colw}px">${items}</div>`
    }
    const divider = cols === 2 ? '<div class="divider"></div>' : ''
    html +=
      `<div class="page">`
      + `<header>${masthead(song)}</header>`
      + `<div class="pbody${cols === 2 ? ' two' : ''}">${divider}${colHTML}</div>`
      + `<footer><span class="variant">${esc(vlabel)}</span>`
      + `<span>${esc(song.meta.title || '')} &nbsp;&middot;&nbsp; PAGE ${p + 1} / ${N}</span></footer>`
      + `</div>`
  })

  return { html, N, cols, compact }
}

/* ── Rescale pages to fit the preview panel ── */
export function rescale(stageEl) {
  if (!stageEl) return
  const avail = stageEl.clientWidth
  const scale = Math.min(1, (avail - 40) / (8.5 * DPI))
  stageEl.querySelectorAll('.page').forEach(pg => {
    pg.style.transformOrigin = 'top center'
    pg.style.transform       = `scale(${scale})`
    pg.style.marginBottom    = (scale < 1 ? -(1 - scale) * PAGE_H + 18 : 18) + 'px'
  })
}
