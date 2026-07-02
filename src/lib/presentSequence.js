import { parseSong } from './chartEngine'

/**
 * Flattens a setlist into one ordered sequence of cue items for the Live Stage Cue
 * display: a transition card before each song (title/key/tempo), then that song's
 * sections in order. Break and set dividers pass through unchanged.
 */
export function buildPresentSequence(setlist) {
  const items = []
  const songs = setlist?.songs || []

  songs.forEach((entry, songIndex) => {
    if (entry._type === 'break' || entry._type === 'set') {
      items.push({
        type: entry._type,
        label: entry.label || (entry._type === 'break' ? 'Break' : 'Set'),
        songIndex,
      })
      return
    }

    if (entry._type === 'note') {
      items.push({
        type: 'note',
        label: entry.label || 'Note',
        text: entry.text || '',
        songIndex,
      })
      return
    }

    const meta = entry.meta || {}
    const parsed = parseSong(entry.song_text || '', meta)
    const title = entry.title || meta.title || 'Untitled'

    items.push({
      type: 'transition',
      songIndex,
      title,
      key: meta.key || '',
      tempo: meta.tempo || '',
      meter: meta.meter || '',
      // 'half' means the tempo number is a half-note beat (chartEngine's own tempoHTML
      // convention) — the display's metronome needs this to convert to quarter-note BPM.
      tempoNote: meta.note || 'quarter',
      // Full section order for this song — lets the display show a chart-style
      // "STRUCTURE" progress header (same labels as the printed chart's structure line).
      structure: parsed.structure,
    })

    parsed.structure.forEach((label, sectionIndex) => {
      items.push({
        type: 'section',
        songIndex,
        sectionIndex,
        songTitle: title,
        songCount: songs.filter(s => !s._type).length,
        label,
        lyricLines: parsed.lyrics[sectionIndex]?.lines || [],
        chordLines: parsed.full[sectionIndex]?.lines || [],
      })
    })
  })

  return items
}
