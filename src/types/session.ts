export type Session = {
  id: string;
  year: number;
  session_number: number;
  name: string;
  is_active: boolean;
  max_attendee_count: number;
  event_date: string | null;
  event_time: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionWithStats = Session & {
  total_attendees: number;
  assigned_seats: number;
};
