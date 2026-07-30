import { normalizeChord } from '../../src/lib/chordGrammar.js'

// Transcribes a photographed/scanned chord chart into this app's ChordMark
// dialect (parseSong in src/lib/chartEngine.js) using Claude's vision input.
// POST { files: [{ mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf', dataBase64 }, ...] }
// One or more images (treated as sequential pages of one song), OR a single PDF.
// -> { ok: true, meta, source, unrecognizedChords, splitWarnings } | { ok: false, error }
//
// The model does NOT hand-format underscore text, and does NOT split lyric
// lines into chord-aligned text chunks — both were tried and both proved too
// error-prone for a fast vision model (dropped/duplicated words, or "dump
// everything on the first chord" laziness under uncertainty). Instead, for
// each chord+lyric line the model returns the lyric line VERBATIM plus, for
// each chord, only the index of the word it lands nearest to — a pointing
// task, not a text-reproduction task. This file deterministically tokenizes
// the verbatim text and inserts underscores at those word boundaries, which
// guarantees the underscore count always equals the chord count and the
// lyric text is never altered. Chords are also normalized here into this
// app's chord grammar (shared with the browser engine — see
// src/lib/chordGrammar.js) so odd source notation (Δ, ø, "-" for minor,
// mixed case, etc.) comes out in a form the chart engine accepts.

// Sonnet gave better spatial/vision reasoning but consistently blew past
// Netlify's ~30s function timeout on a full chart (this project is already
// timeout-sensitive — see the one-image-per-request note above). Haiku stays
// well under the limit; the word-index schema below removes most of what
// made Haiku's output unreliable in the first place, so it's the better
// tradeoff here.
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_BYTES = 15 * 1024 * 1024 // 15MB decoded total across all files, room for a multi-page scan
const MAX_TOKENS = 16000

const ALLOWED_MEDIA_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf',
])

