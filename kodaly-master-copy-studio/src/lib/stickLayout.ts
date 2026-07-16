// Layout engine for stick notation: turns parsed measures into absolute
// coordinates for a single rendered system (visual line). This is the piece
// that lets each line render as ONE <svg> in a shared coordinate space, so
// beams connect between real note positions and spacing is proportional to
// note duration. Pure — no DOM, no React — so it can be unit-tested directly.

import { StickBeat, StickMeasure } from './stickParser';

// --- Vertical geometry of one system (SVG user units == px) ---
export const TOP = 10; // top of the stem zone
export const STEM_H = 40; // stem length
export const SOLFA_Y = TOP + STEM_H + 26; // solfège baseline
export const LYRIC_Y = SOLFA_Y + 22; // lyric baseline
export const SYS_H = LYRIC_Y + 14; // total system height
export const BEAM1_Y = TOP + 2; // primary beam
export const BEAM2_Y = TOP + 10; // second beam (16ths)

// --- Horizontal geometry ---
const UNIT = 46; // px per quarter note (proportional spacing)
const MIN_STEP = 34; // minimum advance between adjacent notes
const LEFT_PAD = 40; // room for the time signature
const RIGHT_PAD = 16;
const BAR_GAP = 22; // width a barline occupies

export const MEASURES_PER_LINE = 4;

export interface LaidNote extends StickBeat {
  x: number; // absolute x of the note's stem within the system
}
export interface LaidBarline {
  x: number;
  token: string;
}
export interface LaidSystem {
  notes: LaidNote[];
  barlines: LaidBarline[];
  width: number;
  height: number;
}

// Group measures into systems (visual lines): break at MEASURES_PER_LINE, or
// earlier wherever the notation forced a break (measure.breakAfter from a //).
export function toSystems(measures: StickMeasure[]): StickMeasure[][] {
  const systems: StickMeasure[][] = [];
  let line: StickMeasure[] = [];
  for (const m of measures) {
    line.push(m);
    if (line.length >= MEASURES_PER_LINE || m.breakAfter) {
      systems.push(line);
      line = [];
    }
  }
  if (line.length) systems.push(line);
  return systems;
}

// Assign an absolute x to every note and barline in one system.
export function layoutSystem(lineMeasures: StickMeasure[]): LaidSystem {
  let x = LEFT_PAD;
  const notes: LaidNote[] = [];
  const barlines: LaidBarline[] = [];

  lineMeasures.forEach((m) => {
    if (m.startBarline) barlines.push({ x: x - BAR_GAP / 2, token: m.startBarline });
    m.beats.forEach((b) => {
      notes.push({ ...b, x });
      x += Math.max(b.duration * UNIT, MIN_STEP);
    });
    barlines.push({ x, token: m.endBarline });
    x += BAR_GAP;
  });

  return { notes, barlines, width: x + RIGHT_PAD, height: SYS_H };
}
