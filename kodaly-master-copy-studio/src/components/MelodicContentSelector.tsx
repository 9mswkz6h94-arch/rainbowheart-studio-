
import React from 'react';

const ALL_NOTES = ['d,', 'r,', 'm,', 'f,', 's,', 'l,', 't,', 'd', 'r', 'm', 'f', 's', 'l', 't', "d'", "r'", "m'", "f'", "s'", "l'", "t'"];
const OCTAVES = [
  ["d'", "r'", "m'", "f'", "s'", "l'", "t'"],
  ['d', 'r', 'm', 'f', 's', 'l', 't'],
  ['d,', 'r,', 'm,', 'f,', 's,', 'l,', 't,']
];

interface Props {
  value: Record<string, 'selected' | 'final'>;
  onChange: (newValue: Record<string, 'selected' | 'final'>, generatedString: string) => void;
}

export const MelodicContentSelector: React.FC<Props> = ({ value, onChange }) => {
  const handleToggle = (note: string) => {
    const currentState = value[note];
    const newValue = { ...value };
    
    if (!currentState) {
      newValue[note] = 'selected';
    } else if (currentState === 'selected') {
      newValue[note] = 'final';
    } else {
      delete newValue[note];
    }

    // Generate the spaced string
    const activeNotes = Object.keys(newValue).filter(k => newValue[k]);
    let generatedString = '';
    
    if (activeNotes.length > 0) {
      const indices = activeNotes
        .map(n => ALL_NOTES.indexOf(n))
        .filter(i => i !== -1)
        .sort((a, b) => a - b);
        
      if (indices.length > 0) {
        const minIdx = indices[0];
        const maxIdx = indices[indices.length - 1];
        const parts = [];
        
        for (let i = minIdx; i <= maxIdx; i++) {
          const n = ALL_NOTES[i];
          const state = newValue[n];
          
          if (state === 'selected') {
            parts.push(n);
          } else if (state === 'final') {
            parts.push(`(${n})`);
          } else {
            // Pad with spaces equal to the missing note's length to show distance
            parts.push(' '.repeat(n.length));
          }
        }
        // Join with a single space. Adjacent notes get 1 space, skipped notes get more.
        generatedString = parts.join(' ');
      }
    }

    onChange(newValue, generatedString);
  };

  return (
    <div className="mb-6">
      <label className="block text-sm font-bold text-slate-700 mb-2">
        Melodic Content
      </label>
      <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-2 shadow-sm">
        {OCTAVES.map((octave, rowIdx) => (
          <div key={rowIdx} className="flex justify-center space-x-1.5">
            {octave.map(note => {
              const state = value[note];
              let btnClass = "w-10 h-10 rounded-md font-mono text-sm font-medium transition-all flex items-center justify-center border select-none ";
              
              if (!state) {
                btnClass += "bg-white border-slate-300 text-slate-500 hover:bg-slate-100 hover:border-slate-400";
              } else if (state === 'selected') {
                btnClass += "bg-blue-100 border-blue-400 text-blue-800 shadow-inner";
              } else if (state === 'final') {
                btnClass += "bg-blue-600 border-blue-700 text-white shadow-md ring-2 ring-blue-300 ring-offset-1";
              }

              return (
                <button
                  key={note}
                  onClick={() => handleToggle(note)}
                  className={btnClass}
                  title={`Toggle ${note}`}
                  type="button"
                >
                  {state === 'final' ? `(${note})` : note}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500 text-center">
        Click once to select, again to mark as final (circled), and again to remove.
      </p>
    </div>
  );
};
