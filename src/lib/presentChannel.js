import { supabase } from './supabase'

/** Realtime channel name for a live present session, keyed off the setlist's share token. */
function channelName(token) {
  return `present:${token}`
}

/**
 * Controller side: opens the channel and tracks cue state via Presence, so a display
 * that joins or refreshes mid-set picks up the current position immediately (Presence
 * replays existing state to new subscribers instead of only pushing future changes).
 */
export function openControllerChannel(token) {
  return supabase.channel(channelName(token), {
    config: { presence: { key: 'controller' } },
  })
}

/** Display side: opens the channel and calls onState whenever the controller's cue state changes. */
export function openDisplayChannel(token, onState) {
  const channel = supabase.channel(channelName(token), {
    config: { presence: { key: `display-${Math.random().toString(36).slice(2)}` } },
  })
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    // If more than one controller connection is present (e.g. a phone reconnecting after
    // a dropped signal), the last entry is the most recently joined — prefer that one.
    const entries = state.controller || []
    const controllerState = entries[entries.length - 1]
    if (controllerState) onState(controllerState)
  })
  return channel
}

/**
 * Closes a channel opened above. Uses `supabase.removeChannel` (not just `channel.unsubscribe`)
 * so the client fully forgets it — otherwise a later `supabase.channel(sameTopic)` call (e.g. from
 * React StrictMode's mount/cleanup/remount in dev) reuses the stale, closing channel instead of
 * opening a fresh one, and the new subscription never comes back up.
 */
export function closePresentChannel(channel) {
  try { supabase.removeChannel(channel) } catch { /* already removed */ }
}
