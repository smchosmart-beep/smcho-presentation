import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { School, MapPin, Users } from "lucide-react";
import { z } from "zod";
import { SeatLayoutViewer } from "@/components/SeatLayoutViewer";
import type { Session } from "@/types/session";

const registrationSchema = z.object({
  phone: z.string().min(10, "올바른 전화번호를 입력해주세요").max(11, "올바른 전화번호를 입력해주세요"),
  name: z.string().min(2, "이름은 최소 2자 이상이어야 합니다").max(50, "이름은 최대 50자까지 입력 가능합니다"),
  attendee_count: z.number().min(1, "참석 인원은 최소 1명 이상이어야 합니다"),
});

const Index = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [attendeeCount, setAttendeeCount] = useState("");
  const [maxAttendeeCount, setMaxAttendeeCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [seatInfo, setSeatInfo] = useState<{
    name: string;
    phone: string;
    attendee_count: number;
    seat_number: string | null;
  } | null>(null);

  const renderSeatNumbers = (seatNumberString: string) => {
    const seats = seatNumberString.split(', ');
    const pairs: string[][] = [];
    
    for (let i = 0; i < seats.length; i += 2) {
      pairs.push(seats.slice(i, i + 2));
    }
    
    return (
      <div className="space-y-2 mb-4">
        {pairs.map((pair, idx) => (
          <div key={idx} className="flex gap-3 justify-center">
            {pair.map((seat) => (
              <span
                key={seat}
                className="text-xl sm:text-2xl md:text-3xl font-bold text-gradient-primary px-3 py-2 border-2 border-primary/30 rounded-lg bg-primary/5"
              >
                [{seat}]
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    const fetchActiveSession = async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (!error && data) {
        setActiveSession(data);
        setMaxAttendeeCount(data.max_attendee_count);
      }
    };

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("max_attendee_count")
        .single();

      if (!error && data) {
        setMaxAttendeeCount(data.max_attendee_count);
      }
    };

    fetchActiveSession();
    fetchSettings();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activeSession) {
      toast.error("현재 진행 중인 입학설명회가 없습니다");
      return;
    }

    try {
      const count = attendeeCount === "" ? 0 : parseInt(attendeeCount, 10);
      const validated = registrationSchema.parse({ phone, name, attendee_count: count });
      
      if (validated.attendee_count > maxAttendeeCount) {
        toast.error(`참석 인원은 최대 ${maxAttendeeCount}명까지 가능합니다`);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase.functions.invoke('assign-seat', {
        body: {
          phone: validated.phone,
          name: validated.name,
          attendee_count: validated.attendee_count,
          session_id: activeSession.id,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
      }

      // Check if seat is already assigned
      if (data?.already_assigned && data?.data) {
        setSeatInfo(data.data);
        toast.info("이미 배정된 좌석입니다");
        return;
      }

      // Check for other error messages
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (!data?.success || !data?.data) {
        toast.error("좌석 배정 중 오류가 발생했습니다");
        return;
      }

      if (data.success && data.data) {
        setSeatInfo(data.data);
        toast.success("좌석이 배정되었습니다!");
        setPhone("");
        setName("");
        setAttendeeCount("");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('Registration error:', error);
        toast.error("좌석 등록 중 오류가 발생했습니다");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container max-w-md mx-auto px-3 py-6">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-3">
            <School className="w-10 h-10 text-primary" />
            <h1 className="text-3xl font-bold text-gradient-primary">
              상명초등학교
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">입학설명회 좌석 안내</p>
          {activeSession && (
            <p className="text-sm text-muted-foreground mt-2">
              {activeSession.session_number}회차
              {activeSession.event_date && ` (${new Date(activeSession.event_date).toLocaleDateString("ko-KR")}`}
              {activeSession.event_time && `. ${activeSession.event_time.substring(0, 5)}~`}
              {activeSession.event_date && ')'}
            </p>
          )}
        </div>

        <div className="space-y-6">
          {/* Registration Form */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                좌석 신청하기
              </CardTitle>
              <CardDescription>
                이름과 전화번호, 참석 인원을 입력하여 좌석을 신청하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">전화번호</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className="text-base h-12"
                    placeholder="01012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                    maxLength={11}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">이름</Label>
                  <Input
                    id="name"
                    type="text"
                    inputMode="text"
                    autoComplete="name"
                    className="text-base h-12"
                    placeholder="홍길동"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={50}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attendee_count">참석 인원</Label>
                  <Input
                    id="attendee_count"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="text-base h-12"
                    placeholder={`1~${maxAttendeeCount}명`}
                    value={attendeeCount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, "");
                      setAttendeeCount(value);
                    }}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    최대 {maxAttendeeCount}명까지 신청 가능합니다
                  </p>
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base btn-primary"
                  disabled={loading}
                >
                  {loading ? "신청 중..." : "좌석 신청하기"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Seat Info Display */}
          {seatInfo && (
            <>
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-accent" />
                    좌석 정보
                  </CardTitle>
                  <CardDescription>
                    배정된 좌석을 확인하세요
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 animate-fade-in">
                    <div className="text-center p-6 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg border-2 border-primary/20">
                      <p className="text-sm text-muted-foreground mb-2">배정된 좌석</p>
                      {renderSeatNumbers(seatInfo.seat_number)}
                      <div className="space-y-1 text-base">
                        <p className="text-foreground">
                          <span className="font-semibold">이름:</span> {seatInfo.name}
                        </p>
                        <p className="text-foreground">
                          <span className="font-semibold">참석 인원:</span> {seatInfo.attendee_count}명
                        </p>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 text-sm text-center">
                      <p className="text-muted-foreground">
                        입학설명회장에서 해당 좌석으로 이동해주세요
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-center">좌석 배치도</CardTitle>
                  <CardDescription className="text-center">
                    내 좌석 위치를 확인하세요
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SeatLayoutViewer 
                    highlightSeats={seatInfo.seat_number.split(', ')} 
                    viewMode="user"
                    sessionId={activeSession?.id}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Info Section */}
        <Card className="mt-6 card-elevated">
          <CardHeader>
            <CardTitle>안내사항</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• 사전 신청자 명단에 등록된 분만 좌석 배정이 가능합니다</p>
            <p>• 전화번호와 이름이 일치해야 합니다</p>
            <p>• 좌석은 신청 순서대로 A1부터 자동 배정됩니다</p>
            <p>• 2명 이상 참석 시 같은 행에 연속으로 배정됩니다</p>
            <p>• 설명회 시작 10분 전까지 입장을 완료해주시기 바랍니다</p>
          </CardContent>
        </Card>

        {/* Admin Login */}
        <div className="text-center mt-8">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/admin/login")}
            className="text-xs text-muted-foreground hover:text-primary"
          >
            관리자 로그인
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
