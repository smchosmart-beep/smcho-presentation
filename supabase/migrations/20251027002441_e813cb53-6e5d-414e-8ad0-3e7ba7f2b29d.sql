-- Create seat assignment logs table
CREATE TABLE public.seat_assignment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  attendee_id UUID REFERENCES public.attendees(id) ON DELETE SET NULL,
  attendee_name TEXT NOT NULL,
  attendee_phone TEXT NOT NULL,
  requested_seat_count INTEGER NOT NULL,
  assigned_seats TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('success', 'conflict', 'retry', 'error')),
  error_message TEXT,
  version_attempted INTEGER,
  version_final INTEGER,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_seat_assignment_logs_session ON public.seat_assignment_logs(session_id);
CREATE INDEX idx_seat_assignment_logs_created ON public.seat_assignment_logs(created_at DESC);
CREATE INDEX idx_seat_assignment_logs_event_type ON public.seat_assignment_logs(event_type);

-- Enable Row Level Security
ALTER TABLE public.seat_assignment_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view logs
CREATE POLICY "Admins can view assignment logs"
  ON public.seat_assignment_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.seat_assignment_logs;