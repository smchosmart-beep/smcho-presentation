-- Add tour_group_count column to settings table
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS tour_group_count integer NOT NULL DEFAULT 10;

COMMENT ON COLUMN settings.tour_group_count IS 'Number of tour groups for attendee distribution (8-15 recommended)';