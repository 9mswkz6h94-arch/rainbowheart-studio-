import { supabase } from './supabase'

export async function fetchTabSheets() {
  const { data, error } = await supabase
    .from('tab_sheets')
    .select('id, title, tab_ids, updated_at')
    .order('title', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchTabSheet(id) {
  const { data, error } = await supabase
    .from('tab_sheets')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function saveTabSheet({ id, title, tab_ids }) {
  const { data: { user } } = await supabase.auth.getUser()

  if (id) {
    const { data, error } = await supabase
      .from('tab_sheets')
      .update({ title, tab_ids, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('tab_sheets')
      .insert({ title, tab_ids, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteTabSheet(id) {
  const { error } = await supabase.from('tab_sheets').delete().eq('id', id)
  if (error) throw error
}
