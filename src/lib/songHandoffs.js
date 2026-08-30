import { supabase } from './supabase'

/** Create a 30-day link containing independent snapshots of selected songs. */
export async function createSongHandoff(songIds, senderLabel, recipientLabel) {
  const { data, error } = await supabase.rpc('create_song_handoff', {
    p_song_ids: songIds,
    p_sender_label: senderLabel,
    p_recipient_label: recipientLabel ?? null,
  })
  if (error) throw error
  return data
}

/** Preview a handoff without exposing its song text or metadata. */
export async function previewSongHandoff(token) {
  const { data, error } = await supabase.rpc('preview_song_handoff', {
    p_token: token,
  })
  if (error) throw error
  return data
}

/** Accept a handoff once and add fresh copies to the current user's library. */
export async function acceptSongHandoff(token) {
  const { data, error } = await supabase.rpc('accept_song_handoff', {
    p_token: token,
  })
  if (error) throw error
  return data
}

/** List the current user's still-live outgoing handoff links without song bodies. */
export async function fetchOutgoingSongHandoffs() {
  const { data, error } = await supabase
    .from('song_handoffs')
    .select('id, token, recipient_label, song_titles, attachments_omitted, status, created_at, expires_at')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/** Revoke a live handoff owned by the current user. */
export async function cancelSongHandoff(id) {
  const { data, error } = await supabase.rpc('cancel_song_handoff', {
    p_handoff_id: id,
  })
  if (error) throw error
  return data
}
