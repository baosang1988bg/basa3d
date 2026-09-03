import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { requireOwner } from '@/lib/auth/require-admin';
import { listExpenses, type ExpenseCategory, type ExpenseStatus } from '@/services/expense.service';
import { updateExpenseAction } from '../actions';

const CATEGORIES: ExpenseCategory[] = ['EQUIPMENT', 'MATERIAL', 'ACCESSORIES', 'UTILITIES', 'LOGISTICS', 'MARKETING', 'OTHER'];
const STATUSES: ExpenseStatus[] = ['PAID', 'PENDING', 'CANCELLED'];

function toDateInputValue(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

// OWNER-only (Q4, phase-12.md decision #4) — same enforcement as /admin/expenses.
export default async function ExpenseEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOwner();
  // No getExpenseById in expense.service.ts (Slice 2 only lists/creates/updates/soft-cancels) —
  // reuse listExpenses' shared row shape rather than adding a near-duplicate single-row query.
  const { items } = await listExpenses({ limit: 500 });
  const expense = items.find((item) => item.id === id);
  if (!expense) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Sửa khoản chi {expense.expenseCode}</h1>

      <Card>
        <CardHeader><CardTitle>Thông tin khoản chi</CardTitle></CardHeader>
        <CardContent>
          <form action={updateExpenseAction.bind(null, id)} className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Khoản chi</Label>
              <Input id="title" name="title" required defaultValue={expense.title} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Danh mục</Label>
              <select id="category" name="category" required defaultValue={expense.category} className="h-9 cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Số tiền (VND)</Label>
              <Input id="amount" name="amount" type="number" min={0} required defaultValue={expense.amount} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity">Số lượng</Label>
              <Input id="quantity" name="quantity" type="number" min={1} defaultValue={expense.quantity} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payerName">Người chi</Label>
              <Input id="payerName" name="payerName" defaultValue={expense.payerName ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="spentAt">Ngày chi</Label>
              <Input id="spentAt" name="spentAt" type="date" defaultValue={toDateInputValue(expense.spentAt)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Trạng thái</Label>
              <select id="status" name="status" defaultValue={expense.status} className="h-9 cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="note">Ghi chú</Label>
              <Textarea id="note" name="note" defaultValue={expense.note ?? ''} />
            </div>
            <div className="col-span-2">
              <Button type="submit" className="cursor-pointer">Lưu thay đổi</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
