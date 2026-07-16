
import React from 'react';
import { SongData } from '../types';
import { StandardNotation } from './StandardNotation';
import { parseStickNotation, stickToABC, StickMeasure } from '../lib/stickParser';
import {
  layoutSystem,
  toSystems,
  LaidNote,
  TOP,
  STEM_H,
  SOLFA_Y,
  LYRIC_Y,
  BEAM1_Y,
  BEAM2_Y,
} from '../lib/stickLayout';

interface DocumentPreviewProps {
  data: SongData;
}

// Ink colors shared by every glyph. Barlines are lighter than note stems so
// they never read as quarter notes.
const INK = '#111827';
const BAR = '#9ca3af';
const BEAM_W = 4.5;

// --- REST GLYPH (SVG paths placed at a note's absolute x within the system) ---
const Rest: React.FC<{ x: number; base: number }> = ({ x, base }) => {
  const t = `translate(${x - 12} ${TOP - 2})`;
  // Half rest: block sitting on a line. Whole rest: block hanging from a line.
  if (base === 2 || base === 1) {
    return (
      <g transform={t}>
        <line x1={3} y1={30} x2={21} y2={30} stroke={INK} strokeWidth={1.5} />
        {base === 2 ? (
          <rect x={7} y={22} width={10} height={8} fill={INK} />
        ) : (
          <rect x={7} y={30} width={10} height={8} fill={INK} />
        )}
      </g>
    );
  }
  // Eighth / sixteenth rest: diagonal stem with curled hook(s) + dot(s)
  if (base === 8 || base === 16) {
    return (
      <g transform={t}>
        <path d="M16 10 L10 40" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        <path d="M16 10 C14 17 10 19 6 15" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
        <circle cx={6} cy={14} r={2.4} fill={INK} />
        {base === 16 && (
          <>
            <path d="M14 20 C12 26 9 28 5 24" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
            <circle cx={5} cy={23} r={2.4} fill={INK} />
          </>
        )}
      </g>
    );
  }
  // Quarter rest: classic zigzag with curl
  return (
    <g transform={t}>
      <path
        d="M9 7 L16 17 L9 25 L16 34 C10 31 7 35 11 41"
        stroke={INK}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </g>
  );
};

// --- NOTE GLYPH (stem + optional notehead / flag / dot) at absolute x ---
const Note: React.FC<{ beat: LaidNote }> = ({ beat: b }) => {
  if (b.isRest) return <Rest x={b.x} base={b.base} />;
  // Whole note: open head, no stem.
  if (b.base === 1) {
    return <circle cx={b.x} cy={TOP + STEM_H / 2} r={4.5} fill="none" stroke={INK} strokeWidth={2.4} />;
  }
  const els: React.ReactNode[] = [
    <line key="stem" x1={b.x} y1={TOP} x2={b.x} y2={TOP + STEM_H} stroke={INK} strokeWidth={2.4} />,
  ];
  // Half note: open notehead at the foot of the stem.
  if (b.base === 2) {
    els.push(<circle key="head" cx={b.x} cy={TOP + STEM_H} r={4.5} fill="none" stroke={INK} strokeWidth={2.4} />);
  }
  // Unbeamed eighths/sixteenths get a flag; beamed ones are drawn by the system.
  const beamed = b.beamLeft || b.beamRight;
  if ((b.base === 8 || b.base === 16) && !beamed) {
    els.push(<path key="flag1" d={`M${b.x} ${TOP} q 11 4 8 15`} stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />);
    if (b.base === 16) {
      els.push(<path key="flag2" d={`M${b.x} ${TOP + 8} q 11 4 8 15`} stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />);
    }
  }
  if (b.isDotted) els.push(<circle key="dot" cx={b.x + 8} cy={TOP + STEM_H - 4} r={1.8} fill={INK} />);
  return <>{els}</>;
};

