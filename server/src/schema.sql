-- Users
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  color         TEXT NOT NULL,      -- assigned cursor color, stable per user
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents (workspace list)
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL DEFAULT 'Untitled document',
  owner_id    UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event-sourced operation log. This is the source of truth: current
-- document state is a fold over this table in id order. We also keep
-- `snapshots` purely as a performance optimization (so a doc with
-- 500k keystrokes doesn't replay from op #1 on every load) -- the
-- log itself is never mutated, which is what makes "reconstruct state
-- at any point in time" free later, even though a version-browser UI
-- is explicitly out of scope for this project.
CREATE TABLE IF NOT EXISTS operations (
  seq         BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  op          JSONB NOT NULL,        -- {type:'insert'|'delete', id:{counter,site}, originId, value}
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operations_document ON operations(document_id, seq);

-- Periodic snapshots so document load doesn't replay the full op log.
CREATE TABLE IF NOT EXISTS snapshots (
  document_id   UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  up_to_seq     BIGINT NOT NULL,
  nodes         JSONB NOT NULL,      -- RgaNode[]
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
