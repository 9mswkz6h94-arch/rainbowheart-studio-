import { supabase } from './supabase'

export async function fetchGrooves() {
  const { data, error } = await supabase
    .from('grooves')
    .select('id, title, updated_at, groove_data')
    .order('title', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchGroove(id) {
  const { data, error } = await supabase
    .from('grooves')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function saveGroove({ id, title, groove_data }) {
  const { data: { user } } = await supabase.auth.getUser()

  if (id) {
    const { data, error } = await supabase
      .from('grooves')
      .update({ title, groove_data })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('grooves')
      .insert({ title, groove_data, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteGroove(id) {
  const { error } = await supabase.from('grooves').delete().eq('id', id)
  if (error) throw error
}

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