// --- BARLINE GLYPH at absolute x (lighter than note stems) ---
const Barline: React.FC<{ x: number; token: string }> = ({ x, token }) => {
  const H = TOP + STEM_H;
  switch (token) {
    case '||':
      return (
        <>
          <line x1={x - 2} y1={TOP} x2={x - 2} y2={H} stroke={BAR} strokeWidth={1.5} />
          <line x1={x + 2} y1={TOP} x2={x + 2} y2={H} stroke={BAR} strokeWidth={1.5} />
        </>
      );
    case '|]':
      return (
        <>
          <line x1={x - 3} y1={TOP} x2={x - 3} y2={H} stroke={BAR} strokeWidth={1.5} />
          <line x1={x + 1} y1={TOP} x2={x + 1} y2={H} stroke={BAR} strokeWidth={4} />
        </>
      );
    case ':|':
      return (
        <>
          <circle cx={x - 8} cy={TOP + 12} r={1.6} fill={BAR} />
          <circle cx={x - 8} cy={H - 12} r={1.6} fill={BAR} />
          <line x1={x - 3} y1={TOP} x2={x - 3} y2={H} stroke={BAR} strokeWidth={1.5} />
          <line x1={x + 1} y1={TOP} x2={x + 1} y2={H} stroke={BAR} strokeWidth={3.5} />
        </>
      );
    case '|:':
      return (
        <>
          <line x1={x - 1} y1={TOP} x2={x - 1} y2={H} stroke={BAR} strokeWidth={3.5} />
          <line x1={x + 3} y1={TOP} x2={x + 3} y2={H} stroke={BAR} strokeWidth={1.5} />
          <circle cx={x + 8} cy={TOP + 12} r={1.6} fill={BAR} />
          <circle cx={x + 8} cy={H - 12} r={1.6} fill={BAR} />
        </>
      );
    default: // '|'
      return <line x1={x} y1={TOP} x2={x} y2={H} stroke={BAR} strokeWidth={1.5} />;
  }
};

