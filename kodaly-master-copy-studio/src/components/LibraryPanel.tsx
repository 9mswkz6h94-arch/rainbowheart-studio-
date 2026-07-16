import React, { useEffect, useState } from 'react';
import { X, Search, Plus, Trash2, CheckCircle2, Circle, Music } from 'lucide-react';
import { SongListItem, listSongs, deleteSong } from '../lib/songLibrary';

interface Props {
  open: boolean;
  currentSongId: string | null;
  onClose: () => void;
  onOpenSong: (id: string) => void;
  onNewSong: () => void;
}

export const LibraryPanel: React.FC<Props> = ({
  open,
  currentSongId,
  onClose,
  onOpenSong,
  onNewSong,
}) => {
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const { songs, error } = await listSongs();
    setSongs(songs);
    setError(error);
    setLoading(false);
  }

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  async function handleDelete(e: React.MouseEvent, song: SongListItem) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${song.title}" from your library? This cannot be undone.`)) return;
    const { error } = await deleteSong(song.id);
    if (error) {
      setError(error);
      return;
    }
    setSongs((prev) => prev.filter((s) => s.id !== song.id));
  }

  const filtered = query.trim()
    ? songs.filter((s) => s.title.toLowerCase().includes(query.trim().toLowerCase()))
    : songs;

  // Songs live in Drafts until all 8 master-copy elements are present
  // (mc_complete), then graduate to Complete.
  const drafts = filtered.filter((s) => !s.mc_complete);
  const complete = filtered.filter((s) => s.mc_complete);

  const renderSong = (song: SongListItem) => (
    <button
      key={song.id}
      onClick={() => onOpenSong(song.id)}
      className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-blue-50 transition-colors group flex items-center justify-between ${
        song.id === currentSongId ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="font-medium text-slate-800 truncate">{song.title}</div>
        {song.tone_set && song.tone_set.length > 0 && (
          <div className="text-xs font-semibold text-blue-600 mt-0.5 truncate">
            {song.tone_set.join(' ')}
            {song.grade_levels && song.grade_levels.length > 0 && (
              <span className="text-slate-400 font-normal">
                {' · '}
                {song.grade_levels.length > 1
                  ? `${song.grade_levels[0]}–${song.grade_levels[song.grade_levels.length - 1]}`
                  : song.grade_levels[0]}
              </span>
            )}
          </div>
        )}
        <div className="text-xs text-slate-400 mt-0.5">
          {song.meter || '—'}
          {song.source_book ? ` · ${song.source_book}` : ''}
        </div>
      </div>
      <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
        {song.mc_complete ? (
          <CheckCircle2 size={16} className="text-green-500" aria-label="Master copy complete" />
        ) : (
          <Circle size={16} className="text-slate-300" aria-label="Master copy incomplete" />
        )}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => handleDelete(e, song)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleDelete(e as unknown as React.MouseEvent, song);
          }}
          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
          aria-label={`Delete ${song.title}`}
        >
          <Trash2 size={14} />
        </span>
      </div>
    </button>
  );

  const sectionHeader = (label: string, count: number) => (
    <div className="px-4 py-1.5 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
      {label} · {count}
    </div>
  );

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex no-print">
      {/* Panel */}
      <div className="w-[380px] max-w-full h-full bg-white border-r border-slate-200 shadow-2xl flex flex-col">
        <header className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 flex items-center">
            <Music size={18} className="mr-2 text-blue-600" /> Song Library
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Close library"
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-4 border-b border-slate-200 space-y-3">
          <button
            onClick={onNewSong}
            className="w-full flex items-center justify-center bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors px-4 py-2 font-medium text-sm shadow-sm"
          >
            <Plus size={16} className="mr-2" /> New Song
          </button>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search songs…"
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <p className="m-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          {loading && <p className="m-4 text-slate-400 text-sm">Loading…</p>}
          {!loading && !error && filtered.length === 0 && (
            <p className="m-4 text-slate-400 text-sm">
              {query ? 'No songs match your search.' : 'No songs yet — your library starts here.'}
            </p>
          )}
          {drafts.length > 0 && (
            <>
              {sectionHeader('Drafts', drafts.length)}
              {drafts.map(renderSong)}
            </>
          )}
          {complete.length > 0 && (
            <>
              {sectionHeader('Complete', complete.length)}
              {complete.map(renderSong)}
            </>
          )}
        </div>

        <footer className="p-3 border-t border-slate-200 text-xs text-slate-400 text-center">
          {songs.length} song{songs.length === 1 ? '' : 's'} · checkmark = all 8 master copy elements
        </footer>
      </div>

      {/* Backdrop */}
      <div className="flex-1 bg-slate-900/20" onClick={onClose} />
    </div>
  );
};
