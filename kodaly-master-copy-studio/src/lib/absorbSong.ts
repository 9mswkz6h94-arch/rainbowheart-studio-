// Absorb: send a scanned songbook page (or pasted text) to the extraction
// function and turn the result into an editor document.
import { SongData } from '../types';
import { supabase } from './supabaseClient';

// Keep in sync with MelodicContentSelector's note ordering
const ALL_NOTES = ['d,', 'r,', 'm,', 'f,', 's,', 'l,', 't,', 'd', 'r', 'm', 'f', 's', 'l', 't', "d'", "r'", "m'", "f'", "s'", "l'", "t'"];

interface ExtractedSong {
  title: string;
  crossRefTitle: string;
  ssp: string;
  rsp: string;
  timeSignature: string;
  beatNote: string;
  bpm: string;
  genre: string;
  subject: string;
  toneSet: string[];
  finalNote: string;
  notation: string;
  additionalVerses: string;
  pertinentInfo: string;
  source: string;
}

function buildMelodic(toneSet: string[], finalNote: string) {
  const melodicNotes: Record<string, 'selected' | 'final'> = {};
  toneSet.forEach((n) => {
    if (ALL_NOTES.includes(n)) melodicNotes[n] = 'selected';
  });
  if (finalNote && ALL_NOTES.includes(finalNote)) melodicNotes[finalNote] = 'final';

  // Same spaced-string convention the selector generates
  const indices = Object.keys(melodicNotes)
    .map((n) => ALL_NOTES.indexOf(n))
    .sort((a, b) => a - b);
  let melodicContent = '';
  if (indices.length > 0) {
    const parts: string[] = [];
    for (let i = indices[0]; i <= indices[indices.length - 1]; i++) {
      const n = ALL_NOTES[i];
      const state = melodicNotes[n];
      if (state === 'selected') parts.push(n);
      else if (state === 'final') parts.push(`(${n})`);
      else parts.push(' '.repeat(n.length));
    }
    melodicContent = parts.join(' ');
  }
  return { melodicNotes, melodicContent };
}

export function extractedToSongData(x: ExtractedSong, base: SongData): SongData {
  const { melodicNotes, melodicContent } = buildMelodic(x.toneSet || [], x.finalNote || '');
  return {
    ...base,
    title: x.title || '',
    crossRefTitle: x.crossRefTitle || '',
    ssp: x.ssp || '',
    rsp: x.rsp || '',
    timeSignature: x.timeSignature || '2/4',
    beatNote: x.beatNote || '♩',
    bpm: x.bpm || '',
    genre: x.genre || '',
    subject: x.subject || '',
    melodicNotes,
    melodicContent,
    notationMode: 'stick',
    notation: x.notation || '',
    abcNotation: '',
    additionalVerses: x.additionalVerses || '',
    pertinentInfo: x.pertinentInfo || '',
    source: x.source || '',
  };
}

export async function absorbFile(file: File, base: SongData): Promise<SongData> {
  const data = await fileToBase64(file);
  const kind = file.type === 'application/pdf' ? 'pdf' : 'image';
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetch('/api/extract-song', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ media: { kind, mediaType: file.type, data } }),
  });
  if (!res.ok) {
    let message = `Absorb failed (${res.status}).`;
    try {
      const err = await res.json();
      if (err?.error) message = err.error;
    } catch {
      // non-JSON error (e.g. 404 in local vite dev without netlify)
      if (res.status === 404) {
        message = 'Absorb needs the deployed site (or `netlify dev` locally) — the extraction function is not running here.';
      }
    }
    throw new Error(message);
  }
  const { song } = await res.json();
  return extractedToSongData(song, base);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
