import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireOwner } from '@/lib/auth/require-admin';
import { listStaff } from '@/services/staff.service';
import { createStaffAction, setStaffActiveAction } from './actions';

// OWNER-only page (ADR-0011 boundary #1). requireOwner() enforces this even if someone
// navigates here directly by URL — the nav link hiding is UX only, not the security boundary.
export default async function StaffPage() {
  await requireOwner();
  const staff = await listStaff();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Nhân viên</h1>

      <Card>
        <CardHeader><CardTitle>Tạo tài khoản mới</CardTitle></CardHeader>
        <CardContent>
          <form action={createStaffAction} className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">Họ tên</Label>
              <Input id="fullName" name="fullName" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Mật khẩu tạm thời</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Vai trò</Label>
              <select id="role" name="role" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
                <option value="STAFF">STAFF</option>
                <option value="OWNER">OWNER</option>
              </select>
            </div>
            <div className="col-span-2"><Button type="submit">Tạo tài khoản</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Danh sách nhân viên ({staff.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.fullName}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell><Badge variant="secondary">{member.role}</Badge></TableCell>
                  <TableCell>{member.isActive ? <Badge>Đang hoạt động</Badge> : <Badge variant="destructive">Đã vô hiệu hoá</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <form action={setStaffActiveAction.bind(null, member.id, !member.isActive)}>
                      <Button type="submit" size="sm" variant="outline">{member.isActive ? 'Vô hiệu hoá' : 'Kích hoạt lại'}</Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
