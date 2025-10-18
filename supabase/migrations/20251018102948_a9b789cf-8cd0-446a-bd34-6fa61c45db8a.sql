-- Add event_time column to sessions table
ALTER TABLE public.sessions 
  ADD COLUMN IF NOT EXISTS event_time time;