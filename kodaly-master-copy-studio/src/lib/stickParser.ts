// Shared stick-notation parser used by both the document renderer and the
// stick → ABC converter, so the two stay in sync.
//
// Input format (blocks separated by blank lines):
//   line 1: rhythm tokens — 4 8 16 2 1 (add . for dotted, z for rest)
//           plus optional barline tokens: | || |: :| :|:
//   line 2: solfa tokens — d r m f s l t (with , and ' octave marks)
//   line 3: lyrics — _syl_la_bles aligned to notes by underscore
//
// If ANY barline token appears in the rhythm lines, explicit mode is on:
// measures are exactly what the user barred (this is how pickups work —
// a short first measure is rendered at proportional width). Otherwise
// measures are auto-calculated from the time signature.

export interface StickBeat {
  base: number; // 1 | 2 | 4 | 8 | 16
  isRest: boolean;
  isDotted: boolean;
  duration: number; // in quarter notes
  solfege: string;
  lyric: string;
  hyphenAfter: boolean; // this syllable joins the next with a hyphen (same word)
  isMelismaTail: boolean; // no syllable of its own — continues the previous syllable
  beamLeft: boolean;
  beamRight: boolean;
  secondLeft: 'full' | 'stub' | null; // 16th-note second beam
  secondRight: 'full' | 'stub' | null;
}

export interface StickMeasure {
  beats: StickBeat[];
  duration: number; // quarter notes
  startBarline: string | null; // '|:' when a begin-repeat opens this measure
  endBarline: string; // '|' '||' ':|' '|]'
  breakAfter?: boolean; // force a line break after this measure (from a // token)
}

// Forces the rendered stick notation onto a new line at this point.
export const LINE_BREAK = '//';

export interface ParsedStick {
  measures: StickMeasure[];
  explicit: boolean;
  beatsPerMeasure: number;
  beatUnit: number; // beaming group size in quarter notes (1.5 in compound meters)
}

const BARLINES = new Set(['|', '||', '|:', ':|', ':|:', '|]']);

export function isBarlineToken(t: string): boolean {
  return BARLINES.has(t);
}

export function parseTimeSignature(ts: string) {
  const parts = (ts || '2/4').split('/');
  const num = parseInt(parts[0]) || 2;
  const den = parseInt(parts[1]) || 4;
  const beatsPerMeasure = num * (4 / den);
  // Compound meters (6/8, 9/8, 12/8) beam in dotted-quarter groups
  const beatUnit = den === 8 && num % 3 === 0 ? 1.5 : 4 / den;
  return { num, den, beatsPerMeasure, beatUnit };
}

export function parseRhythmToken(token: string) {
  const t = token.toLowerCase();
  const isRest = t.includes('z');
  const isDotted = t.includes('.');
  const base = parseInt(t.replace(/[^0-9]/g, '')) || 4;
  let duration = 4 / base;
  if (isDotted) duration *= 1.5;
  return { base, isRest, isDotted, duration };
}

type NoteEvent = ReturnType<typeof parseRhythmToken> & {
  kind: 'note';
  solfege: string;
  lyric: string;
  hyphenAfter: boolean;
  isMelismaTail: boolean;
};
type BarEvent = { kind: 'bar'; token: string };
type BreakEvent = { kind: 'break' };

function makeBeat(ev: NoteEvent): StickBeat {
  return {
    base: ev.base,
    isRest: ev.isRest,
    isDotted: ev.isDotted,
    duration: ev.duration,
    solfege: ev.solfege,
    lyric: ev.lyric,
    hyphenAfter: ev.hyphenAfter,
    isMelismaTail: ev.isMelismaTail,
    beamLeft: false,
    beamRight: false,
    secondLeft: null,
    secondRight: null,
  };
}