const SYSTEM_PROMPT = `You transcribe a photo or PDF of a hand-written or printed chord chart into a structured JSON representation. Do NOT hand-format underscore-marked text yourself, and do NOT split lyric lines into chord-aligned text chunks yourself — return structured data instead, so exact chord/lyric placement is computed deterministically afterward rather than typed out by you.

SECTION LABELS: a section is identified by a short code: v (verse), c (chorus), b (bridge), pc (pre-chorus), intro, solo, instrumental (or inst), interlude, outro, tag, hook, refrain, vamp, breakdown, coda, ending, chant, drop, turnaround. Add a number directly after the code for repeats you want explicitly numbered, e.g. "v2". If the chart doesn't label sections, infer reasonable labels from structure (verse/chorus/bridge) rather than leaving sections unlabeled.

READING ORDER & LINE BREAKS: each entry in a section's "lines" array should match one physical line/row in the source image, in order, top to bottom. Preserve the source's own line breaks exactly — do not merge two lines into one, and do not split one line into two.

FOR EACH LINE, choose one of two types:

1. Chords-only line — use this ONLY when there is truly no lyric anywhere below that chord row in the image (e.g. a pure intro/instrumental/turnaround bar with nothing sung under it):
   {"type": "chords", "chords": ["Cm", "Eb", "G", "Cm"]}
   List each chord (or "%" for repeat-previous-bar) in left-to-right order. A chord may have trailing dots for rhythmic subdivision within a bar, e.g. "C." for a partial beat.

2. Chord+lyric pair line — use this for EVERY chord row that has ANY lyric text below it, including rhythmic/strum-pattern rows where several chords fall across one word or a held/sustained syllable:
   {"type": "lyrics", "bold": false, "text": "I see the writing on the wall", "chords": [{"chord": "Cm", "beforeWord": 0}, {"chord": "Eb", "beforeWord": 6}]}
   - "text" is the complete lyric line, copied verbatim exactly as printed/written — every word, in order, with nothing added, dropped, or reworded. This is a plain copy task; do not chop it up.
   - "chords" lists every chord in that row, left to right, each with "beforeWord": the 0-based index of the word in "text" (counting words split on whitespace, first word = 0) that the chord's horizontal position in the image lands at or just before. This is a POINTING task — look at where each chord sits above the lyric and identify the nearest word — not a text-splitting task.
   - It is completely normal, and expected, for two or more chords to share the same "beforeWord" — e.g. a strum pattern where several chords fall within or around one word or held syllable. Give them the same index, listed in left-to-right order. A rhythmic row like "G. G. D. D. Em. Em." over "Amazing grace how sweet" might reasonably be [{"chord":"G","beforeWord":0},{"chord":"G","beforeWord":0},{"chord":"D","beforeWord":1},{"chord":"D","beforeWord":1},{"chord":"Em","beforeWord":3},{"chord":"Em","beforeWord":3}].
   - Give each chord its own genuine best-estimate index based on its actual position in the image — do not default every chord in a line to the same index (e.g. all at 0) unless they really are all clustered at the same word; spread them out to match what you actually see when they're spread out in the image.
   - If a chord lands after the very last word (rare — e.g. a trailing chord with nothing sung after it), use an index equal to the total word count.
   - Set "bold": true only if the source clearly marks this exact line as emphasized (e.g. a visibly bigger/bolder hook or title lyric).
   - A plain lyric line with no chord above it at all is still valid: "chords": [].

DO NOT, under any circumstances, split a single chord-row-with-lyric-below-it into a standalone "chords" entry followed by a separate "lyrics" entry that only captures some of the chords. Every chord in that row belongs in the ONE "lyrics" entry's "chords" list, each with its own "beforeWord" — never peel any of them off into a preceding "chords"-only line. A "chords"-type entry must never be immediately followed by a "lyrics"-type entry within the same section.

CRITICAL: every chord visible in a row that has lyric text below it must appear in that line's "chords" array — none omitted, none moved elsewhere. Before moving to the next line, count the chords you saw in the image for this row and count the entries in your "chords" array — they must match.

CHORD SPELLING — write chords in this exact grammar, translating whatever symbol the source uses into it:
  ROOT (A-G) + optional accidental (# or b) + optional quality word from: maj, min, m, dim, aug, sus, add, M + optional digits — then, if the chord has additional alterations or extensions, repeat that pattern (another quality/alteration word plus digits) as many times as needed, e.g. "Cmaj7" (maj+7), "F#m7" (m+7), "Bbsus4" (sus+4), "Gadd9" (add+9), "AM7" (M+7), "Cm7b5" (m+7, then b+5 — half-diminished), "C7#9" (7, then #+9), "C9sus4" (9, then sus+4), "C13b9" (13, then b+9), "CmM7" or "Cmmaj7" (minor-major seventh).
  A slash chord's bass note (after "/") is a bare note letter with an optional accidental ONLY — never put a quality on the bass, e.g. "C/E", never "C/Ebm".
  Translate other notation into this set rather than copying it literally: Δ or ^ → maj (e.g. "CΔ7" → "Cmaj7"); "-" as a minor marker (e.g. "C-7") → m (e.g. "Cm7"); ø (half-diminished) → m7b5 (e.g. "Fø" → "Fm7b5"); ° (diminished) → dim (e.g. "C°7" → "Cdim7"); + → aug. Do not transpose or respell the actual root/bass letters — only normalize the quality notation.

OUTPUT FORMAT: JSON only, no prose, no markdown code fences, matching this shape:
{
  "title": "string or empty",
  "writer": "string or empty",
  "key": "string or empty, e.g. Cm",
  "meter": "string, e.g. 4/4 (default 4/4 if not visible)",
  "tempo": "string or empty, BPM digits only e.g. 108",
  "capo": "string or empty, e.g. Capo 2",
  "sections": [ { "label": "string, e.g. v or c2", "lines": [ /* chords/lyrics line objects as described above */ ] } ]
}
Leave any metadata field as an empty string if it is not visible or not confidently legible on the page — never guess or invent musical facts.

WORKED EXAMPLE (input: a chart with an intro chord line, a verse where each line has two chords — the first landing right at the start of the lyric — and a bolded chorus):
{
  "title": "Belly Crawl",
  "writer": "",
  "key": "Cm",
  "meter": "4/4",
  "tempo": "",
  "capo": "",
  "sections": [
    { "label": "intro", "lines": [ {"type": "chords", "chords": ["Cm", "Eb", "G", "Cm"]} ] },
    { "label": "v", "lines": [
      {"type": "lyrics", "bold": false, "text": "I see the writing on the wall", "chords": [{"chord": "Cm", "beforeWord": 0}, {"chord": "Eb", "beforeWord": 6}]},
      {"type": "lyrics", "bold": false, "text": "Heard it echo down the hall", "chords": [{"chord": "G", "beforeWord": 0}, {"chord": "Cm", "beforeWord": 5}]}
    ]},
    { "label": "c", "lines": [
      {"type": "lyrics", "bold": true, "text": "Belly crawl, we're gonna belly crawl", "chords": [{"chord": "Eb", "beforeWord": 0}, {"chord": "Bb", "beforeWord": 4}]},
      {"type": "lyrics", "bold": false, "text": "Through the fire till we stall", "chords": [{"chord": "Cm", "beforeWord": 0}, {"chord": "G", "beforeWord": 5}]}
    ]}
  ]
}
Notice: the intro line is chords-only (no lyric follows, so it's "type": "chords", not paired). "text" is always the untouched full line; "chords" only ever carries word indices, never text fragments.

SECOND WORKED EXAMPLE — a rhythmic strum row where 6 chords cluster across only 3 words (input: chord row "G. G. D. D. Em. Em." over the lyric "Amazing grace how sweet"):
{"type": "lyrics", "bold": false, "text": "Amazing grace how sweet", "chords": [
  {"chord": "G", "beforeWord": 0}, {"chord": "G", "beforeWord": 0},
  {"chord": "D", "beforeWord": 1}, {"chord": "D", "beforeWord": 1},
  {"chord": "Em", "beforeWord": 3}, {"chord": "Em", "beforeWord": 3}
]}
All 6 chords stay in the ONE "lyrics" entry's "chords" list — two share index 0 (both cluster on "Amazing"), two share index 1 ("grace"), two share index 3 ("sweet"; "how" at index 2 gets none). The WRONG way (never do this) would be emitting {"type": "chords", "chords": ["G","G","D","D","Em"]} as its own entry followed by a separate {"type": "lyrics", "text": "sweet", "chords": [{"chord": "Em", "beforeWord": 0}]} — that discards 5 of the 6 chords from the pairing and is exactly the mistake to avoid. Also wrong: putting all 6 chords at "beforeWord": 0 just because it's easier — only cluster chords that are genuinely close together in the image; here D and Em are visibly further right than G, so they get their own indices.

You are always given exactly one image, or one PDF (which may itself contain multiple pages). If given a multi-page PDF, treat all of its pages as ONE continuous song that simply didn't fit on a single page — read them in page order and produce one unbroken "sections" array spanning every page.`

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function base64ByteLength(b64) {
  const clean = b64.replace(/=+$/, '')
  return Math.floor((clean.length * 3) / 4)
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) throw new Error('No JSON object found in model response')
  return JSON.parse(candidate.slice(start, end + 1))
}

