import { supabase } from './supabase'

/** Fetch all setlists for the current user, newest first */
export async function fetchSetLists() {
  const { data, error } = await supabase
    .from('setlists')
    .select('id, name, share_token, updated_at, songs')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

/** Fetch a single setlist by share token — no auth required */
export async function fetchSetListByToken(token) {
  const { data, error } = await supabase
    .from('setlists')
    .select('*')
    .eq('share_token', token)
    .single()
  if (error) throw error
  return data
}

/** Save (insert or update) a setlist. Returns the saved record. */
export async function saveSetList({ id, name, songs }) {
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user

  if (id) {
    const { data, error } = await supabase
      .from('setlists')
      .update({ name, songs, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('setlists')
      .insert({ name, songs, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    return data
  }
}

/** Delete a setlist by id */
export async function deleteSetList(id) {
  const { error } = await supabase.from('setlists').delete().eq('id', id)
  if (error) throw error
}
