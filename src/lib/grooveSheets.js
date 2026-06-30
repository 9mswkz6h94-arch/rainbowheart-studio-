import { supabase } from './supabase'

export async function fetchGrooveSheets() {
  const { data, error } = await supabase
    .from('groove_sheets')
    .select('id, title, groove_ids, updated_at')
    .order('title', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchGrooveSheet(id) {
  const { data, error } = await supabase
    .from('groove_sheets')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function saveGrooveSheet({ id, title, groove_ids }) {
  const { data: { user } } = await supabase.auth.getUser()

  if (id) {
    const { data, error } = await supabase
      .from('groove_sheets')
      .update({ title, groove_ids })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('groove_sheets')
      .insert({ title, groove_ids, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteGrooveSheet(id) {
  const { error } = await supabase.from('groove_sheets').delete().eq('id', id)
  if (error) throw error
}
