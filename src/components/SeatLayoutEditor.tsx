import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SeatRow } from "./SeatRow";
import { Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  is_onsite_registration: boolean;
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
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string>("");
  const [actualAttendeeCount, setActualAttendeeCount] = useState<number>(1);
  const [previewSeats, setPreviewSeats] = useState<string[]>([]);
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
    setSelectedAttendeeId("");
    setActualAttendeeCount(1);
    setPreviewSeats([]);
    setDialogOpen(true);
  };

  const updatePreviewSeats = (count: number) => {
    if (!selectedSeat || count < 1) {
      setPreviewSeats([]);
      return;
    }

    const assignedSeats = new Set<string>();
    attendees.forEach(a => {
      if (a.seat_number) {
        a.seat_number.split(',').map(s => s.trim()).forEach(seat => {
          assignedSeats.add(seat);
        });
      }
    });

    const [selectedRow, selectedSeatNum] = selectedSeat.split('-');
    const startSeatNumber = parseInt(selectedSeatNum, 10);
    
    const preview: string[] = [];
    let currentSeatNum = startSeatNumber;

    for (let i = 0; i < count && currentSeatNum <= 20; i++) {
      const seatId = `${selectedRow}-${String(currentSeatNum).padStart(2, '0')}`;
      
      if (assignedSeats.has(seatId)) {
        setPreviewSeats([]);
        return;
      }
      
      preview.push(seatId);
      currentSeatNum++;
    }

    setPreviewSeats(preview);
  };

  const handleAssignSeat = async (attendeeId: string, count: number) => {
    if (!selectedSeat || !attendeeId || count < 1) return;

    try {
      const selectedAttendee = attendees.find(a => a.id === attendeeId);
      if (!selectedAttendee) return;

      const requiredSeats = count;

      // 1. 현재 배정된 모든 좌석 파악
      const assignedSeats = new Set<string>();
      attendees.forEach(a => {
        if (a.seat_number) {
          a.seat_number.split(',').map(s => s.trim()).forEach(seat => {
            assignedSeats.add(seat);
          });
        }
      });

      // 2. 선택한 좌석의 행과 번호 파싱
      const [selectedRow, selectedSeatNum] = selectedSeat.split('-');
      const startSeatNumber = parseInt(selectedSeatNum, 10);

      // 3. 같은 행에서 연속된 빈 좌석 찾기
      const seatsToAssign: string[] = [];
      let currentSeatNum = startSeatNumber;

      for (let i = 0; i < requiredSeats && currentSeatNum <= 20; i++) {
        const seatId = `${selectedRow}-${String(currentSeatNum).padStart(2, '0')}`;
        
        if (assignedSeats.has(seatId)) {
          // 이미 배정된 좌석이면 실패
          toast({
            title: "좌석 배정 실패",
            description: `${seatId} 좌석이 이미 배정되어 있습니다. 연속된 빈 좌석이 부족합니다.`,
            variant: "destructive",
          });
          return;
        }
        
        seatsToAssign.push(seatId);
        currentSeatNum++;
      }

      // 4. 필요한 좌석 수를 채우지 못한 경우
      if (seatsToAssign.length < requiredSeats) {
        toast({
          title: "좌석 배정 실패",
          description: `${selectedRow}행에 연속된 빈 좌석이 부족합니다 (필요: ${requiredSeats}석, 가능: ${seatsToAssign.length}석)`,
          variant: "destructive",
        });
        return;
      }

      // 5. DB 업데이트
      const seatNumberString = seatsToAssign.join(', ');
      const { error } = await supabase
        .from("attendees")
        .update({ seat_number: seatNumberString })
        .eq("id", attendeeId);

      if (error) throw error;

      toast({
        title: "좌석 배정 완료",
        description: `${selectedAttendee.name}님 (${requiredSeats}명): ${seatNumberString}`,
      });

      await fetchData();
      setDialogOpen(false);
      setSelectedAttendeeId("");
      setActualAttendeeCount(1);
      setPreviewSeats([]);
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
  const assignedCount = attendees.reduce((total, attendee) => {
    if (attendee.seat_number) {
      const seatCount = attendee.seat_number.split(',').map(s => s.trim()).filter(s => s).length;
      return total + seatCount;
    }
    return total;
  }, 0);
  const totalSeats = layouts.length * 20;
  const onsiteCount = attendees.filter((a) => a.is_onsite_registration).length;
  
  // 사전 등록자 참가율 계산
  const preRegisteredCount = attendees.filter(a => !a.is_onsite_registration).length;
  const preRegisteredAttendedCount = attendees.filter(
    a => !a.is_onsite_registration && a.seat_number !== null
  ).length;
  const attendanceRate = preRegisteredCount > 0 
    ? ((preRegisteredAttendedCount / preRegisteredCount) * 100).toFixed(1)
    : "0.0";

  if (loading) {
    return <div className="flex justify-center p-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
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
                <strong>{selectedSeat}</strong> 좌석부터 시작하여 연속된 좌석을 배정합니다.
              </p>
              
              {/* 1단계: 참석자 선택 */}
              <div>
                <Label>참석자 선택</Label>
                <Select value={selectedAttendeeId} onValueChange={setSelectedAttendeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="참석자 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {unassignedAttendees.map((attendee) => (
                      <SelectItem key={attendee.id} value={attendee.id}>
                        {attendee.name} ({attendee.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2단계: 인원 수 입력 */}
              {selectedAttendeeId && (
                <div>
                  <Label>실제 참석 인원 수</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={actualAttendeeCount}
                    onChange={(e) => {
                      const count = parseInt(e.target.value, 10) || 1;
                      setActualAttendeeCount(count);
                      updatePreviewSeats(count);
                    }}
                    placeholder="인원 수 입력"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    등록 인원: {attendees.find(a => a.id === selectedAttendeeId)?.attendee_count}명
                  </p>
                </div>
              )}

              {/* 3단계: 미리보기 */}
              {previewSeats.length > 0 && (
                <div className="p-3 bg-muted rounded-md text-sm">
                  <p className="font-medium mb-1">배정될 좌석:</p>
                  <p className="text-muted-foreground">{previewSeats.join(', ')}</p>
                </div>
              )}

              {/* 4단계: 배정 버튼 */}
              <Button 
                onClick={() => handleAssignSeat(selectedAttendeeId, actualAttendeeCount)}
                disabled={!selectedAttendeeId || actualAttendeeCount < 1 || previewSeats.length === 0}
                className="w-full"
              >
                좌석 배정
              </Button>
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
