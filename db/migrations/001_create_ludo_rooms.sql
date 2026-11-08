CREATE TABLE IF NOT EXISTS ludo_rooms (
  room_code CHAR(6) PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('waiting','playing','finished')),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  room_data JSONB NOT NULL,
  version BIGINT NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ludo_rooms_updated_at_idx ON ludo_rooms(updated_at);
