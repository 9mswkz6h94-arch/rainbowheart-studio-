
import React, { useState, useRef, useEffect } from 'react';
import { Printer, FileDown, FileUp, RefreshCw, ZoomIn, ZoomOut, Maximize, Eye, Type, Music, AlignLeft, BookOpen, LogOut, Cloud, CloudOff, Loader2, ScanLine, Mic } from 'lucide-react';
import { SongData } from './types';
import { FormInput } from './components/FormInput';
import { FormSelect } from './components/FormSelect';
import { DocumentPreview } from './components/DocumentPreview';
import { MelodicContentSelector } from './components/MelodicContentSelector';
import { LibraryPanel } from './components/LibraryPanel';
import Login from './components/Login';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabaseClient';
import { saveSong, loadSong, writeDraft, readDraft } from './lib/songLibrary';
import { absorbFile } from './lib/absorbSong';
import PitchHelper from './components/PitchHelper';

const initialData: SongData = {
  title: 'Apple Tree',
  crossRefTitle: '',
  ssp: 'G',
  rsp: 'B',
  timeSignature: '2/4',
  beatNote: '♩',
  bpm: '60',
  genre: 'Circle Game',
  subject: '',
  melodicContent: '(d)   m   s l',
  melodicNotes: { 'd': 'final', 'm': 'selected', 's': 'selected', 'l': 'selected' },
  notationMode: 'stick',
  notation: `8 8 4
s s m
_Ap_ple _tree,

8 8 4
s s m
_Ap_ple _tree,

8 8 8 8
s s l l
_will _the _ap_ple

8 8 4
s s m
_fall _on _me?

8 8 4
s s m
_I _won't _cry,

8 8 4
s s m
_I _won't _pout,

4 4
s s
_if _your

8 8 4
s s d
_ap_ples _knock _me _out.`,
  abcNotation: `X:1
M:2/4
L:1/8
K:C
GG E2 | GG E2 | GG AA | GG E2 |
w: Ap-ple tree, Ap-ple tree, will the ap-ple fall on me?
GG E2 | GG E2 | G2 G2 | GG C2 |]
w: I won't cry, I won't pout, if your ap-ples knock me out.`,
  additionalVerses: '',
  pertinentInfo: `GAME:
Like "London Bridge" -- Follow the leader beneath the "apple tree" (two children making an arch);
the "tree" comes down, catching one child, on the word "out."

Like "Hot Potato" -- Children sit in a circle and pass the "apple" (ball or bean bag) around on the
beat. Child that ha "apple" on the word out is out.`,
  source: 'Forrai, Katalin. Music In Preschool. James Ferguson Pty Ltd. 1998, p. 144.',
  nameDate: 'Julie Boettiger Collection 2018',
  textSize: 14,
  titleSize: 36
};

