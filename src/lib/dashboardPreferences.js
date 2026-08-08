import { supabase } from './supabase'

export async function fetchDashboardPreferences() {
  const { data, error } = await supabase.from('dashboard_preferences').select('tool_order, hidden_tools').maybeSingle()
  if (error) throw error
  return data
}

export async function saveDashboardPreferences(userId, toolOrder, hiddenTools) {
  const { data, error } = await supabase.from('dashboard_preferences').upsert({ user_id: userId, tool_order: toolOrder, hidden_tools: hiddenTools, updated_at: new Date().toISOString() }).select('tool_order, hidden_tools').single()
  if (error) throw error
  return data
}