export function parseStickNotation(text: string, timeSignature: string): ParsedStick {
  const { beatsPerMeasure, beatUnit } = parseTimeSignature(timeSignature);

  // 1. Tokenize blocks into a flat event stream
  const events: (NoteEvent | BarEvent | BreakEvent)[] = [];
  const blocks = text.split(/\n\s*\n/);
  blocks.forEach((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter((l) => l);
    if (lines.length < 2) return;

    const rhythmTokens = lines[0].split(/\s+/);
    // barline tokens in the solfa line are tolerated and ignored
    const solfaTokens = lines[1].split(/\s+/).filter((t) => !isBarlineToken(t));
    let lyrics: string[] = [];
    if (lines[2]) {
      lyrics = lines[2].split('_');
      if (lyrics[0] === '') lyrics.shift();
    }
    // A syllable joins the next with a hyphen when its raw token is non-empty,
    // does NOT end in whitespace (no space before the next _), and a non-empty
    // next syllable exists — i.e. two syllables of one word split across notes.
    // The .trim() below would erase this signal, so read it from the raw token.
    const hyph = (i: number): boolean => {
      const r = lyrics[i];
      return (
        r !== undefined &&
        r.trim() !== '' &&
        !/\s$/.test(r) &&
        lyrics[i + 1] !== undefined &&
        lyrics[i + 1].trim() !== ''
      );
    };

    let noteIdx = 0;
    // Melisma: a note with no syllable of its own continues the previous
    // syllable. `prevMel` tracks whether the previous NOTE carried a syllable
    // or was itself a continuation (barlines don't break it; rests do). Scoped
    // to this block, so a held syllable never bleeds across a blank-line phrase.
    let prevMel: boolean = false;
    rhythmTokens.forEach((rt) => {
      if (rt === LINE_BREAK) {
        events.push({ kind: 'break' });
        return;
      }
      if (isBarlineToken(rt)) {
        events.push({ kind: 'bar', token: rt });
        return;
      }
      const parsed = parseRhythmToken(rt);
      const hasLyric = (lyrics[noteIdx] || '').trim() !== '';
      const isMelismaTail: boolean = !hasLyric && !parsed.isRest && prevMel;
      events.push({
        kind: 'note',
        ...parsed,
        solfege: solfaTokens[noteIdx] || '',
        lyric: (lyrics[noteIdx] || '').trim(),
        hyphenAfter: hyph(noteIdx),
        isMelismaTail,
      });
      prevMel = hasLyric || isMelismaTail;
      noteIdx++;
    });
    // extra solfa tokens beyond the rhythm line keep the old default-quarter behavior
    while (noteIdx < solfaTokens.length) {
      const hasLyric = (lyrics[noteIdx] || '').trim() !== '';
      const isMelismaTail: boolean = !hasLyric && prevMel;
      events.push({
        kind: 'note',
        ...parseRhythmToken('4'),
        solfege: solfaTokens[noteIdx] || '',
        lyric: (lyrics[noteIdx] || '').trim(),
        hyphenAfter: hyph(noteIdx),
        isMelismaTail,
      });
      prevMel = hasLyric || isMelismaTail;
      noteIdx++;
    }
  });

  const explicit = events.some((e) => e.kind === 'bar');

  // 2. Group into measures
  const measures: StickMeasure[] = [];
  let cur: StickBeat[] = [];
  let curDur = 0;
  let pendingStart: string | null = null;

  const closeMeasure = (endBarline: string) => {
    if (cur.length === 0) return;
    measures.push({ beats: cur, duration: curDur, startBarline: pendingStart, endBarline });
    cur = [];
    curDur = 0;
    pendingStart = null;
  };

  events.forEach((ev) => {
    if (ev.kind === 'bar') {
      // begin-repeats attach to the NEXT measure
      let endTok = ev.token;
      let nextStart: string | null = null;
      if (ev.token === '|:') {
        endTok = '|';
        nextStart = '|:';
      } else if (ev.token === ':|:') {
        endTok = ':|';
        nextStart = '|:';
      }
      if (cur.length > 0) {
        closeMeasure(endTok);
        pendingStart = nextStart;
      } else {
        // leading barline before any notes (e.g. song opens with |:)
        pendingStart = nextStart ?? pendingStart;
      }
      return;
    }
    if (ev.kind === 'break') {
      // Close any partial measure, then flag the last measure to break the line.
      if (cur.length > 0) closeMeasure('|');
      if (measures.length > 0) measures[measures.length - 1].breakAfter = true;
      return;
    }
    cur.push(makeBeat(ev));
    curDur += ev.duration;
    if (!explicit && curDur >= beatsPerMeasure - 0.01) {
      closeMeasure('|');
    }
  });
  closeMeasure('|');

  // 3. Final barline: plain '|' at the very end becomes a final double bar
  if (measures.length > 0) {
    const last = measures[measures.length - 1];
    if (last.endBarline === '|') last.endBarline = '|]';
  }

  // 4. Beaming, per measure, grouped by beat unit
  measures.forEach((m) => {
    let pos = 0;
    const starts = m.beats.map((b) => {
      const s = pos;
      pos += b.duration;
      return s;
    });
    const group = (s: number) => Math.floor((s + 1e-6) / beatUnit);
    const beamable = (b: StickBeat | undefined): b is StickBeat =>
      !!b && (b.base === 8 || b.base === 16) && !b.isRest;

    m.beats.forEach((b, i) => {
      if (!beamable(b)) return;
      const prev = m.beats[i - 1];
      const next = m.beats[i + 1];
      b.beamLeft = beamable(prev) && group(starts[i]) === group(starts[i - 1]);
      b.beamRight = beamable(next) && group(starts[i]) === group(starts[i + 1]);

      if (b.base === 16) {
        const leftIs16 = b.beamLeft && prev!.base === 16;
        const rightIs16 = b.beamRight && next!.base === 16;
        b.secondLeft = leftIs16 ? 'full' : null;
        b.secondRight = rightIs16 ? 'full' : null;
        // partial-beam stub when beamed only to non-16ths (e.g. ti-tika patterns)
        if (!leftIs16 && !rightIs16) {
          if (b.beamLeft) b.secondLeft = 'stub';
          else if (b.beamRight) b.secondRight = 'stub';
        }
      }
    });
  });

  return { measures, explicit, beatsPerMeasure, beatUnit };
}

