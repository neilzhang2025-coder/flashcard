-- Run this in the Supabase SQL Editor to set up the database.

-- ── FLASHCARD SETS ──
CREATE TABLE IF NOT EXISTS flashcard_sets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── FLASHCARDS ──
CREATE TABLE IF NOT EXISTS flashcards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id      UUID NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── STUDY PROGRESS ──
-- One row per (user, card). Upserted on every correct/wrong mark.
CREATE TABLE IF NOT EXISTS study_progress (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id     UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'unseen'
                CHECK (status IN ('unseen', 'correct', 'wrong')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, card_id)
);

-- ── INDEXES ──
CREATE INDEX IF NOT EXISTS idx_flashcard_sets_user_id  ON flashcard_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_set_id       ON flashcards(set_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_user_id  ON study_progress(user_id);

-- ── AUTO-UPDATE updated_at ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sets_updated_at
  BEFORE UPDATE ON flashcard_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_progress_updated_at
  BEFORE UPDATE ON study_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── ROW LEVEL SECURITY ──
ALTER TABLE flashcard_sets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_progress  ENABLE ROW LEVEL SECURITY;

-- flashcard_sets: users own their own sets
CREATE POLICY "sets: owner full access" ON flashcard_sets
  FOR ALL USING (auth.uid() = user_id);

-- flashcards: users can access cards in their own sets
CREATE POLICY "cards: owner full access" ON flashcards
  FOR ALL USING (
    set_id IN (
      SELECT id FROM flashcard_sets WHERE user_id = auth.uid()
    )
  );

-- study_progress: users own their own progress
CREATE POLICY "progress: owner full access" ON study_progress
  FOR ALL USING (auth.uid() = user_id);
