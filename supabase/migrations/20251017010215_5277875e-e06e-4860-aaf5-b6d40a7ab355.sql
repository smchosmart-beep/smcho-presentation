-- Create seat_layout table for managing seating rows
CREATE TABLE public.seat_layout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_label text NOT NULL UNIQUE,
  seat_count integer NOT NULL DEFAULT 20,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seat_layout ENABLE ROW LEVEL SECURITY;

-- Admins can manage seat layout
CREATE POLICY "Admins can manage seat layout"
ON public.seat_layout FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Anyone can view seat layout (for parent-facing pages)
CREATE POLICY "Anyone can view seat layout"
ON public.seat_layout FOR SELECT
USING (true);

-- Insert default rows A through L
INSERT INTO public.seat_layout (row_label, display_order)
VALUES 
  ('A', 1), ('B', 2), ('C', 3), ('D', 4), 
  ('E', 5), ('F', 6), ('G', 7), ('H', 8),
  ('I', 9), ('J', 10), ('K', 11), ('L', 12);

-- Create trigger for updated_at
CREATE TRIGGER update_seat_layout_updated_at
BEFORE UPDATE ON public.seat_layout
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();