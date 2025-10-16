import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { School, MapPin, Users } from "lucide-react";
import { z } from "zod";

const seatCheckSchema = z.object({
  phone: z.string().min(10, "올바른 전화번호를 입력해주세요").max(11, "올바른 전화번호를 입력해주세요"),
  name: z.string().min(2, "이름은 최소 2자 이상이어야 합니다").max(50, "이름은 최대 50자까지 입력 가능합니다"),
});

const Index = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [seatInfo, setSeatInfo] = useState<{
    name: string;
    phone: string;
    attendee_count: number;
    seat_number: string | null;
  } | null>(null);

  const handleCheckSeat = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = seatCheckSchema.parse({ phone, name });
      setLoading(true);

      const { data, error } = await supabase
        .from("attendees")
        .select("*")
        .eq("phone", validated.phone)
        .eq("name", validated.name)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error("등록된 정보를 찾을 수 없습니다", {
          description: "전화번호와 이름을 다시 확인해주세요"
        });
        setSeatInfo(null);
        return;
      }

      if (!data.seat_number) {
        toast.info("좌석이 아직 배정되지 않았습니다", {
          description: "잠시 후 다시 확인해주세요"
        });
        setSeatInfo(null);
        return;
      }

      setSeatInfo(data);
      toast.success("좌석 정보를 확인했습니다!");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("좌석 조회 중 오류가 발생했습니다");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <School className="w-12 h-12 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold text-gradient-primary">
              상명초등학교
            </h1>
          </div>
          <p className="text-xl text-muted-foreground">입학설명회 좌석 안내</p>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/admin/login")}
            className="mt-4 text-muted-foreground hover:text-primary"
          >
            관리자 로그인
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Seat Check Form */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                좌석 확인하기
              </CardTitle>
              <CardDescription>
                예약하신 전화번호와 이름으로 좌석을 확인하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCheckSeat} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">전화번호</Label>
                  <Input
                    id="phone"
                    type="tel"
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
                    placeholder="홍길동"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={50}
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full btn-primary"
                  disabled={loading}
                >
                  {loading ? "확인 중..." : "좌석 확인"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Seat Info Display */}
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
              {seatInfo ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="text-center p-8 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg border-2 border-primary/20">
                    <p className="text-sm text-muted-foreground mb-2">귀하의 좌석 번호</p>
                    <p className="text-6xl font-bold text-gradient-primary mb-4">
                      {seatInfo.seat_number}
                    </p>
                    <div className="space-y-2 text-sm">
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
              ) : (
                <div className="h-full flex items-center justify-center text-center p-8">
                  <div>
                    <MapPin className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      좌석을 확인하려면<br />전화번호와 이름을 입력해주세요
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <Card className="mt-8 card-elevated">
          <CardHeader>
            <CardTitle>안내사항</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• 좌석은 신청 순서와 참석 인원을 고려하여 배정됩니다</p>
            <p>• 좌석 정보가 보이지 않는 경우 관리자에게 문의해주세요</p>
            <p>• 설명회 시작 10분 전까지 입장을 완료해주시기 바랍니다</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
