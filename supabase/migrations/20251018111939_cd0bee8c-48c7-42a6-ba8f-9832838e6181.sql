-- Add is_onsite_registration column to attendees table
ALTER TABLE public.attendees 
ADD COLUMN is_onsite_registration boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.attendees.is_onsite_registration IS 'True if the attendee was registered on-site (from main page), false if registered by admin';