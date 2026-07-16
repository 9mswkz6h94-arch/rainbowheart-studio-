import { supabase } from './supabaseClient';
import { SongData } from '../types';
import { stickToABC } from './stickParser';

export interface SongListItem {
  id: string;
  title: string;
  meter: string | null;
  source_book: string | null;
  mc_complete: boolean;
  updated_at: string;
  tone_set: string[] | null;
  rhythmic_elements: string[] | null;
  grade_levels: string[] | null;
}

const DRAFT_KEY = 'kodaly-studio:draft';

// Map the editor document onto kodaly_songs columns. The mc_* checklist
// flags are derived from content so the Study Room catalog stays accurate
// without manual box-ticking.
function toRow(data: SongData, userId: string) {
  const hasStick = data.notation.trim().length > 0;
  const hasLyrics = data.notation.includes('_') || data.additionalVerses.trim().length > 0;
  const toneSet = Object.keys(data.melodicNotes);
  // ABC is derived, never hand-edited — regenerate it on every save so the
  // stored document's staff version can't drift from the sticks
  const doc: SongData = hasStick
    ? { ...data, abcNotation: stickToABC(data.notation, data.timeSignature) }
    : data;

  return {
    user_id: userId,
    title: data.title.trim() || 'Untitled',
    meter: data.timeSignature || null,
    rsp_key: data.rsp || null,
    ssp_key: data.ssp || null,
    tone_set: toneSet,
    citation: data.source || null,
    mc_title_caps: data.title.trim().length > 0, // preview always renders title uppercase
    mc_rsp_ssp: Boolean(data.ssp && data.rsp),
    mc_tone_set: toneSet.length > 0,
    mc_stick_notation: hasStick,
    mc_solfa: hasStick,
    mc_words: hasLyrics,
    mc_game_directions: data.pertinentInfo.trim().length > 0,
    mc_source_citation: data.source.trim().length > 0,
    master_copy_data: doc,
  };
}

function friendlyError(message: string): string {
  if (message.includes('master_copy_data')) {
    return 'The database is missing the master_copy_data column. Run supabase/add_master_copy_data.sql in the Supabase SQL Editor.';
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Offline — your work is kept in this browser and will save when you reconnect.';
  }
  return message;
}

export async function listSongs(): Promise<{ songs: SongListItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from('kodaly_songs')
    .select('id, title, meter, source_book, mc_complete, updated_at, tone_set, rhythmic_elements, grade_levels')
    .order('title_sort', { ascending: true });
  if (error) return { songs: [], error: friendlyError(error.message) };
  return { songs: (data as SongListItem[]) || [], error: null };
}

// Defaults for a fresh editor document (mirrors emptyData in App.tsx).
const SONG_DEFAULTS: SongData = {
  title: '', crossRefTitle: '', ssp: '', rsp: '', timeSignature: '2/4', beatNote: '♩',
  bpm: '', genre: '', subject: '', melodicContent: '', melodicNotes: {}, notationMode: 'stick',
  notation: '', abcNotation: '', additionalVerses: '', pertinentInfo: '', source: '', nameDate: '',
  textSize: 14, titleSize: 36,
};

export async function loadSong(
  id: string
): Promise<{ song: SongData | null; error: string | null }> {
  const { data, error } = await supabase
    .from('kodaly_songs')
    .select('master_copy_data, title, meter, rsp_key, ssp_key, citation, notes')
    .eq('id', id)
    .single();
  if (error) return { song: null, error: friendlyError(error.message) };
  if (data?.master_copy_data) return { song: data.master_copy_data as SongData, error: null };
  // Catalog-only song (imported / no master copy yet): open an editable starter
  // pre-filled from the catalog columns so it can be built up and saved.
  const starter: SongData = {
    ...SONG_DEFAULTS,
    title: data?.title || '',
    timeSignature: data?.meter || SONG_DEFAULTS.timeSignature,
    rsp: data?.rsp_key || '',
    ssp: data?.ssp_key || '',
    source: data?.citation || '',
    pertinentInfo: data?.notes || '',
  };
  return { song: starter, error: null };
}

export async function saveSong(
  userId: string,
  songId: string | null,
  data: SongData
): Promise<{ id: string | null; error: string | null }> {
  const row = toRow(data, userId);

  if (songId) {
    const { error } = await supabase.from('kodaly_songs').update(row).eq('id', songId);
    if (error) return { id: songId, error: friendlyError(error.message) };
    return { id: songId, error: null };
  }

  const { data: inserted, error } = await supabase
    .from('kodaly_songs')
    .insert(row)
    .select('id')
    .single();
  if (error) return { id: null, error: friendlyError(error.message) };
  return { id: inserted.id as string, error: null };
}

export async function deleteSong(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('kodaly_songs').delete().eq('id', id);
  return { error: error ? friendlyError(error.message) : null };
}

// --- Local draft mirror: the current document is always recoverable from
// this browser even if the network or Supabase is down. ---

export interface Draft {
  songId: string | null;
  data: SongData;
  savedAt: string;
  cloudSaved: boolean;
}

export function writeDraft(songId: string | null, data: SongData, cloudSaved: boolean) {
  try {
    const draft: Draft = { songId, data, savedAt: new Date().toISOString(), cloudSaved };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // localStorage full or unavailable — cloud autosave still covers us
  }
}

export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