// Splits a lyric line into "word + its trailing whitespace" chunks so that
// joining them back together exactly reproduces the original text. Index N
// into this array is what the model's "beforeWord": N refers to.
function tokenizeWords(text) {
  return String(text ?? '').trim().match(/\S+\s*/g) || []
}

/* Builds the dialect chord-line + underscore-lyric-line pair for one
   "lyrics" entry from its verbatim text + word-indexed chord list. The
   underscore count is guaranteed to equal the chord count by construction —
   one underscore is emitted exactly when a chord token is emitted, in the
   same loop, so they can never drift apart. */
function buildPairedLine(text, chordEntries, norm) {
  const words = tokenizeWords(text)
  const byIndex = new Map()
  for (const entry of Array.isArray(chordEntries) ? chordEntries : []) {
    const rawChord = String(entry?.chord ?? '').trim()
    if (!rawChord) continue
    let idx = Number(entry?.beforeWord)
    if (!Number.isFinite(idx)) idx = 0
    idx = Math.max(0, Math.min(words.length, Math.round(idx)))
    if (!byIndex.has(idx)) byIndex.set(idx, [])
    byIndex.get(idx).push(rawChord)
  }

  const chordToks = []
  let lyricLine = ''
  for (let i = 0; i <= words.length; i++) {
    for (const raw of byIndex.get(i) || []) {
      chordToks.push(norm(raw))
      lyricLine += '_'
    }
    if (i < words.length) lyricLine += words[i]
  }
  return { chordToks, lyricLine, wordCount: words.length }
}

/* ── Deterministic assembly: structured sections → dialect source text ──
   Guarantees underscore count === chord count for every paired line, since
   the underscores are inserted programmatically from the verbatim text +
   word-index list rather than typed or chunked by the model. */
