import { useState, useEffect, useCallback } from 'react'
import { parseChordMark, buildRoadmap } from '../lib/parseChordMark'
import { fetchSongs, fetchSong, saveSong, deleteSong, timeAgo } from '../lib/songs'
import ChartPreview from '../components/charts/ChartPreview'

const BLANK_META = {
  title:  '',
  band:   'Brother Jon & The Rainbow Hearts',
  writer: '',
  key:    '',
  meter:  '4/4',
  tempo:  '',
  capo:   '',
}

const PLACEHOLDER = `#intro
Am G F C

#v
Am          G
Singing a song to the world
F              C
Every note a gift for someone

#c
F    G    Am
This is the chorus
F       G      C
Loud and clear and true

#b
Dm             Am
Bridge comes in now
F                 G
Rising to the sky`

export default function ChordCharts() {
  const [meta, setMeta]         = useState(BLANK_META)
  const [songText, setSongText] = useState('')
  const [variant, setVariant]   = useState('full')

  // Persistence state
  const [songs, setSongs]       = useState([])
  const [currentId, setCurrentId] = useState(null)
  const [dirty, setDirty]       = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState(null)
  const [loadingList, setLoadingList] = useState(true)

  const sections = songText.trim() ? parseChordMark(songText) : []
  const roadmap  = sections.length ? buildRoadmap(sections) : ''

  // Load song list on mount
  const refreshList = useCallback(async () => {
    try {
      const data = await fetchSongs()
      setSongs(data)
    } catch (e) {
      console.error('Failed to load songs', e)
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => { refreshList() }, [refreshList])

  // Track unsaved changes
  const setMeta2 = (key) => (e) => {
    setMeta(m => ({ ...m, [key]: e.target.value }))
    setDirty(true)
  }
  const handleSongText = (e) => { setSongText(e.target.value); setDirty(true) }

  // New song
  function handleNew() {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    setMeta(BLANK_META)
    setSongText('')
    setCurrentId(null)
    setDirty(false)
    setSaveMsg(null)
  }

  // Save
  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const saved = await saveSong({
        id:        currentId,
        title:     meta.title || 'Untitled',
        song_text: songText,
        meta:      { band: meta.band, writer: meta.writer, key: meta.key, meter: meta.meter, tempo: meta.tempo, capo: meta.capo },
      })
      setCurrentId(saved.id)
      setDirty(false)
      setSaveMsg('Saved!')
      await refreshList()
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (e) {
      setSaveMsg('Error saving')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // Load a song from the list
  async function handleLoad(id) {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    try {
      const song = await fetchSong(id)
      setMeta({
        title:  song.title,
        band:   song.meta.band   ?? BLANK_META.band,
        writer: song.meta.writer ?? '',
        key:    song.meta.key    ?? '',
        meter:  song.meta.meter  ?? '4/4',
        tempo:  song.meta.tempo  ?? '',
        capo:   song.meta.capo   ?? '',
      })
      setSongText(song.song_text)
      setCurrentId(song.id)
      setDirty(false)
      setSaveMsg(null)
    } catch (e) {
      console.error('Failed to load song', e)
    }
  }

  // Delete a song
  async function handleDelete(id, title, e) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${title}"?`)) return
    try {
      await deleteSong(id)
      if (currentId === id) {
        setMeta(BLANK_META)
        setSongText('')
        setCurrentId(null)
        setDirty(false)
      }
      await refreshList()
    } catch (e) {
      console.error('Failed to delete', e)
    }
  }

  return (
    <div className="cc-page">

      {/* ── Input panel ── */}
      <div className="cc-input">

        {/* Header */}
        <div className="cc-input-header">
          <h2>🎸 Chord Charts</h2>
          <button className="btn btn-primary" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>

        {/* Song list */}
        <div className="cc-songs-panel">
          <div className="cc-songs-header">
            <span className="cc-songs-title">My Songs</span>
            <button className="cc-new-btn" onClick={handleNew}>+ New</button>
          </div>

          {loadingList ? (
            <p className="cc-songs-empty">Loading…</p>
          ) : songs.length === 0 ? (
            <p className="cc-songs-empty">No saved songs yet. Fill in a song and hit Save.</p>
          ) : (
            <ul className="cc-song-list">
              {songs.map(s => (
                <li
                  key={s.id}
                  className={`cc-song-item${currentId === s.id ? ' active' : ''}`}
                  onClick={() => handleLoad(s.id)}
                >
                  <span className="cc-song-name">{s.title || 'Untitled'}</span>
                  <span className="cc-song-time">{timeAgo(s.updated_at)}</span>
                  <button
                    className="cc-song-delete"
                    onClick={(e) => handleDelete(s.id, s.title, e)}
                    title="Delete"
                  >✕</button>
                </li>
              ))}
            </ul>
          )}

          <div className="cc-save-row">
            <button
              className={`btn btn-primary cc-save-btn${dirty ? '' : ' cc-save-btn--clean'}`}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : currentId ? 'Save Changes' : 'Save Song'}
            </button>
            {saveMsg && <span className="cc-save-msg">{saveMsg}</span>}
            {dirty    && <span className="cc-unsaved">● unsaved</span>}
          </div>
        </div>

        {/* Metadata */}
        <div className="cc-meta">
          <label className="cc-field span2">
            Song Title
            <input value={meta.title} onChange={setMeta2('title')} placeholder="Untitled" />
          </label>
          <label className="cc-field span2">
            Writer
            <input value={meta.writer} onChange={setMeta2('writer')} placeholder="Jonathan Owens" />
          </label>
          <label className="cc-field">
            Key
            <input value={meta.key} onChange={setMeta2('key')} placeholder="Am" />
          </label>
          <label className="cc-field">
            Meter
            <input value={meta.meter} onChange={setMeta2('meter')} placeholder="4/4" />
          </label>
          <label className="cc-field">
            Tempo
            <input value={meta.tempo} onChange={setMeta2('tempo')} placeholder="108 BPM" />
          </label>
          <label className="cc-field">
            Capo
            <input value={meta.capo} onChange={setMeta2('capo')} placeholder="Capo 2 · plays Gm" />
          </label>
        </div>

        {/* Variant */}
        <div className="cc-variants">
          {[['full','Full Chart'],['chords','Bass / Chords'],['lyrics','Lyrics']].map(([v, label]) => (
            <button
              key={v}
              className={`cc-variant-btn${variant === v ? ' active' : ''}`}
              onClick={() => setVariant(v)}
            >{label}</button>
          ))}
        </div>

        {/* Song text */}
        <label className="cc-field cc-field-full">
          Song — ChordMark or chords over lyrics
          <textarea
            className="cc-textarea"
            value={songText}
            onChange={handleSongText}
            placeholder={PLACEHOLDER}
            spellCheck={false}
          />
        </label>

        <p className="cc-hint">
          <code>#v</code> verse · <code>#c</code> chorus · <code>#b</code> bridge ·
          <code>#intro</code> · <code>#outro</code> —
          put chord symbols on their own line above lyrics.
        </p>
      </div>

      {/* ── Preview panel ── */}
      <div className="cc-preview">
        <ChartPreview
          meta={meta}
          sections={sections}
          roadmap={roadmap}
          variant={variant}
        />
      </div>

    </div>
  )
}
