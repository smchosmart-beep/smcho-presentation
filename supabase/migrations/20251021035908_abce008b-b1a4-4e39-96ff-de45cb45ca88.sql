-- Create tour_groups table
CREATE TABLE public.tour_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  group_number INTEGER NOT NULL,
  attendee_id UUID NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(session_id, attendee_id),
  CHECK (group_number BETWEEN 1 AND 10)
);

-- Create indexes for better query performance
CREATE INDEX idx_tour_groups_session ON public.tour_groups(session_id);
CREATE INDEX idx_tour_groups_group_number ON public.tour_groups(group_number);

-- Enable Row Level Security
ALTER TABLE public.tour_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can manage tour groups
CREATE POLICY "Admins can manage tour groups"
ON public.tour_groups
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policy: Anyone can view tour groups
CREATE POLICY "Anyone can view tour groups"
ON public.tour_groups
FOR SELECT
TO authenticated, anon
USING (true);