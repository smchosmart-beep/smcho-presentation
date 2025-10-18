-- Create sessions table for managing admission briefing sessions
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  session_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  max_attendee_count INTEGER DEFAULT 5,
  event_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_year_session UNIQUE (year, session_number),
  CONSTRAINT check_positive_session_number CHECK (session_number > 0)
);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
CREATE POLICY "Anyone can view sessions"
  ON public.sessions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage sessions"
  ON public.sessions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default session (2025 1st session)
INSERT INTO public.sessions (year, session_number, name, is_active, max_attendee_count)
VALUES (2025, 1, '2025년 1회차', true, 5);

-- Add session_id to attendees table
ALTER TABLE public.attendees 
  ADD COLUMN session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE;

-- Migrate existing attendees to the default session
UPDATE public.attendees 
SET session_id = (SELECT id FROM public.sessions WHERE year = 2025 AND session_number = 1)
WHERE session_id IS NULL;

-- Make session_id NOT NULL after migration
ALTER TABLE public.attendees 
  ALTER COLUMN session_id SET NOT NULL;

-- Create index for performance
CREATE INDEX idx_attendees_session_id ON public.attendees(session_id);

-- Add session_id to seat_layout table
ALTER TABLE public.seat_layout 
  ADD COLUMN session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE;

-- Migrate existing seat layouts to the default session
UPDATE public.seat_layout 
SET session_id = (SELECT id FROM public.sessions WHERE year = 2025 AND session_number = 1)
WHERE session_id IS NULL;

-- Make session_id NOT NULL after migration
ALTER TABLE public.seat_layout 
  ALTER COLUMN session_id SET NOT NULL;

-- Create index for performance
CREATE INDEX idx_seat_layout_session_id ON public.seat_layout(session_id);