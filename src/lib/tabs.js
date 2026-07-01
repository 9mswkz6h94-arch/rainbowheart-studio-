import { supabase } from './supabase'

export async function fetchTabs() {
  const { data, error } = await supabase
    .from('tabs')
    .select('id, title, updated_at, tab_data')
    .order('title', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchTab(id) {
  const { data, error } = await supabase
    .from('tabs')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function saveTab({ id, title, tab_data }) {
  const { data: { user } } = await supabase.auth.getUser()

  if (id) {
    const { data, error } = await supabase
      .from('tabs')
      .update({ title, tab_data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('tabs')
      .insert({ title, tab_data, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteTab(id) {
  const { error } = await supabase.from('tabs').delete().eq('id', id)
  if (error) throw error
}
