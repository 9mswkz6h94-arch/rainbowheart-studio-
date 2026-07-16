-- Master Copy Studio: full editor document storage
-- Run in Supabase SQL Editor (same project as rainbro).
-- Adds one JSONB column to the existing kodaly_songs table so the
-- Master Copy Studio editor can save/load complete documents while
-- rainbro's Study Room keeps using the catalog columns.

ALTER TABLE kodaly_songs
  ADD COLUMN IF NOT EXISTS master_copy_data JSONB;

COMMENT ON COLUMN kodaly_songs.master_copy_data IS
  'Full SongData document from the Kodály Master Copy Studio editor (notation, lyrics, layout settings)';