const emptyData: SongData = {
  title: '',
  crossRefTitle: '',
  ssp: '',
  rsp: '',
  timeSignature: '2/4',
  beatNote: '♩',
  bpm: '',
  genre: '',
  subject: '',
  melodicContent: '',
  melodicNotes: {},
  notationMode: 'stick',
  notation: '',
  abcNotation: '',
  additionalVerses: '',
  pertinentInfo: '',
  source: '',
  nameDate: '',
  textSize: 14,
  titleSize: 36
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function Editor({ userId }: { userId: string }) {
  const [data, setData] = useState<SongData>(initialData);

  // Song Library State
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  // Autosave only fires when the document differs from the last loaded/saved
  // snapshot, so opening a song or sitting on the demo doc never writes rows.
  const lastPersistedJson = useRef<string>(JSON.stringify(initialData));
  const songIdRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const restoreChecked = useRef(false);

  // Offer to restore work that never reached the cloud (crash/offline)
  useEffect(() => {
    if (restoreChecked.current) return;
    restoreChecked.current = true;
    const draft = readDraft();
    if (draft && !draft.cloudSaved) {
      const when = new Date(draft.savedAt).toLocaleString();
      if (window.confirm(`You have unsaved work from ${when} ("${draft.data.title || 'Untitled'}"). Restore it?`)) {
        setData(draft.data);
        setCurrentSongId(draft.songId);
        songIdRef.current = draft.songId;
        // leave lastPersistedJson stale so autosave pushes it to the cloud
      }
    }
  }, []);

  const runSave = async (doc: SongData) => {
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    savingRef.current = true;
    setSaveStatus('saving');
    const { id, error } = await saveSong(userId, songIdRef.current, doc);
    savingRef.current = false;
    if (error) {
      setSaveStatus('error');
      setSaveError(error);
      writeDraft(songIdRef.current, doc, false);
    } else {
      if (id && !songIdRef.current) {
        songIdRef.current = id;
        setCurrentSongId(id);
      }
      lastPersistedJson.current = JSON.stringify(doc);
      setSaveStatus('saved');
      setSaveError(null);
      writeDraft(songIdRef.current, doc, true);
    }
    if (pendingRef.current) {
      pendingRef.current = false;
      runSave(doc);
    }
  };

  // Debounced autosave
  useEffect(() => {
    const json = JSON.stringify(data);
    if (json === lastPersistedJson.current) return;
    writeDraft(songIdRef.current, data, false);
    const timer = setTimeout(() => runSave(data), 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const handleOpenSong = async (id: string) => {
    const { song, error } = await loadSong(id);
    if (error || !song) {
      setSaveStatus('error');
      setSaveError(error || 'Could not load song.');
      return;
    }
    setData(song);
    setCurrentSongId(id);
    songIdRef.current = id;
    lastPersistedJson.current = JSON.stringify(song);
    setSaveStatus('saved');
    setSaveError(null);
    setLibraryOpen(false);
  };

  // Deep-link: open a song passed as ?song=<id> (e.g. from the Kodály Song Binder).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('song');
    if (id) {
      handleOpenSong(id);
      // clean the URL so a refresh doesn't reopen it or fight autosave
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewSong = () => {
    setData(emptyData);
    setCurrentSongId(null);
    songIdRef.current = null;
    lastPersistedJson.current = JSON.stringify(emptyData);
    setSaveStatus('idle');
    setSaveError(null);
    setLibraryOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Absorb: scanned songbook page -> new editable master copy
  const [absorbing, setAbsorbing] = useState(false);
  const [absorbError, setAbsorbError] = useState<string | null>(null);
  const handleAbsorb = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setAbsorbing(true);
    setAbsorbError(null);
    try {
      const song = await absorbFile(file, emptyData);
      // New library entry — autosave picks it up once the user confirms/edits
      setCurrentSongId(null);
      songIdRef.current = null;
      lastPersistedJson.current = '';
      setData(song);
      setSaveStatus('saving');
    } catch (err) {
      setAbsorbError(err instanceof Error ? err.message : 'Absorb failed.');
    } finally {
      setAbsorbing(false);
    }
  };

  // Sing-to-solfa pitch helper
  const [showPitch, setShowPitch] = useState(false);
  const appendNotationBlock = (block: string) => {
    setData(prev => {
      const cur = prev.notation.trimEnd();
      return { ...prev, notation: cur ? `${cur}\n\n${block}` : block };
    });
  };

  // Resizable Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const [isDragging, setIsDragging] = useState(false);

  // Zoom & Auto-Scale State
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [fitZoom, setFitZoom] = useState<number>(1);
  const [manualZoom, setManualZoom] = useState<number | null>(null);

  // Panning State
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const effectiveZoom = manualZoom !== null ? manualZoom : fitZoom;

  const updateField = (field: keyof SongData, value: any) => {
    if (absorbError) setAbsorbError(null);
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleMelodicChange = (newNotes: Record<string, 'selected' | 'final'>, newString: string) => {
    setData(prev => ({
      ...prev,
      melodicNotes: newNotes,
      melodicContent: newString
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClear = () => {
    if (window.confirm('Clear all fields and start a fresh document? The current song stays saved in your library.')) {
      handleNewSong();
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", (data.title || "song_data") + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string);
          
          // Migrations
          if (importedData.tempo && !importedData.beatNote && !importedData.bpm) {
            const parts = importedData.tempo.split('=');
            if (parts.length === 2) {
              importedData.beatNote = parts[0].trim();
              importedData.bpm = parts[1].trim();
            } else {
              importedData.bpm = importedData.tempo;
              importedData.beatNote = '♩';
            }
            delete importedData.tempo;
          }

          if (importedData.melodicContent && !importedData.melodicNotes) {
            const notesMap: Record<string, 'selected' | 'final'> = {};
            const regex = /\(?(d,|r,|m,|f,|s,|l,|t,|d'|r'|m'|f'|s'|l'|t'|d|r|m|f|s|l|t)\)?/g;
            let match;
            while ((match = regex.exec(importedData.melodicContent)) !== null) {
              const fullMatch = match[0];
              const note = match[1];
              if (fullMatch.startsWith('(') && fullMatch.endsWith(')')) {
                notesMap[note] = 'final';
              } else {
                notesMap[note] = 'selected';
              }
            }
            importedData.melodicNotes = notesMap;
          }

          if (!importedData.textSize) importedData.textSize = 14;
          if (!importedData.titleSize) importedData.titleSize = 36;
          if (!importedData.notationMode) importedData.notationMode = 'stick';
          if (!importedData.abcNotation) importedData.abcNotation = '';
          if (!importedData.timeSignature) importedData.timeSignature = '2/4';

          // Imported songs become a new library entry (autosave picks it up)
          setCurrentSongId(null);
          songIdRef.current = null;
          setData({ ...emptyData, ...importedData });
        } catch (error) {
          alert("Error parsing JSON file.");
        }
      };
      reader.readAsText(file);
    }
  };

  // Handle Sidebar Resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      let newWidth = e.clientX;
      if (newWidth < 350) newWidth = 350; // Minimum width
      if (newWidth > window.innerWidth - 400) newWidth = window.innerWidth - 400; // Maximum width
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Handle Auto-Scaling Preview
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        // Document is 816x1056. Add 64px padding to ensure it fits nicely
        const scaleX = (width - 64) / 816;
        const scaleY = (height - 64) / 1056;
        // Use the smaller scale to fit entirely, cap at 1.5x zoom
        setFitZoom(Math.min(scaleX, scaleY, 1.5));
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleZoomIn = () => setManualZoom(Math.min(2, effectiveZoom + 0.1));
  const handleZoomOut = () => setManualZoom(Math.max(0.25, effectiveZoom - 0.1));
  const handleFitZoom = () => setManualZoom(null);

  // Panning Handlers
  const handlePanStart = (e: React.MouseEvent) => {
    if (!previewContainerRef.current) return;
    setIsPanning(true);
    setPanStart({
      x: e.clientX,
      y: e.clientY,
      scrollLeft: previewContainerRef.current.scrollLeft,
      scrollTop: previewContainerRef.current.scrollTop
    });
  };

  const handlePanMove = (e: React.MouseEvent) => {
    if (!isPanning || !previewContainerRef.current) return;
    e.preventDefault();
    const walkX = e.clientX - panStart.x;
    const walkY = e.clientY - panStart.y;
    previewContainerRef.current.scrollLeft = panStart.scrollLeft - walkX;
    previewContainerRef.current.scrollTop = panStart.scrollTop - walkY;
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [showPreview, setShowPreview] = useState(!isMobile);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-50 overflow-hidden font-sans print-flatten relative">

      {/* Song Library Drawer */}
      <LibraryPanel
        open={libraryOpen}
        currentSongId={currentSongId}
        onClose={() => setLibraryOpen(false)}
        onOpenSong={handleOpenSong}
        onNewSong={handleNewSong}
      />

      {/* Sing-to-solfa pitch helper */}
      {showPitch && (
        <PitchHelper
          timeSignature={data.timeSignature}
          defaultBpm={parseInt(data.bpm) || 90}
          onInsert={appendNotationBlock}
          onClose={() => setShowPitch(false)}
        />
      )}

      {/* Sidebar Form (Left Pane) */}
      <div
        className="bg-white border-r border-slate-200 flex flex-col md:h-full no-print shadow-lg z-20 relative flex-shrink-0 w-full md:border-b-0 border-b md:border-r"
        style={{ width: isMobile ? '100%' : sidebarWidth }}
      >
        <div className="rainbow-stripe flex-shrink-0" />
        {/* Sidebar Header */}
        <header className="p-4 border-b border-slate-200 bg-white flex justify-between items-center sticky top-0 z-20">
          <div className="min-w-0 pr-2">
            <h1 className="text-lg font-bold text-slate-800 tracking-tight truncate">Master Copy Studio</h1>
            <div className="flex items-center text-xs mt-0.5" aria-live="polite">
              {absorbing && (
                <span className="flex items-center text-blue-600"><Loader2 size={12} className="mr-1 animate-spin" /> Reading the page… this can take a minute</span>
              )}
              {!absorbing && absorbError && (
                <span className="flex items-center text-red-600" title={absorbError}><CloudOff size={12} className="mr-1" /> {absorbError}</span>
              )}
              {!absorbing && !absorbError && saveStatus === 'saving' && (
                <span className="flex items-center text-slate-500"><Loader2 size={12} className="mr-1 animate-spin" /> Saving…</span>
              )}
              {!absorbing && !absorbError && saveStatus === 'saved' && (
                <span className="flex items-center text-green-600"><Cloud size={12} className="mr-1" /> Saved to library</span>
              )}
              {!absorbing && !absorbError && saveStatus === 'error' && (
                <span className="flex items-center text-red-600" title={saveError || undefined}><CloudOff size={12} className="mr-1" /> {saveError || 'Save failed'}</span>
              )}
              {!absorbing && !absorbError && saveStatus === 'idle' && (
                <span className="text-slate-400">Autosaves as you type</span>
              )}
            </div>
          </div>
          <div className="flex space-x-1 flex-shrink-0">
            <label
              className={`p-2 rounded-md transition-colors focus-within:ring-2 focus-within:ring-blue-500 ${absorbing ? 'text-blue-600 bg-blue-50 cursor-wait' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer'}`}
              title="Absorb — photograph or upload a songbook page and it becomes a master copy draft"
            >
              <span className="sr-only">Absorb a songbook page</span>
              {absorbing ? <Loader2 size={18} className="animate-spin" /> : <ScanLine size={18} />}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={absorbing}
                onChange={handleAbsorb}
              />
            </label>
            <button onClick={() => setShowPitch(true)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Sing to add solfa" title="Sing to add solfa — hum notes and they become solfa">
              <Mic size={18} />
            </button>
            <button onClick={() => setLibraryOpen(true)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Open Song Library" title="Song Library">
              <BookOpen size={18} />
            </button>
            <button onClick={handleClear} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500" aria-label="Clear All Fields" title="New blank document">
              <RefreshCw size={18} />
            </button>
            <label className="hidden md:block p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-blue-500" title="Import JSON">
              <span className="sr-only">Import JSON</span>
              <FileUp size={18} />
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
            <button onClick={handleExport} className="hidden md:block p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Export to JSON" title="Export JSON">
              <FileDown size={18} />
            </button>
            {!isMobile && (
              <button onClick={() => setShowPreview(!showPreview)} className="hidden md:block p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Toggle preview" title="Toggle preview pane">
                <Eye size={18} />
              </button>
            )}
            <button onClick={handleSignOut} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400" aria-label="Sign Out" title="Sign Out">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Form Fields — editing happens on desktop; mobile is capture + preview only */}
        <main className="hidden md:block flex-1 overflow-y-auto p-6 space-y-8">
          
          <section aria-labelledby="header-info-heading">
            <div className="flex justify-between items-center mb-4">
              <h2 id="header-info-heading" className="text-xs font-bold text-slate-400 uppercase tracking-wider">Header Information</h2>

              {/* Title Size Control — hidden on mobile */}
              <div className="hidden md:flex items-center space-x-2 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                <Type size={14} className="text-slate-500" />
                <input
                  type="range"
                  min="24"
                  max="72"
                  value={data.titleSize}
                  onChange={(e) => updateField('titleSize', parseInt(e.target.value))}
                  className="w-20 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer"
                  title={`Title Size: ${data.titleSize}px`}
                />
                <span className="text-xs font-medium text-slate-600 w-6 text-right">{data.titleSize}</span>
              </div>
            </div>

            <FormInput label="Title" value={data.title} onChange={(v) => updateField('title', v)} placeholder="e.g., APPLE TREE" />
            <FormInput label="Cross-Reference Title" value={data.crossRefTitle} onChange={(v) => updateField('crossRefTitle', v)} placeholder="e.g., Parenthesis, Lower Case" />
          </section>

          {/* Musical Metadata — hidden on mobile */}
          <section aria-labelledby="metadata-heading" className="hidden md:block">
            <h2 id="metadata-heading" className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Musical Metadata</h2>
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="SSP" value={data.ssp} onChange={(v) => updateField('ssp', v)} placeholder="e.g., G" />
              <FormInput label="RSP" value={data.rsp} onChange={(v) => updateField('rsp', v)} placeholder="e.g., B" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormSelect 
                label="Beat Note" 
                value={data.beatNote} 
                onChange={(v) => updateField('beatNote', v)} 
                options={[
                  { label: 'Quarter (♩)', value: '♩' },
                  { label: 'Eighth (♪)', value: '♪' },
                  { label: 'Dotted Q (♩.)', value: '♩.' },
                  { label: 'Half (𝅗𝅥)', value: '𝅗𝅥' },
                  { label: 'Stick Q (|)', value: '|' },
                  { label: 'Stick E ([)', value: '[' },
                  { label: 'Stick Dotted Q (|.)', value: '|.' },
                ]}
              />
              <FormInput label="BPM" value={data.bpm} onChange={(v) => updateField('bpm', v)} placeholder="e.g., 60" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Genre" value={data.genre} onChange={(v) => updateField('genre', v)} placeholder="e.g., Circle Game" />
              <FormInput label="Subject" value={data.subject} onChange={(v) => updateField('subject', v)} placeholder="e.g., Cumulative Animal Song" />
            </div>
            
            <MelodicContentSelector 
              value={data.melodicNotes} 
              onChange={handleMelodicChange} 
            />
          </section>

          <section aria-labelledby="notation-heading">
            <div className="flex justify-between items-center mb-4">
              <h2 id="notation-heading" className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notation & Content</h2>
              
              {/* Text Size Control — hidden on mobile */}
              <div className="hidden md:flex items-center space-x-2 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                <Type size={14} className="text-slate-500" />
                <input 
                  type="range" 
                  min="10" 
                  max="32" 
                  value={data.textSize} 
                  onChange={(e) => updateField('textSize', parseInt(e.target.value))}
                  className="w-20 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer"
                  title={`Text Size: ${data.textSize}px`}
                />
                <span className="text-xs font-medium text-slate-600 w-6 text-right">{data.textSize}</span>
              </div>
            </div>

            {/* Page Display Toggle — you always build with sticks; the staff
                renders itself automatically from the same notation */}
            <div className="hidden md:flex bg-slate-100 p-1 rounded-lg mb-2 border border-slate-200">
              <button
                onClick={() => updateField('notationMode', 'stick')}
                className={`flex-1 flex items-center justify-center py-1.5 text-sm font-medium rounded-md transition-all ${data.notationMode === 'stick' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <AlignLeft size={16} className="mr-2" /> Sticks on Page
              </button>
              <button
                onClick={() => updateField('notationMode', 'standard')}
                className={`flex-1 flex items-center justify-center py-1.5 text-sm font-medium rounded-md transition-all ${data.notationMode === 'standard' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Music size={16} className="mr-2" /> Staff on Page
              </button>
            </div>
            <p className="hidden md:block text-xs text-slate-400 mb-4 text-center">
              Both views come from the same stick notation — the staff draws itself.
            </p>

            <div className="hidden md:block text-xs text-slate-600 mb-3 bg-blue-50/50 p-3 rounded-md border border-blue-100 leading-relaxed">
              <strong>Stick Notation Guide:</strong><br/>
              • <strong>Time Signature:</strong> Set below to auto-calculate measures.<br/>
              • <strong>Rhythms:</strong> Use numbers: <code>4</code> (Quarter), <code>8</code> (Eighth), <code>16</code> (Sixteenth), <code>2</code> (Half), <code>1</code> (Whole). Add <code>.</code> for dotted.<br/>
              • <strong>Rests:</strong> <code>z</code> (quarter rest), <code>z8</code> (eighth), <code>z2</code> (half).<br/>
              • <strong>Barlines:</strong> Type <code>|</code> in the rhythm line to bar measures yourself, plus <code>||</code> (double), <code>|:</code> and <code>:|</code> (repeats). Once you type any barline, auto-barring turns off — start with a short measure for a pickup.<br/>
              • <strong>Line breaks:</strong> Type <code>//</code> in the rhythm line to force the notation onto a new line at that point.<br/>
              • <strong>Lyrics:</strong> Type <code>_</code> before a word/syllable to align it with a note. Syllables of one word (no space, like <code>_Ap_ple</code>) join with a hyphen.<br/>
              • <strong>Held notes (melisma):</strong> Leave a note's syllable blank to hold the previous one across it — e.g. <code>_Glo_ _ _ri_a</code> draws an extension line under the held notes.
            </div>

            {/* Simplified guide on mobile */}
            <div className="md:hidden text-xs text-slate-600 mb-3 bg-blue-50/50 p-3 rounded-md border border-blue-100 leading-relaxed">
              <strong>Format:</strong> Line 1: rhythms (4/8/16/2/1 + . for dotted, z for rests)
              <br />Line 2: solfa (d r m f s l t)
              <br />Line 3: lyrics with _ prefix
            </div>

            <FormInput
              label="Time Signature"
              value={data.timeSignature}
              onChange={(v) => updateField('timeSignature', v)}
              placeholder="e.g., 2/4"
              className="w-1/3"
            />
            <FormInput
              label=""
              type="textarea"
              rows={10}
              value={data.notation}
              onChange={(v) => updateField('notation', v)}
              placeholder={`8 8 4\ns s m\n_Ap_ple _tree,`}
            />
          </section>

          {/* Additional Details — hidden on mobile for simplicity */}
          <section aria-labelledby="details-heading" className="hidden md:block">
            <h2 id="details-heading" className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Additional Details</h2>
            <FormInput label="Additional Verses" type="textarea" rows={4} value={data.additionalVerses} onChange={(v) => updateField('additionalVerses', v)} helpText="Put a part label on its own line in brackets — e.g. [Verse 2] or [Chorus] — to delineate parts." />
            <FormInput label="Pertinent Information" type="textarea" rows={4} value={data.pertinentInfo} onChange={(v) => updateField('pertinentInfo', v)} helpText="Game/dance instructions, historical notes, etc." />
            <FormInput label="Source" type="textarea" rows={3} value={data.source} onChange={(v) => updateField('source', v)} helpText="Author, Title, Publisher, Year, Page" />
            <FormInput label="Collection / Name & Date" value={data.nameDate} onChange={(v) => updateField('nameDate', v)} placeholder="e.g., Jane Doe Collection 2023" />
          </section>

          <footer className="pt-2 pb-4 text-center text-xs text-slate-400 border-t border-slate-100">
            A{' '}
            <a href="https://rainbowheart.studio" target="_blank" rel="noreferrer" className="rh-link">
              Rainbow Heart Studio
            </a>{' '}
            app · made with ♥ by Brother Jon
          </footer>

        </main>
      </div>

      {/* Resizer Handle */}
      <div
        className="hidden md:flex w-3 cursor-col-resize bg-slate-200 hover:bg-blue-400 active:bg-blue-500 transition-colors z-30 flex-col justify-center items-center group no-print flex-shrink-0"
        onMouseDown={() => setIsDragging(true)}
        title="Drag to resize"
        role="separator"
        aria-orientation="vertical"
      >
        <div className="h-12 w-1 bg-slate-400 group-hover:bg-white rounded-full transition-colors"></div>
      </div>

      {/* Preview Pane (Right Pane) — always shown on mobile (capture + render);
          toggleable on desktop */}
      {(isMobile || showPreview) && (
      <div className="flex flex-1 flex-col relative z-10 bg-slate-50 min-w-0 print-flatten">
        
        {/* Preview Toolbar — desktop only (zoom/pan/print) */}
        <div className="h-16 border-b border-slate-200 bg-white hidden md:flex items-center justify-between px-6 shadow-sm no-print z-20 flex-shrink-0">
          <div className="flex items-center text-slate-600 font-medium text-sm">
            <Eye size={18} className="mr-2 text-slate-400" />
            Print Preview
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-100 rounded-md p-1 border border-slate-200">
              <button 
                onClick={handleZoomOut} 
                className="p-1.5 text-slate-600 hover:bg-white hover:shadow-sm rounded transition-all focus:outline-none focus:ring-2 focus:ring-blue-500" 
                aria-label="Zoom Out"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs font-semibold w-12 text-center text-slate-700" aria-live="polite">
                {Math.round(effectiveZoom * 100)}%
              </span>
              <button 
                onClick={handleZoomIn} 
                className="p-1.5 text-slate-600 hover:bg-white hover:shadow-sm rounded transition-all focus:outline-none focus:ring-2 focus:ring-blue-500" 
                aria-label="Zoom In"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <div className="w-px h-4 bg-slate-300 mx-1"></div>
              <button 
                onClick={handleFitZoom} 
                className={`p-1.5 rounded transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${manualZoom === null ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}
                aria-label="Fit to Screen"
                title="Fit to Screen"
              >
                <Maximize size={16} />
              </button>
            </div>

            <button 
              onClick={handlePrint} 
              className="bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center px-4 py-2 font-medium text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" 
              aria-label="Print Document"
            >
              <Printer size={16} className="mr-2" /> Print
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div 
          className={`flex-1 overflow-auto relative canvas-bg print-flatten ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`} 
          ref={previewContainerRef}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
        >
          <div className="min-w-max min-h-max p-8 flex justify-center items-start print-flatten">
            <div 
              className="print-reset-transform"
              style={{ 
                transform: `scale(${effectiveZoom})`, 
                transformOrigin: 'top center',
                transition: isDragging || isPanning ? 'none' : 'transform 0.15s ease-out'
              }}
            >
              <DocumentPreview data={data} />
            </div>
          </div>
        </div>

      </div>
      )}
    </div>
  );
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={28} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return <Editor userId={session.user.id} />;
}
