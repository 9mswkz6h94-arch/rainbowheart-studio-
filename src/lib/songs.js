import { supabase } from './supabase'

/** Fetch all songs for the current user, newest first */
export async function fetchSongs() {
  const { data, error } = await supabase
    .from('songs')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

/** Fetch a single song by id (full content) */
export async function fetchSong(id) {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/** Save (insert or update) a song. Returns the saved record. */
export async function saveSong({ id, title, song_text, meta }) {
  const { data: { user } } = await supabase.auth.getUser()

  if (id) {
    const { data, error } = await supabase
      .from('songs')
      .update({ title, song_text, meta })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('songs')
      .insert({ title, song_text, meta, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    return data
  }
}

/** Delete a song by id */
export async function deleteSong(id) {
  const { error } = await supabase.from('songs').delete().eq('id', id)
  if (error) throw error
}

/** Format a timestamp as "2 hours ago", "yesterday", etc. */
export function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}
