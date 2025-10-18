import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SeatRow } from "./SeatRow";

interface SeatLayout {
  id: string;
  row_label: string;
  display_order: number;
}

interface Attendee {
  id: string;
  name: string;
  phone: string;
  seat_number: string | null;
  attendee_count: number;
}

interface SeatLayoutViewerProps {
  highlightSeats: string[];
}

export const SeatLayoutViewer = ({ highlightSeats }: SeatLayoutViewerProps) => {
  const [layouts, setLayouts] = useState<SeatLayout[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [layoutsRes, attendeesRes] = await Promise.all([
        supabase
          .from("seat_layout")
          .select("*")
          .eq("is_active", true)
          .order("display_order"),
        supabase.from("attendees").select("*").order("name"),
      ]);

      if (layoutsRes.error) throw layoutsRes.error;
      if (attendeesRes.error) throw attendeesRes.error;

      setLayouts(layoutsRes.data || []);
      setAttendees(attendeesRes.data || []);
    } catch (error: any) {
      console.error("Error fetching seat data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeatClick = () => {
    // Read-only viewer, no interaction
  };

  if (loading) {
    return <div className="flex justify-center p-4 text-muted-foreground">로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="text-center p-2 bg-muted/50 rounded border">
        <span className="text-sm font-medium text-muted-foreground">
          ⬆️ 무대 / 스크린
        </span>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <div className="min-w-max p-4">
          {layouts.map((layout) => (
            <SeatRow
              key={layout.id}
              rowLabel={layout.row_label}
              attendees={attendees}
              onSeatClick={handleSeatClick}
              highlightSeats={highlightSeats}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-4 justify-center flex-wrap text-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent text-accent-foreground rounded border-2 border-accent flex items-center justify-center font-bold">
            ★
          </div>
          <span>내 좌석</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary text-primary-foreground rounded flex items-center justify-center">
            ✓
          </div>
          <span>배정됨</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-muted rounded border border-border" />
          <span>빈 좌석</span>
        </div>
      </div>
    </div>
  );
};
