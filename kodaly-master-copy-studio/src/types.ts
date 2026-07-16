
export interface SongData {
  title: string;
  crossRefTitle: string;
  ssp: string;
  rsp: string;
  timeSignature: string;
  beatNote: string;
  bpm: string;
  genre: string;
  subject: string;
  melodicContent: string;
  melodicNotes: Record<string, 'selected' | 'final'>;
  notationMode: 'stick' | 'standard';
  notation: string;
  abcNotation: string;
  additionalVerses: string;
  pertinentInfo: string;
  source: string;
  nameDate: string;
  textSize: number;
  titleSize: number;
}
