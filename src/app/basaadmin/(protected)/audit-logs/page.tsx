import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireOwner } from '@/lib/auth/require-admin';
import { listAuditLogs } from '@/services/audit.service';

// OWNER-only page (ADR-0011 boundary #4 — staff shouldn't see each other's audit trail).
export default async function AuditLogsPage() {
  await requireOwner();
  const { items } = await listAuditLogs({ limit: 100 });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Nhật ký hệ thống</h1>
      <Card>
        <CardHeader><CardTitle>{items.length} bản ghi gần nhất</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Hành động</TableHead>
                <TableHead>Đối tượng</TableHead>
                <TableHead>Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((log: { id: string; action: string; entityType: string; entityId: string | null; actorId: string | null; createdAt: string }) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.createdAt).toLocaleString('vi-VN')}</TableCell>
                  <TableCell><Badge variant="secondary">{log.action}</Badge></TableCell>
                  <TableCell>{log.entityType}{log.entityId ? ` (${log.entityId.slice(0, 8)}…)` : ''}</TableCell>
                  <TableCell>{log.actorId ? `${log.actorId.slice(0, 8)}…` : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
