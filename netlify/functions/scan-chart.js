// Transcribes a photographed/scanned chord chart into this app's ChordMark
// dialect (parseSong in src/lib/chartEngine.js) using Claude's vision input.
// POST { files: [{ mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf', dataBase64 }, ...] }
// One or more images (treated as sequential pages of one song), OR a single PDF.
// -> { ok: true, meta, source } | { ok: false, error }

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_BYTES = 15 * 1024 * 1024 // 15MB decoded total across all files, room for a multi-page scan

const ALLOWED_MEDIA_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf',
])

const SYSTEM_PROMPT = `You transcribe a photo or PDF of a hand-written or printed chord chart into a specific plain-text chart format. Follow these rules exactly — this is NOT generic ChordMark, it is a custom dialect with its own parsing rules.

DIALECT RULES:
- Section headers are a line starting with "#" followed by a short code: v (verse), c (chorus), b (bridge), pc (pre-chorus), intro, solo, instrumental (or inst), interlude, outro, tag, hook, refrain, vamp, breakdown, coda, ending, chant, drop, turnaround. Add a number directly after the code for repeats you want explicitly numbered, e.g. "#v2". If the chart doesn't label sections, infer reasonable labels from structure (verse/chorus/bridge) rather than leaving sections unlabeled.
- Blank lines are just spacing; they do not end a section.
- A "chord line" is a line where every token is a chord symbol (like Cm, G7, Bb/D, Fmaj7) or "%" (repeat previous bar). Chord tokens may have trailing dots for rhythmic subdivision within a bar (e.g. "C. C. G. G." for four beats).
- If a chord line is immediately followed by a lyric line, they are PAIRED: write the chords on their own line above, and in the lyric line below mark each chord's landing point with an underscore "_" placed right before the syllable where that chord starts. There must be exactly as many underscores in the lyric line as there are chords on the line above (excluding "%").
- If a chord line is NOT followed by a lyric line (e.g. an intro or instrumental section with only chords), leave it standalone — that renders as an instrumental bar line.
- Prefix a lyric line with "*" (and a space) to mark it bold (use sparingly, only for a clearly emphasized hook/title line if the chart marks it that way).
- Write chords exactly as they appear on the source (sharps or flats) — do not transpose or respell.
- If the same section repeats later with identical chords and lyrics, write it out again in full each time; do not use any shorthand for repeated sections.
- You may be given multiple pages, either as several separate photos or as pages within one PDF. Treat every page you're given as ONE continuous song that simply didn't fit on a single page — read them in the order given (the first image or page is page 1, and so on) and produce a single unbroken "source" value spanning every page. Do not restart or repeat title/key/tempo per page, do not treat a later page as a new song, and do not insert any page-break marker into the source text.

OUTPUT FORMAT:
Respond with ONLY a single JSON object, no prose, no markdown code fences, matching this shape:
{
  "title": "string or empty",
  "writer": "string or empty",
  "key": "string or empty, e.g. Cm",
  "meter": "string, e.g. 4/4 (default 4/4 if not visible)",
  "tempo": "string or empty, BPM digits only e.g. 108",
  "capo": "string or empty, e.g. Capo 2",
  "source": "the full transcribed chart body using the dialect rules above, with real newlines"
}
Leave any metadata field as an empty string if it is not visible or not confidently legible on the page — never guess or invent musical facts.

WORKED EXAMPLE (input: a chart with an intro chord line, a verse with chords over lyrics, and a chorus):
{
  "title": "Belly Crawl",
  "writer": "",
  "key": "Cm",
  "meter": "4/4",
  "tempo": "",
  "capo": "",
  "source": "#intro\\nCm Eb G Cm\\n\\n#v\\nCm                Eb\\nI see the writing on the _wall\\nG                  Cm\\nHeard it _echo down the _hall\\n\\n#c\\nEb          Bb\\n*Belly crawl, we're gonna _belly crawl\\nCm             G\\nThrough the _fire till we _stall"
}
Notice: the intro line is a standalone chord line (no lyric follows, so no underscores needed there). In the verse and chorus, each lyric line has one underscore per chord shown above it, placed right before the syllable that chord lands on. The chorus's first lyric line is bolded because it's clearly the hook.`

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
        max_tokens: 8192,
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

  if (typeof parsed.source !== 'string' || !parsed.source.trim()) {
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
    source: parsed.source,
  })
}