// --- ONE SYSTEM (a visual line) rendered as a single SVG ---
// Everything lives in one coordinate space, so beams connect between real note
// positions and solfège/lyrics align to the same baseline.
const System: React.FC<{ measures: StickMeasure[]; isFirst: boolean; timeSignature: string }> = ({
  measures,
  isFirst,
  timeSignature,
}) => {
  const { notes, barlines, width, height } = layoutSystem(measures);
  const els: React.ReactNode[] = [];

  // Beams first, so stems draw over them. Each beam is a line between two real
  // note x-positions — this is why beams actually connect across notes.
  notes.forEach((b, i) => {
    const next = notes[i + 1];
    if (b.beamRight && next)
      els.push(<line key={`bm1-${i}`} x1={b.x} y1={BEAM1_Y} x2={next.x} y2={BEAM1_Y} stroke={INK} strokeWidth={BEAM_W} />);
    if (b.secondRight === 'full' && next)
      els.push(<line key={`bm2-${i}`} x1={b.x} y1={BEAM2_Y} x2={next.x} y2={BEAM2_Y} stroke={INK} strokeWidth={BEAM_W} />);
    if (b.secondRight === 'stub')
      els.push(<line key={`bsr-${i}`} x1={b.x} y1={BEAM2_Y} x2={b.x + 10} y2={BEAM2_Y} stroke={INK} strokeWidth={BEAM_W} />);
    if (b.secondLeft === 'stub')
      els.push(<line key={`bsl-${i}`} x1={b.x - 10} y1={BEAM2_Y} x2={b.x} y2={BEAM2_Y} stroke={INK} strokeWidth={BEAM_W} />);
  });

  // Barlines
  barlines.forEach((bl, i) => els.push(<Barline key={`bar-${i}`} x={bl.x} token={bl.token} />));

  // Notes + solfège + lyrics + hyphens
  notes.forEach((b, i) => {
    // Hyphen joining two syllables of one word, centered between the notes.
    if (b.hyphenAfter) {
      const nx = notes[i + 1];
      if (nx)
        els.push(
          <text
            key={`hy-${i}`}
            x={(b.x + nx.x) / 2}
            y={LYRIC_Y}
            textAnchor="middle"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize={15}
            fill={INK}
          >
            -
          </text>
        );
    }
    // Melisma extension line: a syllable held across following notes that have
    // no syllable of their own — draw a line from the syllable to the last such
    // note. Bounded to this system, so it never dangles past a line break.
    if (b.lyric) {
      let j = i + 1;
      while (j < notes.length && notes[j].isMelismaTail) j++;
      const lastTail = j - 1;
      if (lastTail > i) {
        els.push(
          <line
            key={`ml-${i}`}
            x1={b.x + 12}
            y1={LYRIC_Y - 4}
            x2={notes[lastTail].x}
            y2={LYRIC_Y - 4}
            stroke={INK}
            strokeWidth={1.5}
          />
        );
      }
    }
    els.push(<Note key={`n-${i}`} beat={b} />);
    if (b.solfege)
      els.push(
        <text
          key={`sf-${i}`}
          x={b.x}
          y={SOLFA_Y}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontWeight={700}
          fontSize={19}
          fill={INK}
        >
          {b.solfege}
        </text>
      );
    if (b.lyric)
      els.push(
        <text
          key={`ly-${i}`}
          x={b.x}
          y={LYRIC_Y}
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize={15}
          fill={INK}
        >
          {b.lyric}
        </text>
      );
  });

  // Time signature, once, on the first system.
  if (isFirst && timeSignature) {
    const [num, den] = timeSignature.split('/');
    els.push(
      <text key="ts-n" x={16} y={TOP + 15} textAnchor="middle" fontWeight={800} fontSize={18} fill={INK}>
        {num}
      </text>
    );
    els.push(
      <text key="ts-d" x={16} y={TOP + 34} textAnchor="middle" fontWeight={800} fontSize={18} fill={INK}>
        {den}
      </text>
    );
  }

  // Each system is its own avoid-break block, so pages break between lines and
  // a system can never be clipped across a page boundary.
  return (
    <div className="avoid-break" style={{ marginBottom: '1.5rem' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={{ display: 'block', maxWidth: '100%', height: 'auto', overflow: 'visible' }}
      >
        {els}
      </svg>
    </div>
  );
};

// --- STICK NOTATION RENDERER: one SVG per system ---
const StickNotation: React.FC<{ text: string; timeSignature: string }> = ({ text, timeSignature }) => {
  const parsed = parseStickNotation(text, timeSignature);
  if (parsed.measures.length === 0) return null;
  const systems = toSystems(parsed.measures);
  return (
    <div className="w-full flex flex-col">
      {systems.map((measures, i) => (
        <System key={i} measures={measures} isFirst={i === 0} timeSignature={timeSignature} />
      ))}
    </div>
  );
};

// Renders a written-content block, turning lines like "[Verse 2]" into part
// headings so the text under the notation is delineated by part. Lines without
// brackets render as plain text, so existing songs look exactly as before.
const LabeledText: React.FC<{ text: string }> = ({ text }) => {
  const nodes: React.ReactNode[] = [];
  let buffer: string[] = [];

  const flush = (key: string) => {
    const body = buffer.join('\n').replace(/^\n+|\n+$/g, '');
    if (body.trim()) {
      nodes.push(
        <div key={key} className="whitespace-pre-wrap leading-relaxed text-black font-sans" style={{ fontSize: 'inherit' }}>
          {body}
        </div>
      );
    }
    buffer = [];
  };

  text.split('\n').forEach((line, i) => {
    const label = line.match(/^\s*\[(.+?)\]\s*$/);
    if (label) {
      flush(`b${i}`);
      nodes.push(
        <div
          key={`h${i}`}
          className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-500 mt-4 mb-1 pb-0.5 border-b border-gray-200 first:mt-0"
        >
          {label[1]}
        </div>
      );
    } else {
      buffer.push(line);
    }
  });
  flush('bEnd');

  return <>{nodes}</>;
};

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ data }) => {
  
  // The Header Content (Used in both screen and print)
  const HeaderContent = () => (
    <div className="w-full flex flex-col items-center pb-4 pt-10 px-12 bg-white">
      
      {/* Top Section: 3 Columns */}
      <div className="w-full flex justify-between items-center border-b-2 border-gray-800 pb-6">
        
        {/* Left Column: Pitch & Tempo */}
        <div className="w-1/4 flex flex-col space-y-4">
          <div className="flex flex-col items-start">
            <span className="text-[9px] tracking-[0.2em] text-gray-400 uppercase mb-1 font-bold">Pitch</span>
            <span className="text-sm font-serif text-gray-900 font-medium">
              {data.ssp ? `SSP: ${data.ssp}` : '—'}
              {data.ssp && data.rsp && <span className="mx-2 text-gray-300">|</span>}
              {data.rsp && `RSP: ${data.rsp}`}
            </span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[9px] tracking-[0.2em] text-gray-400 uppercase mb-1 font-bold">Tempo</span>
            <span className="text-sm font-serif text-gray-900 font-medium">
              {(data.beatNote || data.bpm) ? `${data.beatNote} = ${data.bpm}` : '—'}
            </span>
          </div>
        </div>

        {/* Middle Column: Title */}
        <div className="w-1/2 text-center px-4 flex flex-col justify-center items-center">
          <div className="text-[10px] tracking-[0.4em] text-gray-500 uppercase mb-3 w-full text-center font-sans font-semibold">
            {data.crossRefTitle || ' '}
          </div>
          <h1 
            style={{ fontSize: `${data.titleSize}px`, fontFamily: 'Georgia, serif' }} 
            className="font-black uppercase leading-none text-black text-center tracking-wide"
          >
            {data.title}
          </h1>
        </div>

        {/* Right Column: Genre & Subject */}
        <div className="w-1/4 flex flex-col space-y-4 items-end text-right">
          <div className="flex flex-col items-end">
            <span className="text-[9px] tracking-[0.2em] text-gray-400 uppercase mb-1 font-bold">Genre</span>
            <span className="text-sm font-serif text-gray-900 font-medium">{data.genre || '—'}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] tracking-[0.2em] text-gray-400 uppercase mb-1 font-bold">Subject</span>
            <span className="text-sm font-serif text-gray-900 font-medium">{data.subject || '—'}</span>
          </div>
        </div>

      </div>

      {/* Melodic Content Sub-bar - Left Aligned */}
      <div className="w-full border-b border-gray-800 py-2 flex justify-between items-center bg-gray-50/50 font-sans px-4">
        <span className="text-[9px] tracking-[0.2em] text-gray-500 uppercase mr-6 font-bold">Melodic Content</span>
        <span className="font-mono text-[20px] text-gray-900 whitespace-pre font-bold tracking-widest text-right">{data.melodicContent || '—'}</span>
      </div>
    </div>
  );

  // The Footer Content (Used in both screen and print)
  const FooterContent = () => (
    <div className="flex justify-between items-end text-[10px] text-gray-400 uppercase tracking-widest pb-10 pt-4 px-12 w-full font-sans bg-white">
      <div className="w-1/3 text-left truncate pr-4 font-semibold">
        {data.nameDate || 'KODÁLY MASTER COPY'} · RAINBOWHEART.STUDIO
      </div>
      <div className="w-1/3 text-center normal-case tracking-normal text-gray-500 px-4 font-serif italic text-[14px]">
        {data.source}
      </div>
      <div className="w-1/3 text-right flex justify-end items-center whitespace-nowrap pl-4 font-semibold">
        <span className="truncate max-w-[150px]">{data.title}</span>
        <span className="mx-2">·</span>
        <span className="page-number"></span>
      </div>
    </div>
  );

  // The Main Body Content
  const BodyContent = () => (
    <div style={{ fontSize: `${data.textSize}px` }} className="w-full px-12 py-6 font-mono text-gray-900">
      
      {/* Notation Section — the staff view renders live from the same stick
          notation; stored ABC is only a fallback for legacy documents.
          No avoid-break here: long songs must paginate. Each stick LINE
          carries its own avoid-break so page breaks fall between lines. */}
      <div className="mb-12 w-full flex justify-start overflow-x-auto pl-8 pr-4">
        {data.notationMode === 'standard' ? (
          <StandardNotation
            abc={data.notation.trim()
              ? stickToABC(data.notation, data.timeSignature)
              : data.abcNotation}
          />
        ) : (
          <div className="w-full">
            <StickNotation text={data.notation} timeSignature={data.timeSignature} />
          </div>
        )}
      </div>

      {/* Additional Verses — supports [Part] labels to delineate sections */}
      {data.additionalVerses && (
        <div className="mb-8 avoid-break">
          <LabeledText text={data.additionalVerses} />
        </div>
      )}

      {/* Pertinent Information (Game/Dance) — also supports [Part] labels */}
      {data.pertinentInfo && (
        <div className="mb-8 avoid-break">
          <LabeledText text={data.pertinentInfo} />
        </div>
      )}
    </div>
  );

  return (
    <div id="printable-document" className="screen-page-box">
      
      {/* --- SCREEN ONLY: Locked Header & Footer --- */}
      <div className="doc-header no-print">
        <HeaderContent />
      </div>
      
      {/* --- CONTENT AREA --- */}
      <div className="doc-content">
        
        {/* 
          This table handles the PRINT layout. 
          The thead and tfoot automatically repeat on every printed page.
          The tbody naturally paginates without scrollbars.
        */}
        <table className="w-full print-table">
          
          {/* PRINT ONLY: Repeating Header */}
          <thead className="print-only-table-part thead">
            <tr><td><HeaderContent /></td></tr>
          </thead>
          
          {/* Body Content (Visible on both screen and print) */}
          <tbody>
            <tr><td><BodyContent /></td></tr>
          </tbody>
          
          {/* PRINT ONLY: Repeating Footer */}
          <tfoot className="print-only-table-part tfoot">
            <tr><td><FooterContent /></td></tr>
          </tfoot>

        </table>

      </div>

      {/* --- SCREEN ONLY: Locked Footer --- */}
      <div className="doc-footer no-print">
        <FooterContent />
      </div>

    </div>
  );
};
