import { Seat } from "./Seat";

interface Attendee {
  id: string;
  name: string;
  seat_number: string | null;
}

interface SeatRowProps {
  rowLabel: string;
  attendees: Attendee[];
  onSeatClick: (seatNumber: string, currentAttendee?: Attendee) => void;
  highlightSeats?: string[];
}

export const SeatRow = ({ rowLabel, attendees, onSeatClick, highlightSeats = [] }: SeatRowProps) => {
  const seatGroups = [
    [1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10],
    [11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20],
  ];

  const getSeatNumber = (num: number) => `${rowLabel}-${String(num).padStart(2, "0")}`;

  const getAssignedAttendee = (seatNumber: string) => {
    return attendees.find((a) => a.seat_number === seatNumber);
  };

  return (
    <div className="flex items-center gap-2 mb-2">
      {/* Row Label */}
      <div className="w-8 text-center font-bold text-lg">{rowLabel}</div>

      {/* Aisle */}
      <div className="w-2 border-l border-dashed border-border" />

      {/* Seat Groups */}
      {seatGroups.map((group, groupIndex) => (
        <div key={groupIndex} className="flex gap-1">
          {group.map((seatNum) => {
            const seatNumber = getSeatNumber(seatNum);
            const attendee = getAssignedAttendee(seatNumber);
            return (
              <Seat
                key={seatNumber}
                seatNumber={seatNumber}
                assignedTo={attendee?.name}
                onClick={() => onSeatClick(seatNumber, attendee)}
                isCurrentUser={highlightSeats.includes(seatNumber)}
              />
            );
          })}
          {/* Aisle between groups */}
          {groupIndex < seatGroups.length - 1 && (
            <div className="w-2 border-l border-dashed border-border" />
          )}
        </div>
      ))}

      {/* Aisle */}
      <div className="w-2 border-l border-dashed border-border" />
    </div>
  );
};