function sectionsToSource(sections) {
  const unrecognized = new Set()
  const splitWarnings = []
  const norm = raw => {
    const { value, ok } = normalizeChord(raw)
    if (!ok && value) unrecognized.add(value)
    return value
  }

  const out = []
  for (const sec of Array.isArray(sections) ? sections : []) {
    const label = String(sec?.label ?? '').trim() || 'v'
    out.push('#' + label)

    const secLines = Array.isArray(sec?.lines) ? sec.lines : []
    let prevWasChordsOnly = false
    for (const ln of secLines) {
      if (ln?.type === 'lyrics' && prevWasChordsOnly) {
        splitWarnings.push(`#${label}: a chord row and the lyric below it came back as separate entries — double-check they line up with the image`)
      }
      prevWasChordsOnly = ln?.type === 'chords'

      if (ln?.type === 'chords') {
        const toks = (Array.isArray(ln.chords) ? ln.chords : []).map(norm).filter(Boolean)
        if (toks.length) out.push(toks.join(' '))
      } else if (ln?.type === 'lyrics') {
        const chordEntries = Array.isArray(ln.chords) ? ln.chords : []
        const { chordToks, lyricLine, wordCount } = buildPairedLine(ln.text, chordEntries, norm)

        // Flag the "everything piled on one word" pattern: more than one
        // chord, none of them dotted (so clustering isn't musically
        // justified), all landing on the same word of a multi-word line.
        if (chordEntries.length > 1 && wordCount > 3) {
          const indices = chordEntries.map(e => Math.max(0, Math.min(wordCount, Math.round(Number(e?.beforeWord) || 0))))
          const allSame = indices.every(i => i === indices[0])
          const noneDotted = chordEntries.every(e => !/\.\s*$/.test(String(e?.chord ?? '').trim()))
          if (allSame && noneDotted) {
            splitWarnings.push(`#${label}: "${chordToks.join(' ')}" — all of that line's chords landed on the same word, which usually means the positions weren't actually matched to the image — double-check`)
          }
        }
        if (chordToks.length) out.push(chordToks.join(' '))
        out.push((ln.bold ? '*' : '') + lyricLine)
      }
    }
    out.push('')
  }

  return {
    source: out.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    unrecognizedChords: [...unrecognized],
    splitWarnings,
  }
}

export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return jsonResponse(500, { ok: false, error: 'Server is missing ANTHROPIC_API_KEY' })
  }

  let payload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON body' })
  }

  const { files } = payload || {}
  if (!Array.isArray(files) || files.length === 0) {
    return jsonResponse(400, { ok: false, error: 'files (a non-empty array) is required' })
  }
  for (const f of files) {
    if (!f?.mediaType || !f?.dataBase64) {
      return jsonResponse(400, { ok: false, error: 'Each file needs a mediaType and dataBase64' })
    }
    if (!ALLOWED_MEDIA_TYPES.has(f.mediaType)) {
      return jsonResponse(400, { ok: false, error: `Unsupported mediaType: ${f.mediaType}` })
    }
  }
  const hasPdf = files.some(f => f.mediaType === 'application/pdf')
  if (hasPdf && files.length > 1) {
    return jsonResponse(400, { ok: false, error: 'Send a PDF by itself, not combined with other files' })
  }
  const totalBytes = files.reduce((sum, f) => sum + base64ByteLength(f.dataBase64), 0)
  if (totalBytes > MAX_BYTES) {
    return jsonResponse(400, { ok: false, error: 'Total file size is too large (15MB max)' })
  }

  const contentBlocks = files.map(f =>
    f.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: f.mediaType, data: f.dataBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.dataBase64 } }
  )

  const headers = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }
  if (hasPdf) {
    headers['anthropic-beta'] = 'pdfs-2024-09-25'
  }

  let anthropicRes
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            ...contentBlocks,
            { type: 'text', text: 'Transcribe this chord chart into the JSON format described in the system prompt.' },
          ],
        }],
      }),
    })
  } catch (e) {
    return jsonResponse(502, { ok: false, error: 'Could not reach the transcription service' })
  }

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text().catch(() => '')
    return jsonResponse(502, { ok: false, error: `Transcription service error (${anthropicRes.status}): ${detail.slice(0, 300)}` })
  }

  const data = await anthropicRes.json()
  const text = data?.content?.find(b => b.type === 'text')?.text || ''

  let parsed
  try {
    parsed = extractJson(text)
  } catch (e) {
    return jsonResponse(502, { ok: false, error: 'Could not parse a transcription from the model response' })
  }

  if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    return jsonResponse(502, { ok: false, error: 'Transcription came back empty' })
  }

  const { source, unrecognizedChords, splitWarnings } = sectionsToSource(parsed.sections)
  if (!source.trim()) {
    return jsonResponse(502, { ok: false, error: 'Transcription came back empty' })
  }

  return jsonResponse(200, {
    ok: true,
    meta: {
      title: parsed.title || '',
      writer: parsed.writer || '',
      key: parsed.key || '',
      meter: parsed.meter || '4/4',
      tempo: parsed.tempo || '',
      capo: parsed.capo || '',
    },
    splitWarnings,
    source,
    unrecognizedChords,
  })
}
