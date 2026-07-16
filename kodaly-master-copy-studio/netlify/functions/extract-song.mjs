// Absorb: read a scanned songbook page (image or PDF) with Claude and
// return a SongData document for the Master Copy Studio editor.
// POST body: { media: { kind: "image"|"pdf", mediaType: string, data: base64 } }
//        or: { text: "pasted song text" }
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

const SYSTEM = `You convert pages from old public-domain folk song collections into structured JSON for a Kodály master copy editor. These books are disappearing; your transcription preserves them. Accuracy over completeness — transcribe what is actually on the page, leave fields empty rather than inventing content.

The editor uses STICK NOTATION, written as blocks separated by blank lines. Each block is 2-3 lines:
  line 1: rhythm tokens — 4 (quarter), 8 (eighth), 16 (sixteenth), 2 (half), 1 (whole); add . for dotted (e.g. 4.); z = quarter rest, z8 = eighth rest, z2 = half rest
  line 2: solfa tokens — d r m f s l t (movable do), octave marks: d' = high, d, = low
  line 3: lyrics — an underscore before each syllable aligns it to the note in the same position, e.g. _Ap_ple _tree

Barlines: put | between measures in the rhythm line (also || double, |: and :| repeats, and a short first measure before the first | for a pickup). Bar every measure explicitly according to the printed time signature.

Example (Apple Tree, 2/4):
8 8 | 4 8 8 | ...   <- rhythm with barlines
s s m s s m         <- solfa (no barlines needed here)
_Ap_ple _tree, _Ap_ple _tree,

Use one block per printed line of music. Keep rhythm/solfa/lyric positions aligned within each block.

Solfa: determine do from the key signature and final note. Most folk songs end on do (major/pentatonic) or la (minor). Transcribe the melody as movable-do solfa relative to that do.

Other fields:
- title: song title in the book, as printed
- timeSignature: e.g. "2/4"
- ssp: suggested starting pitch (the printed key's do, e.g. "F"), rsp: recommended singing pitch if the source suggests one, else same as ssp
- toneSet: the distinct solfa tones used, lowest to highest, e.g. ["d","r","m","s","l"]; finalNote: the solfa of the last melody note
- genre: game/song type if evident (e.g. "Circle Game", "Lullaby", "Ballad")
- additionalVerses: verses 2+ as plain text, one verse per paragraph
- pertinentInfo: game or dance directions, historical notes, performance notes printed with the song
- source: full citation of the book if identifiable from the page (author, title, page number if visible)
- bpm and beatNote: only if a tempo marking is printed, else empty strings

If the page has multiple songs, transcribe the FIRST complete song and mention the other titles in pertinentInfo. If the page is not music, return empty strings for everything except pertinentInfo explaining what the page contains.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title', 'crossRefTitle', 'ssp', 'rsp', 'timeSignature', 'beatNote', 'bpm',
    'genre', 'subject', 'toneSet', 'finalNote', 'notation', 'additionalVerses',
    'pertinentInfo', 'source',
  ],
  properties: {
    title: { type: 'string' },
    crossRefTitle: { type: 'string' },
    ssp: { type: 'string' },
    rsp: { type: 'string' },
    timeSignature: { type: 'string' },
    beatNote: { type: 'string' },
    bpm: { type: 'string' },
    genre: { type: 'string' },
    subject: { type: 'string' },
    toneSet: { type: 'array', items: { type: 'string' } },
    finalNote: { type: 'string' },
    notation: { type: 'string', description: 'Stick notation blocks as described in the system prompt' },
    additionalVerses: { type: 'string' },
    pertinentInfo: { type: 'string' },
    source: { type: 'string' },
  },
};

export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY is not configured on this site.' },
      { status: 500 }
    );
  }

  // Absorb is for signed-in users only — verify the Supabase session token
  // so strangers can't spend API credits through this endpoint.
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnon) {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) {
      return Response.json({ error: 'Sign in to use Absorb.' }, { status: 401 });
    }
    const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnon, Authorization: `Bearer ${token}` },
    });
    if (!authRes.ok) {
      return Response.json({ error: 'Your session has expired — sign in again to use Absorb.' }, { status: 401 });
    }
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const content = [];
  if (body.media?.data) {
    if (body.media.kind === 'pdf') {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: body.media.data },
      });
    } else {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: body.media.mediaType || 'image/jpeg', data: body.media.data },
      });
    }
    content.push({ type: 'text', text: 'Transcribe this songbook page into the JSON format.' });
  } else if (body.text) {
    content.push({
      type: 'text',
      text: `Convert this song text into the JSON format:\n\n${body.text}`,
    });
  } else {
    return Response.json({ error: 'Provide media (image/pdf) or text.' }, { status: 400 });
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    });

    if (response.stop_reason === 'refusal') {
      return Response.json({ error: 'The model declined to process this page.' }, { status: 422 });
    }
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) {
      return Response.json({ error: 'No content returned.' }, { status: 502 });
    }
    return Response.json({ song: JSON.parse(textBlock.text) });
  } catch (err) {
    console.error('[extract-song]', err);
    const status = err?.status && err.status >= 400 ? err.status : 502;
    return Response.json(
      { error: err?.message || 'Extraction failed.' },
      { status }
    );
  }
};

export const config = { path: '/api/extract-song' };