// --- Stick notation → ABC (standard notation) ---
// Beam groups are emitted without spaces (spaces break beams in ABC),
// so the staff version beams eighths/sixteenths the same way the stick
// version does.

const PITCH_MAP: Record<string, string> = {
  'd,': 'C,', 'r,': 'D,', 'm,': 'E,', 'f,': 'F,', 's,': 'G,', 'l,': 'A,', 't,': 'B,',
  'd': 'C', 'r': 'D', 'm': 'E', 'f': 'F', 's': 'G', 'l': 'A', 't': 'B',
  "d'": 'c', "r'": 'd', "m'": 'e', "f'": 'f', "s'": 'g', "l'": 'a', "t'": 'b',
};

function durToABC(duration: number): string {
  if (duration === 0.25) return '/2';
  if (duration === 0.5) return ''; // 1 eighth is the L:1/8 default
  if (duration === 0.75) return '3/2';
  if (duration === 1.0) return '2';
  if (duration === 1.5) return '3';
  if (duration === 2.0) return '4';
  if (duration === 3.0) return '6';
  if (duration === 4.0) return '8';
  return '2'; // fallback
}

export function stickToABC(text: string, timeSignature: string): string {
  const parsed = parseStickNotation(text, timeSignature);

  const abcNotes: string[] = [];
  const abcLyrics: string[] = [];

  parsed.measures.forEach((measure, mIdx) => {
    if (measure.startBarline === '|:') abcNotes.push('|:');

    measure.beats.forEach((beat) => {
      const solfege = beat.solfege.toLowerCase();
      let pitch = PITCH_MAP[solfege] || 'C';
      if (beat.isRest || solfege === 'z') pitch = 'z';

      // glue to the previous token (no space) when it beams leftward
      const token = `${pitch}${durToABC(beat.duration)}`;
      if (beat.beamLeft && abcNotes.length > 0) {
        abcNotes[abcNotes.length - 1] += token;
      } else {
        abcNotes.push(token);
      }

      if (beat.lyric) {
        abcLyrics.push(beat.lyric.replace(/\s+/g, '-'));
      } else if (pitch !== 'z') {
        abcLyrics.push('*');
      }
    });

    abcNotes.push(measure.endBarline);
    // Line break every 4 measures
    if ((mIdx + 1) % 4 === 0 && mIdx < parsed.measures.length - 1) {
      abcNotes.push('\n');
    }
  });

  return `X:1\nM:${timeSignature || '2/4'}\nL:1/8\nK:C\n${abcNotes.join(' ')}\nw: ${abcLyrics.join(' ')}`;
}
