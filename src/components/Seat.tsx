import { cn } from "@/lib/utils";

interface SeatProps {
  seatNumber: string;
  assignedTo?: string;
  onClick: () => void;
  className?: string;
  isCurrentUser?: boolean;
}

export const Seat = ({ seatNumber, assignedTo, onClick, className, isCurrentUser = false }: SeatProps) => {
  const isAssigned = !!assignedTo;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-12 h-12 rounded text-xs font-medium transition-all duration-200",
        "flex items-center justify-center",
        "border border-border",
        isCurrentUser
          ? "bg-accent text-accent-foreground ring-2 ring-accent animate-pulse"
          : isAssigned
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-muted hover:bg-accent hover:text-accent-foreground",
        className
      )}
      title={
        isCurrentUser
          ? `${seatNumber}: 내 좌석`
          : assignedTo
          ? `${seatNumber}: ${assignedTo}`
          : `${seatNumber}: 빈 좌석`
      }
    >
      {assignedTo ? (
        <span className="truncate px-1">{assignedTo.split(" ")[0]}</span>
      ) : (
        <span className="text-muted-foreground">{seatNumber.split("-")[1]}</span>
      )}
    </button>
  );
};
