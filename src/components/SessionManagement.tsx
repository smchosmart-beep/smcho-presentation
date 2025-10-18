import { Session } from "@/types/session";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Trash2, Power } from "lucide-react";

interface SessionManagementProps {
  sessions: Session[];
  onActivate: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

export const SessionManagement = ({ sessions, onActivate, onDelete }: SessionManagementProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>연도</TableHead>
          <TableHead>회차</TableHead>
          <TableHead>이름</TableHead>
          <TableHead>설명회 날짜</TableHead>
          <TableHead>최대 동반 인원</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>작업</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              등록된 회차가 없습니다
            </TableCell>
          </TableRow>
        ) : (
          sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell>{session.year}년</TableCell>
              <TableCell>{session.session_number}회차</TableCell>
              <TableCell>{session.name}</TableCell>
              <TableCell>
                {session.event_date
                  ? new Date(session.event_date).toLocaleDateString("ko-KR")
                  : "-"}
              </TableCell>
              <TableCell>{session.max_attendee_count}명</TableCell>
              <TableCell>
                {session.is_active ? (
                  <Badge variant="default">활성</Badge>
                ) : (
                  <Badge variant="secondary">비활성</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {!session.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onActivate(session.id)}
                    >
                      <Power className="w-4 h-4 mr-1" />
                      활성화
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(session.id)}
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
  );
};
