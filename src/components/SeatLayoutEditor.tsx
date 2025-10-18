import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SeatRow } from "./SeatRow";
import { Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Session } from "@/types/session";

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

interface SeatLayoutEditorProps {
  currentSession: Session;
}

export const SeatLayoutEditor = ({ currentSession }: SeatLayoutEditorProps) => {
  const [layouts, setLayouts] = useState<SeatLayout[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [currentAttendee, setCurrentAttendee] = useState<Attendee | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<SeatLayout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [currentSession]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [layoutsRes, attendeesRes] = await Promise.all([
        supabase
          .from("seat_layout")
          .select("*")
          .eq("session_id", currentSession.id)
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("attendees")
          .select("*")
          .eq("session_id", currentSession.id)
          .order("name"),
      ]);

      if (layoutsRes.error) throw layoutsRes.error;
      if (attendeesRes.error) throw attendeesRes.error;

      setLayouts(layoutsRes.data || []);
      setAttendees(attendeesRes.data || []);
    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSeatClick = (seatNumber: string, attendee?: Attendee) => {
    setSelectedSeat(seatNumber);
    setCurrentAttendee(attendee);
    setDialogOpen(true);
  };

  const handleAssignSeat = async (attendeeId: string) => {
    if (!selectedSeat) return;

    try {
      const { error } = await supabase
        .from("attendees")
        .update({ seat_number: selectedSeat })
        .eq("id", attendeeId);

      if (error) throw error;

      toast({
        title: "좌석 배정 완료",
        description: `${selectedSeat} 좌석이 배정되었습니다.`,
      });

      await fetchData();
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUnassignSeat = async () => {
    if (!currentAttendee) return;

    try {
      const { error } = await supabase
        .from("attendees")
        .update({ seat_number: null })
        .eq("id", currentAttendee.id);

      if (error) throw error;

      toast({
        title: "좌석 배정 해제",
        description: "좌석 배정이 해제되었습니다.",
      });

      await fetchData();
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddRow = async () => {
    try {
      const lastRow = layouts[layouts.length - 1];
      const nextChar = String.fromCharCode(lastRow.row_label.charCodeAt(0) + 1);

      if (nextChar > "Z") {
        toast({
          title: "오류",
          description: "더 이상 행을 추가할 수 없습니다.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("seat_layout").insert({
        row_label: nextChar,
        display_order: lastRow.display_order + 1,
        session_id: currentSession.id,
      });

      if (error) throw error;

      toast({
        title: "행 추가 완료",
        description: `${nextChar}행이 추가되었습니다.`,
      });

      await fetchData();
    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteRow = async () => {
    const lastRow = layouts[layouts.length - 1];

    if (lastRow.row_label <= "L") {
      toast({
        title: "삭제 불가",
        description: "기본 행(A~L)은 삭제할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    const assignedSeatsInRow = attendees.filter((a) =>
      a.seat_number?.startsWith(`${lastRow.row_label}-`)
    );

    if (assignedSeatsInRow.length > 0) {
      setRowToDelete(lastRow);
      setDeleteDialogOpen(true);
    } else {
      await deleteRow(lastRow);
    }
  };

  const deleteRow = async (row: SeatLayout) => {
    try {
      const { error: unassignError } = await supabase
        .from("attendees")
        .update({ seat_number: null })
        .like("seat_number", `${row.row_label}-%`);

      if (unassignError) throw unassignError;

      const { error: deleteError } = await supabase
        .from("seat_layout")
        .update({ is_active: false })
        .eq("id", row.id);

      if (deleteError) throw deleteError;

      toast({
        title: "행 삭제 완료",
        description: `${row.row_label}행이 삭제되었습니다.`,
      });

      await fetchData();
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const unassignedAttendees = attendees.filter((a) => !a.seat_number);
  const assignedCount = attendees.filter((a) => a.seat_number).length;
  const totalSeats = layouts.length * 20;

  if (loading) {
    return <div className="flex justify-center p-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex gap-4">
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-sm text-muted-foreground">좌석 사용률</div>
          <div className="text-2xl font-bold">
            {assignedCount}/{totalSeats}
          </div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-sm text-muted-foreground">미배정 참석자</div>
          <div className="text-2xl font-bold">{unassignedAttendees.length}</div>
        </div>
      </div>

      {/* Seat Layout */}
      <div className="bg-card p-6 rounded-lg border overflow-x-auto">
        <div className="min-w-max">
          {layouts.map((layout) => (
            <SeatRow
              key={layout.id}
              rowLabel={layout.row_label}
              attendees={attendees}
              onSeatClick={handleSeatClick}
            />
          ))}
        </div>

        {/* Add/Delete Row Buttons */}
        <div className="flex justify-center gap-2 mt-4">
          <Button onClick={handleAddRow} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            행 추가
          </Button>
          <Button
            onClick={handleDeleteRow}
            variant="outline"
            size="sm"
            disabled={layouts.length <= 12 || layouts[layouts.length - 1]?.row_label <= "L"}
          >
            <Minus className="w-4 h-4 mr-2" />
            행 삭제
          </Button>
        </div>
      </div>

      {/* Assignment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentAttendee ? "좌석 배정 해제" : "좌석 배정"}
            </DialogTitle>
          </DialogHeader>

          {currentAttendee ? (
            <div className="space-y-4">
              <p>
                <strong>{currentAttendee.name}</strong>님의 좌석 배정을 해제하시겠습니까?
              </p>
              <div className="flex gap-2">
                <Button onClick={handleUnassignSeat} variant="destructive" className="flex-1">
                  배정 해제
                </Button>
                <Button onClick={() => setDialogOpen(false)} variant="outline" className="flex-1">
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong>{selectedSeat}</strong> 좌석에 배정할 참석자를 선택하세요.
              </p>
              <Select onValueChange={handleAssignSeat}>
                <SelectTrigger>
                  <SelectValue placeholder="참석자 선택" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedAttendees.map((attendee) => (
                    <SelectItem key={attendee.id} value={attendee.id}>
                      {attendee.name} ({attendee.phone}) - {attendee.attendee_count}명
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>행 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              {rowToDelete && (
                <>
                  <strong>{rowToDelete.row_label}행</strong>을 삭제하시겠습니까?
                  {attendees.some((a) =>
                    a.seat_number?.startsWith(`${rowToDelete.row_label}-`)
                  ) && (
                    <>
                      <br />
                      <span className="text-destructive">
                        이 행에 배정된 좌석이 모두 해제됩니다.
                      </span>
                    </>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rowToDelete && deleteRow(rowToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
