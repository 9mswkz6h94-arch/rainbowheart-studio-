// Dev-only visual test page for the stick notation renderer.
// Open http://localhost:5199/?stick-test (dev builds only, no auth needed).
import React from 'react';
import { DocumentPreview } from '../components/DocumentPreview';
import { StandardNotation } from '../components/StandardNotation';
import { stickToABC } from '../lib/stickParser';
import { SongData } from '../types';

const base: SongData = {
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
  titleSize: 36,
};

const CASES: { label: string; data: Partial<SongData> }[] = [
  {
    label: 'Auto-barred (Apple Tree regression)',
    data: {
      title: 'AUTO BARS',
      notation: `8 8 4\ns s m\n_Ap_ple _tree,\n\n8 8 4\ns s m\n_Ap_ple _tree,\n\n8 8 8 8\ns s l l\n_will _the _ap_ple\n\n8 8 4\ns s m\n_fall _on _me?`,
    },
  },
  {
    label: 'Explicit barlines + pickup (short first measure, no opening barline)',
    data: {
      title: 'PICKUP',
      notation: `8 8 | 4 8 8 | 4 4 | 2 |\ns s l s m r d d\n_A _pick_up _starts _the _song _here _now`,
    },
  },
  {
    label: 'Repeats |: ... :| and double bar ||',
    data: {
      title: 'REPEATS',
      notation: `|: 8 8 4 | 8 8 4 :| 4 4 || 2 |\ns s m l l s m r d\n_Re_peat _me _re_peat _me _then _done _so`,
    },
  },
  {
    label: 'Rests: z (quarter), z8 (eighth), z2 (half)',
    data: {
      title: 'RESTS',
      notation: `4 z 8 8 z8 8\nd  m m  s\n_Rest _then _notes _more\n\n4 4 z2\nm r\n_all _done`,
    },
  },
  {
    label: 'Sixteenths: tika-tika, ti-tika, tika-ti',
    data: {
      title: 'SIXTEENTHS',
      notation: `16 16 16 16 8 8 | 8 16 16 16 16 8 | 4 4 | 2 |\nd d d d r r m m m s s l s m d\n_ti_ka_ti_ka _ti _ti _ti _ti_ka _ti_ka _ti _ta _ta _done`,
    },
  },
  {
    label: 'Melisma: held syllable extends across blank-lyric notes (Glo——ri-a)',
    data: {
      title: 'MELISMA',
      notation: `8 8 8 8 | 4 4 |\ns l s m d d\n_Glo_ _ _ri_a _men`,
    },
  },
  {
    label: 'Staff on Page — auto-rendered from sticks, no stored ABC',
    data: {
      title: 'AUTO STAFF',
      notationMode: 'standard',
      abcNotation: '',
      notation: `8 8 4\ns s m\n_Ap_ple _tree,\n\n8 8 4\ns s m\n_Ap_ple _tree,\n\n8 8 8 8\ns s l l\n_will _the _ap_ple\n\n8 8 4\ns s m\n_fall _on _me?`,
    },
  },
  {
    label: '6/8 compound meter (beams in threes)',
    data: {
      title: 'COMPOUND',
      timeSignature: '6/8',
      notation: `8 8 8 8 8 8\nd r m s l s\n_one _two _three _four _five _six\n\n4 8 4.\nm r d\n_lon_ger _end`,
    },
  },
];

export default function StickTest() {
  const appleTreeStick = CASES[0].data.notation as string;
  return (
    <div className="min-h-screen bg-slate-100 p-8 space-y-10 overflow-auto h-screen">
      <h1 className="text-2xl font-bold">Stick Notation Test Cases</h1>
      {CASES.map((c, i) => (
        <div key={i}>
          <h2 className="font-bold text-blue-700 mb-2">{i + 1}. {c.label}</h2>
          <div className="origin-top-left scale-75">
            <DocumentPreview data={{ ...base, ...c.data }} />
          </div>
        </div>
      ))}
      <div id="staff-case">
        <h2 className="font-bold text-blue-700 mb-2">7. Staff version via stickToABC (eighths must beam)</h2>
        <div className="bg-white p-6 rounded shadow max-w-3xl">
          <StandardNotation abc={stickToABC(appleTreeStick, '2/4')} />
          <pre className="mt-4 text-xs text-slate-500 whitespace-pre-wrap">{stickToABC(appleTreeStick, '2/4')}</pre>
        </div>
      </div>
    </div>
  );
}
