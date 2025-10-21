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
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import type { Session } from "@supabase/supabase-js";
import { SeatLayoutEditor } from "@/components/SeatLayoutEditor";
import { SessionManagement } from "@/components/SessionManagement";
import type { Session as AppSession } from "@/types/session";
import type { TourGroupSummary } from "@/types/tourGroup";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";

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
  is_onsite_registration: boolean;
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

  // Session management states
  const [sessions, setSessions] = useState<AppSession[]>([]);
  const [currentSession, setCurrentSession] = useState<AppSession | null>(null);
  const [layouts, setLayouts] = useState<any[]>([]);
  const [isNewSessionDialogOpen, setIsNewSessionDialogOpen] = useState(false);
  const [isEditSessionDialogOpen, setIsEditSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AppSession | null>(null);
  const [newSessionForm, setNewSessionForm] = useState({
    year: 2025,
    session_number: 1,
    max_attendee_count: 5,
    event_date: "",
    event_time: ""
  });
  const [editSessionForm, setEditSessionForm] = useState({
    year: 2025,
    session_number: 1,
    max_attendee_count: 5,
    event_date: "",
    event_time: ""
  });

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

  // Tour group states
  const [tourGroupSummaries, setTourGroupSummaries] = useState<TourGroupSummary[]>([]);

  useEffect(() => {
    checkAuth();
    fetchSessions();
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

  useEffect(() => {
    if (currentSession) {
      fetchAttendees();
      fetchLayouts();
      fetchTourGroups();
    }
  }, [currentSession]);

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

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("year", { ascending: false })
      .order("session_number", { ascending: false });

    if (error) {
      toast.error("회차 목록을 불러올 수 없습니다");
      return;
    }

    setSessions(data || []);
    const activeSession = data?.find(s => s.is_active);
    if (activeSession) {
      setCurrentSession(activeSession);
    }
  };

  const fetchLayouts = async () => {
    if (!currentSession) return;

    const { data, error } = await supabase
      .from("seat_layout")
      .select("*")
      .eq("session_id", currentSession.id)
      .eq("is_active", true)
      .order("display_order");

    if (error) {
      console.error("Failed to fetch layouts:", error);
      return;
    }

    setLayouts(data || []);
  };

  const fetchAttendees = async () => {
    if (!currentSession) return;

    const { data, error } = await supabase
      .from("attendees")
      .select("*")
      .eq("session_id", currentSession.id)
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

  const handleCreateSession = async () => {
    try {
      // Auto-generate name from year and session number
      const autoGeneratedName = `${newSessionForm.year}년 ${newSessionForm.session_number}회차`;

      const { data: newSession, error } = await supabase
        .from("sessions")
        .insert({
          year: newSessionForm.year,
          session_number: newSessionForm.session_number,
          name: autoGeneratedName,
          max_attendee_count: newSessionForm.max_attendee_count,
          event_date: newSessionForm.event_date || null,
          event_time: newSessionForm.event_time || null,
          is_active: false
        })
        .select()
        .single();

      if (error) throw error;

      // 좌석 레이아웃 생성 로직
      let layoutsCreated = false;

      // 1. 기존 회차에서 복사 시도
      if (currentSession) {
        const { data: previousLayouts } = await supabase
          .from("seat_layout")
          .select("*")
          .eq("session_id", currentSession.id)
          .eq("is_active", true);

        if (previousLayouts && previousLayouts.length > 0) {
          const newLayouts = previousLayouts.map(layout => ({
            row_label: layout.row_label,
            seat_count: layout.seat_count,
            display_order: layout.display_order,
            session_id: newSession.id,
            is_active: true
          }));

          const { error: layoutError } = await supabase
            .from("seat_layout")
            .insert(newLayouts);

          if (!layoutError) {
            layoutsCreated = true;
          }
        }
      }

      // 2. 복사할 레이아웃이 없으면 기본 레이아웃 생성 (A~L행, 각 20석)
      if (!layoutsCreated) {
        const defaultRows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
        const defaultLayouts = defaultRows.map((label, index) => ({
          session_id: newSession.id,
          row_label: label,
          seat_count: 20,
          is_active: true,
          display_order: index + 1,
        }));

        const { error: layoutError } = await supabase
          .from("seat_layout")
          .insert(defaultLayouts);

        if (layoutError) {
          console.error('Error creating default seat layout:', layoutError);
          toast.error("좌석 레이아웃 생성 중 오류가 발생했습니다");
        }
      }

      toast.success("새 회차가 생성되었습니다");
      setIsNewSessionDialogOpen(false);
      setNewSessionForm({
        year: 2025,
        session_number: 1,
        max_attendee_count: 5,
        event_date: "",
        event_time: ""
      });
      fetchSessions();
    } catch (error: any) {
      toast.error(`오류: ${error.message}`);
    }
  };

  const handleActivateSession = async (sessionId: string) => {
    try {
      await supabase
        .from("sessions")
        .update({ is_active: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      const { error } = await supabase
        .from("sessions")
        .update({ is_active: true })
        .eq("id", sessionId);

      if (error) throw error;

      toast.success("활성 회차가 변경되었습니다");
      fetchSessions();
    } catch (error: any) {
      toast.error(`오류: ${error.message}`);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("정말 삭제하시겠습니까? 관련된 모든 데이터가 삭제됩니다.")) return;

    try {
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;

      toast.success("회차가 삭제되었습니다");
      fetchSessions();
    } catch (error: any) {
      toast.error(`오류: ${error.message}`);
    }
  };

  const handleEditSession = (session: AppSession) => {
    setEditingSession(session);
    setEditSessionForm({
      year: session.year,
      session_number: session.session_number,
      max_attendee_count: session.max_attendee_count,
      event_date: session.event_date || "",
      event_time: session.event_time || ""
    });
    setIsEditSessionDialogOpen(true);
  };

  const handleUpdateSession = async () => {
    if (!editingSession) return;

    try {
      const autoGeneratedName = `${editSessionForm.year}년 ${editSessionForm.session_number}회차`;

      const { error } = await supabase
        .from("sessions")
        .update({
          year: editSessionForm.year,
          session_number: editSessionForm.session_number,
          name: autoGeneratedName,
          max_attendee_count: editSessionForm.max_attendee_count,
          event_date: editSessionForm.event_date || null,
          event_time: editSessionForm.event_time || null
        })
        .eq("id", editingSession.id);

      if (error) throw error;

      toast.success("회차 정보가 수정되었습니다");
      setIsEditSessionDialogOpen(false);
      setEditingSession(null);
      fetchSessions();
    } catch (error: any) {
      toast.error(`오류: ${error.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentSession) {
      toast.error("회차를 먼저 선택해주세요");
      return;
    }

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
            attendee_count: 0,
            seat_number: null,
            session_id: currentSession.id,
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

  const handleDeleteAllAttendees = async () => {
    if (!currentSession) {
      toast.error("회차를 먼저 선택해주세요");
      return;
    }

    if (attendees.length === 0) {
      toast.error("삭제할 참석자가 없습니다");
      return;
    }

    const confirmed = confirm(
      `⚠️ 현재 회차(${currentSession.name})의 모든 참석자(${attendees.length}명)를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("attendees")
        .delete()
        .eq("session_id", currentSession.id);

      if (error) throw error;

      toast.success(`✅ ${attendees.length}명의 참석자가 모두 삭제되었습니다`);
      fetchAttendees();
    } catch (error: any) {
      toast.error(`삭제 실패: ${error.message}`);
    }
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
    
    if (!currentSession) {
      toast.error("회차를 먼저 선택해주세요");
      return;
    }

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
          attendee_count: 0,
          seat_number: null,
          session_id: currentSession.id,
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

  // Tour group functions
  const groupByFamily = (attendees: Attendee[]) => {
    const families = new Map<string, Attendee[]>();
    
    attendees.forEach(att => {
      const key = `${att.name}_${att.phone}`;
      if (!families.has(key)) {
        families.set(key, []);
      }
      families.get(key)!.push(att);
    });
    
    return Array.from(families.values());
  };

  const distributeTo10Groups = (families: Attendee[][]) => {
    const groups: Attendee[][] = Array.from({ length: 10 }, () => []);
    let currentGroup = 0;
    
    families.forEach(family => {
      groups[currentGroup].push(...family);
      currentGroup = (currentGroup + 1) % 10;
    });
    
    return groups;
  };

  const handleAssignTourGroups = async () => {
    if (!currentSession) {
      toast.error("회차를 먼저 선택해주세요");
      return;
    }
    
    const { data: assignedAttendees, error } = await supabase
      .from("attendees")
      .select("*")
      .eq("session_id", currentSession.id)
      .not("seat_number", "is", null)
      .order("seat_number");
    
    if (error) {
      toast.error("참석자 정보를 불러오는데 실패했습니다");
      return;
    }

    if (!assignedAttendees || assignedAttendees.length === 0) {
      toast.error("좌석이 배정된 참석자가 없습니다");
      return;
    }
    
    const familyGroups = groupByFamily(assignedAttendees);
    const tourGroups = distributeTo10Groups(familyGroups);
    
    // Delete existing tour groups for this session
    await supabase
      .from("tour_groups")
      .delete()
      .eq("session_id", currentSession.id);
    
    // Insert new tour groups
    const insertData = tourGroups.flatMap((group, index) =>
      group.map(attendee => ({
        session_id: currentSession.id,
        group_number: index + 1,
        attendee_id: attendee.id
      }))
    );
    
    const { error: insertError } = await supabase
      .from("tour_groups")
      .insert(insertData);
    
    if (insertError) {
      toast.error("조 편성 중 오류가 발생했습니다");
      console.error("Tour group assignment error:", insertError);
      return;
    }
    
    toast.success("조 편성이 완료되었습니다");
    fetchTourGroups();
  };

  const fetchTourGroups = async () => {
    if (!currentSession) return;
    
    const { data, error } = await supabase
      .from("tour_groups")
      .select(`
        group_number,
        attendees!inner (
          id,
          name,
          seat_number,
          attendee_count
        )
      `)
      .eq("session_id", currentSession.id)
      .order("group_number");
    
    if (error) {
      console.error("Failed to fetch tour groups:", error);
      return;
    }

    if (!data || data.length === 0) {
      setTourGroupSummaries([]);
      return;
    }
    
    const groupMap = new Map<number, any[]>();
    data.forEach((item: any) => {
      if (!groupMap.has(item.group_number)) {
        groupMap.set(item.group_number, []);
      }
      groupMap.get(item.group_number)!.push(item.attendees);
    });
    
    const summaries: TourGroupSummary[] = Array.from(groupMap.entries()).map(([groupNumber, attendees]) => {
      const sortedAttendees = attendees.sort((a, b) => 
        a.seat_number.localeCompare(b.seat_number)
      );
      
      return {
        groupNumber,
        startSeat: sortedAttendees[0].seat_number,
        endSeat: sortedAttendees[sortedAttendees.length - 1].seat_number,
        totalCount: attendees.reduce((sum, att) => sum + att.attendee_count, 0),
        allNames: sortedAttendees.map(att => att.name).join(', ')
      };
    });
    
    setTourGroupSummaries(summaries);
  };

  const handleClearTourGroups = async () => {
    if (!currentSession) return;
    
    if (!confirm("정말 조 편성을 초기화하시겠습니까?")) return;
    
    const { error } = await supabase
      .from("tour_groups")
      .delete()
      .eq("session_id", currentSession.id);
    
    if (error) {
      toast.error("초기화 중 오류가 발생했습니다");
      return;
    }
    
    setTourGroupSummaries([]);
    toast.success("조 편성이 초기화되었습니다");
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

            {/* Session Selector */}
            <div className="flex items-center gap-2 ml-6">
              <Select
                value={currentSession?.year.toString()}
                onValueChange={(year) => {
                  const sessionInYear = sessions.find(s => s.year === Number(year));
                  if (sessionInYear) setCurrentSession(sessionInYear);
                }}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="연도 선택" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(sessions.map(s => s.year))).map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={currentSession?.id}
                onValueChange={(id) => {
                  const selected = sessions.find(s => s.id === id);
                  if (selected) setCurrentSession(selected);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="회차 선택" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.filter(s => s.year === currentSession?.year).map(session => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.session_number}회차 {session.is_active && "(활성)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        <div className="flex gap-4 mb-8 overflow-x-auto">
          <div className="bg-card p-4 rounded-lg border text-center min-w-[140px]">
            <div className="text-sm text-muted-foreground">좌석 배치 현황</div>
            <div className="text-2xl font-bold">
              {attendees.reduce((total, attendee) => {
                if (attendee.seat_number) {
                  const seatCount = attendee.seat_number.split(',').map(s => s.trim()).filter(s => s).length;
                  return total + seatCount;
                }
                return total;
              }, 0)}/{layouts.length * 20}
            </div>
          </div>
          <div className="bg-card p-4 rounded-lg border text-center min-w-[140px]">
            <div className="text-sm text-muted-foreground">사전등록</div>
            <div className="text-2xl font-bold">
              {attendees.filter(a => !a.is_onsite_registration).length}
            </div>
          </div>
          <div className="bg-pink-50 dark:bg-pink-950/20 p-4 rounded-lg border text-center min-w-[140px]">
            <div className="text-sm text-muted-foreground">불참</div>
            <div className="text-2xl font-bold">
              {attendees.filter((a) => !a.seat_number).length}
            </div>
          </div>
          <div className="bg-sky-50 dark:bg-sky-950/20 p-4 rounded-lg border text-center min-w-[140px]">
            <div className="text-sm text-muted-foreground">참여</div>
            <div className="text-2xl font-bold">
              {attendees.filter(a => !a.is_onsite_registration && a.seat_number !== null).length}
            </div>
          </div>
          <div className="bg-card p-4 rounded-lg border text-center min-w-[140px]">
            <div className="text-sm text-muted-foreground">사전 등록자 참가율</div>
            <div className="text-2xl font-bold">
              {attendees.filter(a => !a.is_onsite_registration).length > 0 
                ? ((attendees.filter(a => !a.is_onsite_registration && a.seat_number !== null).length / attendees.filter(a => !a.is_onsite_registration).length) * 100).toFixed(1)
                : "0.0"}%
            </div>
          </div>
          <div className="bg-card p-4 rounded-lg border text-center min-w-[140px]">
            <div className="text-sm text-muted-foreground">현장등록</div>
            <div className="text-2xl font-bold">
              {attendees.filter((a) => a.is_onsite_registration).length}
            </div>
          </div>
        </div>

        {/* Tabs: Attendees List, Seat Layout, Sessions, Tour Groups & Settings */}
        <Tabs defaultValue="attendees" className="w-full">
          <TabsList className="grid w-full max-w-4xl grid-cols-5 mb-6">
            <TabsTrigger value="attendees">참석자 목록</TabsTrigger>
            <TabsTrigger value="seats">좌석 배치</TabsTrigger>
            <TabsTrigger value="sessions">회차 관리</TabsTrigger>
            <TabsTrigger value="tour">투어 조 편성</TabsTrigger>
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
                            <Label htmlFor="name">아동명</Label>
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
                            <Label htmlFor="bulk-names">아동명 목록</Label>
                            <Textarea
                              id="bulk-names"
                              rows={10}
                              className="font-mono text-sm"
                              placeholder="엑셀에서 아동명 열을 복사하여 붙여넣으세요&#10;예시:&#10;홍길동&#10;김철수&#10;이영희"
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

                    <Button
                      variant="destructive"
                      className="gap-2"
                      onClick={handleDeleteAllAttendees}
                      disabled={!currentSession || attendees.length === 0}
                    >
                      <Trash2 className="w-4 h-4" />
                      전체 삭제
                    </Button>
                  </div>
                </div>
              </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>아동명</TableHead>
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
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {attendee.name}
                            {attendee.is_onsite_registration && (
                              <Badge variant="secondary" className="text-xs">
                                현장
                              </Badge>
                            )}
                          </div>
                        </TableCell>
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
            {currentSession ? (
              <SeatLayoutEditor currentSession={currentSession} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  회차를 먼저 선택해주세요
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sessions">
            <Card className="card-elevated">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>입학설명회 회차 관리</CardTitle>
                    <CardDescription>
                      연도별 회차를 생성하고 관리합니다
                    </CardDescription>
                  </div>
                  <Button onClick={() => setIsNewSessionDialogOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    새 회차 생성
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <SessionManagement
                  sessions={sessions}
                  onActivate={handleActivateSession}
                  onDelete={handleDeleteSession}
                  onEdit={handleEditSession}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tour">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>학교 투어 조 편성</CardTitle>
                <CardDescription>
                  좌석이 배정된 참석자를 10개 조로 자동 편성합니다. 가족(동일 이름+전화번호)은 같은 조에 배정됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={handleAssignTourGroups} className="btn-primary">
                    조편성하기
                  </Button>
                  {tourGroupSummaries.length > 0 && (
                    <Button variant="outline" onClick={handleClearTourGroups}>
                      초기화
                    </Button>
                  )}
                </div>
                
                {tourGroupSummaries.length > 0 && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">편성 통계</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-2 text-sm">
                        <div>총 참석자: {tourGroupSummaries.reduce((sum, g) => sum + g.totalCount, 0)}명</div>
                        <div>조 개수: 10개</div>
                        <div>평균 인원: {Math.round(tourGroupSummaries.reduce((sum, g) => sum + g.totalCount, 0) / 10)}명/조</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">조 편성 결과</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[80px]">조</TableHead>
                                <TableHead className="w-[180px]">좌석 범위</TableHead>
                                <TableHead className="w-[80px] text-center">인원</TableHead>
                                <TableHead className="min-w-[400px]">학생명</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tourGroupSummaries.map((group) => (
                                <TableRow key={group.groupNumber}>
                                  <TableCell className="font-medium">
                                    <Badge variant="secondary">{group.groupNumber}조</Badge>
                                  </TableCell>
                                  <TableCell>
                                    {group.startSeat} ~ {group.endSeat}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {group.totalCount}명
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {group.allNames}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </CardContent>
            </Card>
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

        {/* New Session Dialog */}
        <Dialog open={isNewSessionDialogOpen} onOpenChange={setIsNewSessionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 회차 생성</DialogTitle>
              <DialogDescription>
                입학설명회의 새 회차를 추가합니다
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="year">연도</Label>
                <Input
                  id="year"
                  type="number"
                  value={newSessionForm.year}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, year: Number(e.target.value) })}
                  placeholder="2025"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="session_number">회차</Label>
                <Input
                  id="session_number"
                  type="number"
                  value={newSessionForm.session_number}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, session_number: Number(e.target.value) })}
                  placeholder="1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_attendee_count">최대 동반 인원</Label>
                <Input
                  id="max_attendee_count"
                  type="number"
                  value={newSessionForm.max_attendee_count}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, max_attendee_count: Number(e.target.value) })}
                  placeholder="5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event_date">날짜 (선택)</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={newSessionForm.event_date}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, event_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="event_time">시간 (선택)</Label>
                <Input
                  id="event_time"
                  type="time"
                  value={newSessionForm.event_time}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, event_time: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsNewSessionDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={handleCreateSession}>
                생성
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Session Dialog */}
        <Dialog open={isEditSessionDialogOpen} onOpenChange={setIsEditSessionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>회차 수정</DialogTitle>
              <DialogDescription>
                회차 정보를 수정하세요
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-year">연도</Label>
                <Input
                  id="edit-year"
                  type="number"
                  value={editSessionForm.year}
                  onChange={(e) => setEditSessionForm({
                    ...editSessionForm,
                    year: parseInt(e.target.value) || 2025
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-session-number">회차</Label>
                <Input
                  id="edit-session-number"
                  type="number"
                  value={editSessionForm.session_number}
                  onChange={(e) => setEditSessionForm({
                    ...editSessionForm,
                    session_number: parseInt(e.target.value) || 1
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-max-attendee">최대 동반 인원</Label>
                <Input
                  id="edit-max-attendee"
                  type="number"
                  value={editSessionForm.max_attendee_count}
                  onChange={(e) => setEditSessionForm({
                    ...editSessionForm,
                    max_attendee_count: parseInt(e.target.value) || 5
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-event-date">날짜 (선택사항)</Label>
                <Input
                  id="edit-event-date"
                  type="date"
                  value={editSessionForm.event_date}
                  onChange={(e) => setEditSessionForm({
                    ...editSessionForm,
                    event_date: e.target.value
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-event-time">시간 (선택사항)</Label>
                <Input
                  id="edit-event-time"
                  type="time"
                  value={editSessionForm.event_time}
                  onChange={(e) => setEditSessionForm({
                    ...editSessionForm,
                    event_time: e.target.value
                  })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsEditSessionDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={handleUpdateSession}>
                저장
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminDashboard;
