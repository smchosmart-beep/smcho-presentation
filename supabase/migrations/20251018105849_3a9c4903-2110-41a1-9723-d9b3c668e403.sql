-- Change default value of attendee_count from 1 to 0
-- This allows admin to track only actual attendees, not pre-registered ones
ALTER TABLE attendees 
ALTER COLUMN attendee_count SET DEFAULT 0;