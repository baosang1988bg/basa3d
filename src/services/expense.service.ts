import { query, withTransaction } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { writeAuditLog } from './audit.service';
import { pagination } from './product.service';

// 100% OWNER-only (Q4, phase-12.md decision #4): the route/Server Action calls requireOwner()
// (src/lib/auth/require-admin.ts) before calling anything here — same convention as
// pricing-config.service.ts. This service never checks role itself; it trusts an already-verified actorId.

export type ExpenseCategory = 'EQUIPMENT' | 'MATERIAL' | 'ACCESSORIES' | 'UTILITIES' | 'LOGISTICS' | 'MARKETING' | 'OTHER';
export type ExpenseStatus = 'PAID' | 'PENDING' | 'CANCELLED';

export type ExpenseRow = {
  id: string;
  expenseCode: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  quantity: number;
  status: ExpenseStatus;
  payerName: string | null;
  spentAt: Date;
  note: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ExpenseDbRow = Omit<ExpenseRow, 'amount'> & { amount: string };

const EXPENSE_SELECT = `
  select id, expense_code as "expenseCode", title, category, amount, quantity, status,
    payer_name as "payerName", spent_at as "spentAt", note, created_by as "createdBy",
    created_at as "createdAt", updated_at as "updatedAt"
  from expenses`;

function toExpenseRow(row: ExpenseDbRow): ExpenseRow {
  return { ...row, amount: Number(row.amount) };
}

export async function listExpenses(
  filters: { category?: ExpenseCategory; status?: ExpenseStatus; from?: Date; to?: Date; page?: number; limit?: number } = {},
) {
  const { page, limit, offset } = pagination(filters);
  const values: unknown[] = [];
  const clauses: string[] = [];
  if (filters.category) { values.push(filters.category); clauses.push(`category = $${values.length}`); }
  if (filters.status) { values.push(filters.status); clauses.push(`status = $${values.length}`); }
  if (filters.from) { values.push(filters.from); clauses.push(`spent_at >= $${values.length}`); }
  if (filters.to) { values.push(filters.to); clauses.push(`spent_at <= $${values.length}`); }
  const whereSql = clauses.length ? `where ${clauses.join(' and ')}` : '';
  values.push(limit, offset);
  const result = await query<ExpenseDbRow>(
    `${EXPENSE_SELECT} ${whereSql} order by spent_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return { page, limit, items: result.rows.map(toExpenseRow) };
}

export type ExpenseFinancialSummary = {
  totalExpenses: number;
  expensesThisMonth: number;
  totalRevenue: number;
  netCashFlow: number;
  byCategory: { category: ExpenseCategory; total: number }[];
};

// Net Operating Cash Flow = total order revenue (excluding CANCELLED orders) - total non-CANCELLED expenses.
export async function getExpenseFinancialSummary(): Promise<ExpenseFinancialSummary> {
  const [totals, monthTotal, revenue, byCategory] = await Promise.all([
    query<{ sum: string | null }>(`select sum(amount) from expenses where status != 'CANCELLED'`),
    query<{ sum: string | null }>(`select sum(amount) from expenses where status != 'CANCELLED' and date_trunc('month', spent_at) = date_trunc('month', timezone('utc', now()))`),
    query<{ sum: string | null }>(`select sum(total) from orders where status != 'CANCELLED'`),
    query<{ category: ExpenseCategory; sum: string | null }>(`select category, sum(amount) from expenses where status != 'CANCELLED' group by category`),
  ]);
  const totalExpenses = Number(totals.rows[0].sum ?? 0);
  const totalRevenue = Number(revenue.rows[0].sum ?? 0);
  return {
    totalExpenses,
    expensesThisMonth: Number(monthTotal.rows[0].sum ?? 0),
    totalRevenue,
    netCashFlow: totalRevenue - totalExpenses,
    byCategory: byCategory.rows.map((row) => ({ category: row.category, total: Number(row.sum ?? 0) })),
  };
}

export type MonthlyExpenseTotal = { month: string; total: number };

// Last 12 calendar months (including months with 0 expenses) for the Slice 4 bar chart.
export async function getMonthlyExpenseTotals(): Promise<MonthlyExpenseTotal[]> {
  const result = await query<{ month: string; total: string | null }>(`
    with months as (
      select date_trunc('month', timezone('utc', now())) - (n || ' months')::interval as month
      from generate_series(0, 11) as n
    )
    select to_char(months.month, 'YYYY-MM') as month, sum(e.amount) as total
    from months
    left join expenses e on e.status != 'CANCELLED' and date_trunc('month', e.spent_at) = months.month
    group by months.month order by months.month`);
  return result.rows.map((row) => ({ month: row.month, total: Number(row.total ?? 0) }));
}

export type CreateExpenseInput = {
  expenseCode: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  quantity?: number;
  status?: ExpenseStatus;
  payerName?: string | null;
  spentAt?: Date;
  note?: string | null;
};

export async function createExpense(input: CreateExpenseInput, actorId: string): Promise<{ id: string }> {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `insert into expenses (expense_code, title, category, amount, quantity, status, payer_name, spent_at, note, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,coalesce($8, timezone('utc', now())),$9,$10) returning id`,
      [
        input.expenseCode, input.title, input.category, input.amount, input.quantity ?? 1,
        input.status ?? 'PAID', input.payerName ?? null, input.spentAt ?? null, input.note ?? null, actorId,
      ],
    );
    await writeAuditLog(client, { actorId, action: 'EXPENSE_CREATED', entityType: 'expense', entityId: result.rows[0].id, afterData: input });
    return result.rows[0];
  });
}

export type UpdateExpenseInput = Partial<Omit<CreateExpenseInput, 'expenseCode'>> & { title?: string };

export async function updateExpense(id: string, input: UpdateExpenseInput, actorId: string) {
  return withTransaction(async (client) => {
    const before = await client.query<ExpenseDbRow>(`${EXPENSE_SELECT} where id = $1 for update`, [id]);
    if (!before.rowCount) throw new DomainError('EXPENSE_NOT_FOUND', 'Expense was not found.', 404);
    const current = toExpenseRow(before.rows[0]);
    const updated = await client.query<ExpenseDbRow>(
      `update expenses set title = $2, category = $3, amount = $4, quantity = $5, status = $6, payer_name = $7, spent_at = $8, note = $9
       where id = $1 returning id, expense_code as "expenseCode", title, category, amount, quantity, status, payer_name as "payerName", spent_at as "spentAt", note, created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"`,
      [
        id,
        input.title ?? current.title,
        input.category ?? current.category,
        input.amount ?? current.amount,
        input.quantity ?? current.quantity,
        input.status ?? current.status,
        input.payerName === undefined ? current.payerName : input.payerName,
        input.spentAt ?? current.spentAt,
        input.note === undefined ? current.note : input.note,
      ],
    );
    await writeAuditLog(client, { actorId, action: 'EXPENSE_UPDATED', entityType: 'expense', entityId: id, beforeData: current, afterData: updated.rows[0] });
    return toExpenseRow(updated.rows[0]);
  });
}

// Soft-cancel only (Rule #7, AGENTS.md: never delete financial history) — sets status = 'CANCELLED',
// never a real DELETE. Cancelled expenses are excluded from getExpenseFinancialSummary but remain
// visible in listExpenses (status filter) for audit purposes.
export async function deleteExpense(id: string, actorId: string) {
  return withTransaction(async (client) => {
    const before = await client.query<{ status: ExpenseStatus }>('select status from expenses where id = $1 for update', [id]);
    if (!before.rowCount) throw new DomainError('EXPENSE_NOT_FOUND', 'Expense was not found.', 404);
    const updated = await client.query<{ id: string; status: ExpenseStatus }>(
      "update expenses set status = 'CANCELLED' where id = $1 returning id, status", [id],
    );
    await writeAuditLog(client, { actorId, action: 'EXPENSE_CANCELLED', entityType: 'expense', entityId: id, beforeData: before.rows[0], afterData: updated.rows[0] });
    return updated.rows[0];
  });
}
