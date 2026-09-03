import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { requireOwner } from '@/lib/auth/require-admin';
import {
  getExpenseFinancialSummary,
  getMonthlyExpenseTotals,
  listExpenses,
  type ExpenseCategory,
} from '@/services/expense.service';
import { ExpenseDonutChart, ExpenseMonthlyBarChart } from '@/components/admin/expense-charts';
import { cancelExpenseAction, createExpenseAction } from './actions';

const CATEGORIES: ExpenseCategory[] = ['EQUIPMENT', 'MATERIAL', 'ACCESSORIES', 'UTILITIES', 'LOGISTICS', 'MARKETING', 'OTHER'];

function formatVnd(value: number) {
  return `${value.toLocaleString('vi-VN')}đ`;
}

// OWNER-only page (Q4, phase-12.md decision #4) — requireOwner() enforces this even if a STAFF
// account navigates here directly by URL; there is no partial/masked view for STAFF.
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  await requireOwner();
  const params = await searchParams;
  const category = (params.category || undefined) as ExpenseCategory | undefined;
  const [summary, monthly, { items: expenses }] = await Promise.all([
    getExpenseFinancialSummary(),
    getMonthlyExpenseTotals(),
    listExpenses({ category, limit: 100 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Chi tiêu &amp; Dòng tiền xưởng</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Tổng chi tích lũy</p><p className="text-xl font-semibold">{formatVnd(summary.totalExpenses)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Chi tiêu tháng này</p><p className="text-xl font-semibold">{formatVnd(summary.expensesThisMonth)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Doanh thu đơn hàng</p><p className="text-xl font-semibold">{formatVnd(summary.totalRevenue)}</p></CardContent></Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Dòng tiền ròng</p>
            <p className={`text-xl font-semibold ${summary.netCashFlow < 0 ? 'text-destructive' : ''}`}>{formatVnd(summary.netCashFlow)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Phân bổ chi phí theo nhóm</CardTitle></CardHeader>
          <CardContent><ExpenseDonutChart data={summary.byCategory} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Chi tiêu theo tháng (12 tháng gần nhất)</CardTitle></CardHeader>
          <CardContent><ExpenseMonthlyBarChart data={monthly} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Thêm khoản chi mới</CardTitle></CardHeader>
        <CardContent>
          <form action={createExpenseAction} className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expenseCode">Mã phiếu</Label>
              <Input id="expenseCode" name="expenseCode" placeholder="EXP-20260901-001" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Khoản chi</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Danh mục</Label>
              <select id="category" name="category" required className="h-9 cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Số tiền (VND)</Label>
              <Input id="amount" name="amount" type="number" min={0} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity">Số lượng</Label>
              <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payerName">Người chi</Label>
              <Input id="payerName" name="payerName" placeholder="Sa" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="spentAt">Ngày chi</Label>
              <Input id="spentAt" name="spentAt" type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Trạng thái</Label>
              <select id="status" name="status" defaultValue="PAID" className="h-9 cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="PAID">PAID</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="note">Ghi chú</Label>
              <Textarea id="note" name="note" />
            </div>
            <div className="col-span-2">
              <Button type="submit" className="cursor-pointer">Thêm khoản chi</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Danh sách chi tiêu ({expenses.length})</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form method="get" className="flex items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filterCategory">Lọc theo danh mục</Label>
              <select id="filterCategory" name="category" defaultValue={category ?? ''} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="">Tất cả</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Button type="submit" size="sm" variant="outline" className="cursor-pointer">Lọc</Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày chi</TableHead>
                <TableHead>Mã phiếu</TableHead>
                <TableHead>Khoản chi</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead className="text-right">Số lượng</TableHead>
                <TableHead className="text-right">Số tiền</TableHead>
                <TableHead>Người chi</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{new Date(expense.spentAt).toLocaleDateString('vi-VN')}</TableCell>
                  <TableCell className="font-medium">{expense.expenseCode}</TableCell>
                  <TableCell>{expense.title}</TableCell>
                  <TableCell><Badge variant="secondary">{expense.category}</Badge></TableCell>
                  <TableCell className="text-right">{expense.quantity}</TableCell>
                  <TableCell className="text-right">{formatVnd(expense.amount)}</TableCell>
                  <TableCell>{expense.payerName ?? '—'}</TableCell>
                  <TableCell><Badge variant={expense.status === 'CANCELLED' ? 'destructive' : 'outline'}>{expense.status}</Badge></TableCell>
                  <TableCell className="max-w-40 truncate text-xs text-muted-foreground">{expense.note ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/expenses/${expense.id}`} className="text-sm text-muted-foreground hover:underline">Sửa</Link>
                      {expense.status !== 'CANCELLED' ? (
                        <form action={cancelExpenseAction.bind(null, expense.id)}>
                          <Button type="submit" size="sm" variant="ghost" className="cursor-pointer text-destructive">Hủy</Button>
                        </form>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!expenses.length ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Chưa có khoản chi nào</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
