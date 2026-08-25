export const SCHEMA_VERSION = 2;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  acceptance TEXT NOT NULL DEFAULT 'suggested'
    CHECK (acceptance IN ('suggested', 'accepted')),
  resolution TEXT NOT NULL DEFAULT 'open'
    CHECK (resolution IN ('open', 'leaning', 'decided')),
  resolved_option_id INTEGER REFERENCES options(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question_parents (
  child_id INTEGER NOT NULL REFERENCES questions(id),
  parent_id INTEGER REFERENCES questions(id),
  position REAL NOT NULL,
  acceptance TEXT NOT NULL DEFAULT 'suggested'
    CHECK (acceptance IN ('suggested', 'accepted')),
  UNIQUE (child_id, parent_id)
);

CREATE TABLE IF NOT EXISTS options (
  id INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  acceptance TEXT NOT NULL DEFAULT 'suggested'
    CHECK (acceptance IN ('suggested', 'accepted')),
  position REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS criteria (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  acceptance TEXT NOT NULL DEFAULT 'suggested'
    CHECK (acceptance IN ('suggested', 'accepted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessments (
  option_id INTEGER NOT NULL REFERENCES options(id),
  criterion_id INTEGER NOT NULL REFERENCES criteria(id),
  polarity TEXT NOT NULL
    CHECK (polarity IN ('+', '-', '~', '?')),
  note TEXT NOT NULL DEFAULT '',
  acceptance TEXT NOT NULL DEFAULT 'suggested'
    CHECK (acceptance IN ('suggested', 'accepted')),
  PRIMARY KEY (option_id, criterion_id)
);

CREATE TABLE IF NOT EXISTS question_criteria (
  question_id INTEGER NOT NULL REFERENCES questions(id),
  criterion_id INTEGER NOT NULL REFERENCES criteria(id),
  acceptance TEXT NOT NULL DEFAULT 'suggested'
    CHECK (acceptance IN ('suggested', 'accepted')),
  PRIMARY KEY (question_id, criterion_id)
);

CREATE TABLE IF NOT EXISTS focus (
  row_lock INTEGER PRIMARY KEY CHECK (row_lock = 1),
  kind TEXT NOT NULL CHECK (kind IN ('question', 'option', 'criterion')),
  node_id INTEGER NOT NULL,
  set_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edits (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  actor TEXT NOT NULL,
  verb TEXT NOT NULL,
  entity_kind TEXT NOT NULL,
  entity_id INTEGER,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS question_parents_parent_position
  ON question_parents(parent_id, position);
CREATE INDEX IF NOT EXISTS options_question_position
  ON options(question_id, position);
CREATE INDEX IF NOT EXISTS edits_ts ON edits(ts);
`;
