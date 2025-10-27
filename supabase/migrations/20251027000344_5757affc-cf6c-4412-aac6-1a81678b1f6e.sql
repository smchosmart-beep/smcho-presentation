-- Add version column to attendees table for optimistic locking
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;