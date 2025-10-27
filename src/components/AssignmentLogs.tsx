import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { AlertCircle, CheckCircle, RefreshCw, XCircle, TrendingUp } from "lucide-react";
import type { Session } from "@/types/session";

type AssignmentLog = {
  id: string;
  session_id: string;
  attendee_id: string | null;
  attendee_name: string;
  attendee_phone: string;
  requested_seat_count: number;
  assigned_seats: string | null;
  event_type: 'success' | 'conflict' | 'retry' | 'error';
  error_message: string | null;
  version_attempted: number | null;
  version_final: number | null;
  processing_time_ms: number | null;
  created_at: string;
};

type AssignmentLogsProps = {
  currentSession: Session | null;
};

export function AssignmentLogs({ currentSession }: AssignmentLogsProps) {
  const [logs, setLogs] = useState<AssignmentLog[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentSession) {
      fetchLogs();
      subscribeToLogs();
    }
  }, [currentSession, filter]);

  const fetchLogs = async () => {
    if (!currentSession) return;

    setLoading(true);
    let query = supabase
      .from("seat_assignment_logs")
      .select("*")
      .eq("session_id", currentSession.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter !== "all") {
      query = query.eq("event_type", filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch logs:", error);
      setLoading(false);
      return;
    }

    setLogs((data || []) as AssignmentLog[]);
    setLoading(false);
  };

  const subscribeToLogs = () => {
    if (!currentSession) return;

    const channel = supabase
      .channel("assignment-logs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "seat_assignment_logs",
          filter: `session_id=eq.${currentSession.id}`,
        },
        (payload) => {
          const newLog = payload.new as AssignmentLog;
          setLogs((prev) => [newLog, ...prev].slice(0, 100));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case "success":
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            성공
          </Badge>
        );
      case "conflict":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            충돌
          </Badge>
        );
      case "retry":
        return (
          <Badge variant="secondary" className="gap-1">
            <RefreshCw className="h-3 w-3" />
            재시도
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="gap-1 border-red-500 text-red-500">
            <XCircle className="h-3 w-3" />
            에러
          </Badge>
        );
      default:
        return <Badge variant="outline">{eventType}</Badge>;
    }
  };

  const stats = {
    total: logs.length,
    success: logs.filter((l) => l.event_type === "success").length,
    conflict: logs.filter((l) => l.event_type === "conflict").length,
    avgProcessingTime: Math.round(
      logs.reduce((sum, l) => sum + (l.processing_time_ms || 0), 0) / logs.length || 0
    ),
  };

  if (!currentSession) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>배정 로그</CardTitle>
          <CardDescription>회차를 먼저 선택해주세요</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>전체 시도</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>성공 배정</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.success}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              충돌 발생
            </CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats.conflict}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              평균 처리시간
            </CardDescription>
            <CardTitle className="text-3xl">{stats.avgProcessingTime}ms</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>배정 로그</CardTitle>
              <CardDescription>좌석 배정 시도 및 충돌 내역</CardDescription>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="success">성공</SelectItem>
                <SelectItem value="conflict">충돌</SelectItem>
                <SelectItem value="retry">재시도</SelectItem>
                <SelectItem value="error">에러</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {filter === "all" ? "배정 로그가 없습니다" : `${filter} 로그가 없습니다`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>시간</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>전화번호</TableHead>
                    <TableHead>요청 인원</TableHead>
                    <TableHead>배정 좌석</TableHead>
                    <TableHead>버전</TableHead>
                    <TableHead>처리시간</TableHead>
                    <TableHead>메시지</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDistanceToNow(new Date(log.created_at), {
                          addSuffix: true,
                          locale: ko,
                        })}
                      </TableCell>
                      <TableCell>{getEventBadge(log.event_type)}</TableCell>
                      <TableCell className="font-medium">{log.attendee_name}</TableCell>
                      <TableCell className="text-muted-foreground">{log.attendee_phone}</TableCell>
                      <TableCell>{log.requested_seat_count}명</TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.assigned_seats || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.version_attempted !== null && log.version_final !== null ? (
                          <span className="font-mono">
                            v{log.version_attempted} → v{log.version_final}
                          </span>
                        ) : log.version_attempted !== null ? (
                          <span className="font-mono text-red-500">v{log.version_attempted} ✗</span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {log.processing_time_ms ? `${log.processing_time_ms}ms` : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                        {log.error_message || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
