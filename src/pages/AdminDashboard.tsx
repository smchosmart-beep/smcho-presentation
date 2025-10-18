import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { School, LogOut, UserPlus, Edit, Trash2, Upload, AlertCircle, CheckCircle } from "lucide-react";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import type { Session } from "@supabase/supabase-js";
import { SeatLayoutEditor } from "@/components/SeatLayoutEditor";

const attendeeSchema = z.object({
  name: z.string().min(2, "이름은 최소 2자 이상이어야 합니다").max(50),
  phone: z.string().min(10).max(11),
});

type Attendee = {
  id: string;
  name: string;
  phone: string;
  attendee_count: number;
  seat_number: string | null;
  created_at: string;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
  const [maxAttendeeCount, setMaxAttendeeCount] = useState(5);
  const [loadingSettings, setLoadingSettings] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });

  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkData, setBulkData] = useState({
    names: "",
    phones: ""
  });
  const [bulkProgress, setBulkProgress] = useState({
    current: 0,
    total: 0,
    isProcessing: false
  });

  useEffect(() => {
    checkAuth();
    fetchAttendees();
    fetchSettings();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        navigate("/admin/login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/admin/login");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      toast.error("관리자 권한이 없습니다");
      await supabase.auth.signOut();
      navigate("/admin/login");
      return;
    }

    setSession(session);
    setLoading(false);
  };

  const fetchAttendees = async () => {
    const { data, error } = await supabase
      .from("attendees")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("참석자 목록을 불러오는데 실패했습니다");
      return;
    }

    setAttendees(data || []);
  };

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("settings")
      .select("max_attendee_count")
      .single();

    if (error) {
      console.error("Failed to fetch settings:", error);
      return;
    }

    if (data) {
      setMaxAttendeeCount(data.max_attendee_count);
    }
  };

  const updateMaxAttendeeCount = async (newMax: number) => {
    if (newMax < 1 || newMax > 10) {
      toast.error("참석 인원은 1명에서 10명 사이여야 합니다");
      return;
    }

    setLoadingSettings(true);
    const { error } = await supabase
      .from("settings")
      .update({ max_attendee_count: newMax })
      .eq("id", (await supabase.from("settings").select("id").single()).data?.id);

    setLoadingSettings(false);

    if (error) {
      toast.error("설정 업데이트에 실패했습니다");
      console.error("Settings update error:", error);
      return;
    }

    setMaxAttendeeCount(newMax);
    toast.success("최대 참석 인원이 업데이트되었습니다");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("로그아웃되었습니다");
    navigate("/admin/login");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = attendeeSchema.parse(formData);

      if (editingAttendee) {
        const { error } = await supabase
          .from("attendees")
          .update({
            name: validated.name,
            phone: validated.phone,
          })
          .eq("id", editingAttendee.id);

        if (error) throw error;
        toast.success("참석자 정보가 수정되었습니다");
      } else {
        const { error } = await supabase
          .from("attendees")
          .insert({
            name: validated.name,
            phone: validated.phone,
            attendee_count: 1,
            seat_number: null,
          });

        if (error) throw error;
        toast.success("참석자가 등록되었습니다");
      }

      setIsDialogOpen(false);
      setEditingAttendee(null);
      setFormData({ name: "", phone: "" });
      fetchAttendees();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("등록 중 오류가 발생했습니다");
      }
    }
  };

  const handleEdit = (attendee: Attendee) => {
    setEditingAttendee(attendee);
    setFormData({
      name: attendee.name,
      phone: attendee.phone,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    const { error } = await supabase
      .from("attendees")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("삭제 중 오류가 발생했습니다");
      return;
    }

    toast.success("삭제되었습니다");
    fetchAttendees();
  };

  const countLines = (text: string) => {
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .length;
  };

  const parseBulkData = (names: string, phones: string) => {
    const nameList = names.split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0);
    
    const phoneList = phones.split('\n')
      .map(p => p.replace(/[^0-9]/g, ''))
      .filter(p => p.length >= 10);
    
    if (nameList.length !== phoneList.length) {
      throw new Error(
        `이름(${nameList.length}개)과 전화번호(${phoneList.length}개)의 개수가 일치하지 않습니다`
      );
    }
    
    if (nameList.length === 0) {
      throw new Error('최소 1명 이상의 데이터를 입력해주세요');
    }
    
    const validated = nameList.map((name, index) => {
      try {
        return attendeeSchema.parse({
          name: name,
          phone: phoneList[index]
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new Error(
            `${index + 1}번째 항목 오류: ${error.errors[0].message}\n이름: ${name}, 전화번호: ${phoneList[index]}`
          );
        }
        throw error;
      }
    });
    
    return validated;
  };

  const BATCH_SIZE = 50;

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setBulkProgress({ current: 0, total: 0, isProcessing: true });
      
      const validated = parseBulkData(bulkData.names, bulkData.phones);
      const total = validated.length;
      
      setBulkProgress({ current: 0, total, isProcessing: true });
      
      const batches = [];
      for (let i = 0; i < validated.length; i += BATCH_SIZE) {
        batches.push(validated.slice(i, i + BATCH_SIZE));
      }
      
      let successCount = 0;
      let failedItems: Array<{ name: string; phone: string; error: string }> = [];
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const insertData = batch.map(item => ({
          name: item.name,
          phone: item.phone,
          attendee_count: 1,
          seat_number: null
        }));
        
        const { data, error } = await supabase
          .from("attendees")
          .insert(insertData)
          .select();
        
        if (error) {
          console.error(`Batch ${i + 1} error:`, error);
          
          if (error.code === '23505') {
            for (const item of insertData) {
              const { error: individualError } = await supabase
                .from("attendees")
                .insert(item)
                .select();
              
              if (individualError) {
                failedItems.push({
                  name: item.name,
                  phone: item.phone,
                  error: individualError.message
                });
              } else {
                successCount++;
              }
            }
          } else {
            batch.forEach(item => {
              failedItems.push({
                name: item.name,
                phone: item.phone,
                error: error.message
              });
            });
          }
        } else {
          successCount += batch.length;
        }
        
        setBulkProgress({ 
          current: Math.min((i + 1) * BATCH_SIZE, total), 
          total, 
          isProcessing: true 
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setBulkProgress({ current: 0, total: 0, isProcessing: false });
      
      if (successCount === total) {
        toast.success(`✅ ${total}명의 참석자가 모두 등록되었습니다`);
      } else if (successCount > 0) {
        toast.warning(
          `⚠️ ${successCount}명 등록 완료, ${failedItems.length}명 실패`,
          {
            description: failedItems.length <= 5 
              ? failedItems.map(f => `${f.name} (${f.phone})`).slice(0, 3).join(', ')
              : `${failedItems.slice(0, 3).map(f => f.name).join(', ')} 외 ${failedItems.length - 3}명`,
            duration: 10000
          }
        );
      } else {
        toast.error(`❌ 등록 실패: ${failedItems[0]?.error || '알 수 없는 오류'}`);
      }
      
      if (successCount > 0) {
        setIsBulkDialogOpen(false);
        setBulkData({ names: "", phones: "" });
        fetchAttendees();
      }
      
    } catch (error) {
      setBulkProgress({ current: 0, total: 0, isProcessing: false });
      
      if (error instanceof Error) {
        toast.error(error.message, { duration: 8000 });
      } else {
        toast.error("일괄 등록 중 오류가 발생했습니다");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <School className="w-10 h-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-gradient-primary">
                관리자 대시보드
              </h1>
              <p className="text-sm text-muted-foreground">
                입학설명회 참석자 관리
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="card-elevated">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">총 참석자</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-gradient-primary">
                {attendees.length}
              </p>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">좌석 배정 완료</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-gradient-warm">
                {attendees.filter((a) => a.seat_number).length}
              </p>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">총 참석 인원</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-secondary">
                {attendees.reduce((sum, a) => sum + a.attendee_count, 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Attendees List, Seat Layout & Settings */}
        <Tabs defaultValue="attendees" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 mb-6">
            <TabsTrigger value="attendees">참석자 목록</TabsTrigger>
            <TabsTrigger value="seats">좌석 배치</TabsTrigger>
            <TabsTrigger value="settings">설정</TabsTrigger>
          </TabsList>

          <TabsContent value="attendees">
            <Card className="card-elevated">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>참석자 목록</CardTitle>
                    <CardDescription>
                      사전 신청자 명단을 관리하세요. 참석자는 당일 현장에서 전화번호와 이름으로 좌석을 배정받습니다.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (!open) {
                        setEditingAttendee(null);
                        setFormData({ name: "", phone: "" });
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button className="btn-primary gap-2">
                          <UserPlus className="w-4 h-4" />
                          참석자 추가
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            {editingAttendee ? "참석자 수정" : "참석자 추가"}
                          </DialogTitle>
                          <DialogDescription>
                            참석자의 이름과 전화번호를 입력하세요. 참석 인원과 좌석은 자동으로 배정됩니다.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">이름</Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) =>
                                setFormData({ ...formData, name: e.target.value })
                              }
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone">전화번호</Label>
                            <Input
                              id="phone"
                              type="tel"
                              value={formData.phone}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  phone: e.target.value.replace(/[^0-9]/g, ""),
                                })
                              }
                              maxLength={11}
                              required
                            />
                          </div>
                          <Button type="submit" className="w-full btn-primary">
                            {editingAttendee ? "수정" : "등록"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <Upload className="w-4 h-4" />
                          일괄 추가
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>참석자 일괄 추가</DialogTitle>
                          <DialogDescription>
                            엑셀 파일에서 이름과 전화번호 열을 복사하여 붙여넣으세요
                          </DialogDescription>
                        </DialogHeader>
                        
                        <form onSubmit={handleBulkSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="bulk-names">이름 목록</Label>
                            <Textarea
                              id="bulk-names"
                              rows={10}
                              className="font-mono text-sm"
                              placeholder="엑셀에서 이름 열을 복사하여 붙여넣으세요&#10;예시:&#10;홍길동&#10;김철수&#10;이영희"
                              value={bulkData.names}
                              onChange={(e) => setBulkData(prev => ({ ...prev, names: e.target.value }))}
                              disabled={bulkProgress.isProcessing}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="bulk-phones">전화번호 목록</Label>
                            <Textarea
                              id="bulk-phones"
                              rows={10}
                              className="font-mono text-sm"
                              placeholder="엑셀에서 전화번호 열을 복사하여 붙여넣으세요&#10;예시:&#10;01012345678&#10;01087654321&#10;01011112222"
                              value={bulkData.phones}
                              onChange={(e) => setBulkData(prev => ({ ...prev, phones: e.target.value }))}
                              disabled={bulkProgress.isProcessing}
                            />
                          </div>
                          
                          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                            {(() => {
                              const nameCount = countLines(bulkData.names);
                              const phoneCount = countLines(bulkData.phones);
                              const isMatched = nameCount === phoneCount && nameCount > 0;
                              
                              if (nameCount === 0 && phoneCount === 0) {
                                return (
                                  <>
                                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                      데이터를 입력해주세요
                                    </span>
                                  </>
                                );
                              }
                              
                              if (!isMatched) {
                                return (
                                  <>
                                    <AlertCircle className="w-4 h-4 text-destructive" />
                                    <span className="text-sm text-destructive">
                                      개수가 일치하지 않습니다 (이름 {nameCount}명, 전화번호 {phoneCount}명)
                                    </span>
                                  </>
                                );
                              }
                              
                              return (
                                <>
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <span className="text-sm">
                                    📊 총 {nameCount}명의 참석자를 등록할 준비가 되었습니다
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                          
                          {bulkProgress.isProcessing && (
                            <div className="space-y-2">
                              <Progress 
                                value={(bulkProgress.current / bulkProgress.total) * 100} 
                              />
                              <p className="text-sm text-center text-muted-foreground">
                                {bulkProgress.current} / {bulkProgress.total} 처리 중...
                              </p>
                            </div>
                          )}
                          
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setIsBulkDialogOpen(false);
                                setBulkData({ names: "", phones: "" });
                              }}
                              disabled={bulkProgress.isProcessing}
                            >
                              취소
                            </Button>
                            <Button
                              type="submit"
                              disabled={
                                !(countLines(bulkData.names) === countLines(bulkData.phones) && countLines(bulkData.names) > 0) || 
                                bulkProgress.isProcessing
                              }
                            >
                              {bulkProgress.isProcessing 
                                ? '등록 중...' 
                                : `${countLines(bulkData.names)}명 일괄 등록`
                              }
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>전화번호</TableHead>
                    <TableHead>참석 인원</TableHead>
                    <TableHead>좌석 번호</TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        등록된 참석자가 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendees.map((attendee) => (
                      <TableRow key={attendee.id}>
                        <TableCell className="font-medium">{attendee.name}</TableCell>
                        <TableCell>{attendee.phone}</TableCell>
                        <TableCell>{attendee.attendee_count}명</TableCell>
                        <TableCell>
                          {attendee.seat_number ? (
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded-md font-semibold">
                              {attendee.seat_number}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">미배정</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(attendee)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(attendee.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seats">
            <SeatLayoutEditor />
          </TabsContent>

          <TabsContent value="settings">
            <Card className="card-elevated max-w-2xl">
              <CardHeader>
                <CardTitle>참석 인원 설정</CardTitle>
                <CardDescription>
                  참석자가 신청할 수 있는 최대 인원을 설정하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="max-attendee">최대 참석 인원</Label>
                  <div className="flex gap-2">
                    <Input
                      id="max-attendee"
                      type="number"
                      min="1"
                      max="10"
                      value={maxAttendeeCount}
                      onChange={(e) => setMaxAttendeeCount(Number(e.target.value))}
                      className="max-w-xs"
                    />
                    <Button
                      onClick={() => updateMaxAttendeeCount(maxAttendeeCount)}
                      disabled={loadingSettings}
                      className="btn-primary"
                    >
                      {loadingSettings ? "저장 중..." : "저장"}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    현재 설정: 최대 {maxAttendeeCount}명까지 신청 가능
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
