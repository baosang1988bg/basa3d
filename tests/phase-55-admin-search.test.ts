// Phase 55 (D3) — admin list search (docs/exec-plans/active/phase-55-admin-staff-ux.md).
// Pure tests always run; the DB-backed test needs the disposable local PostgreSQL (TEST_DATABASE_URL).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import { Client } from 'pg';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool } from '../src/lib/db.js';
import { ADMIN_SEARCH_MAX_LENGTH, adminSearchSql, parseAdminSearch } from '../src/lib/admin-search.js';
import { listOrders } from '../src/services/order.service.js';
import { listCustomRequests } from '../src/services/custom-request.service.js';

configureTestEnvironment();
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { if (hasDb) await getPool().end(); });

test('parseAdminSearch: empty / whitespace → no search', () => {
  assert.equal(parseAdminSearch(undefined), null);
  assert.equal(parseAdminSearch(null), null);
  assert.equal(parseAdminSearch('   '), null);
});

test('parseAdminSearch: LIKE wildcards are escaped and the query is capped', () => {
  assert.equal(parseAdminSearch('50%_off\\')?.textPattern, '%50\\%\\_off\\\\%');
  const long = parseAdminSearch('a'.repeat(500));
  assert.equal(long?.textPattern.length, ADMIN_SEARCH_MAX_LENGTH + 2);
});

test('parseAdminSearch: phone numbers match on digits regardless of how they were typed', () => {
  // Stored as "0333698638" or "+84333698638" → both contain "333698638".
  assert.equal(parseAdminSearch('0333 698 638')?.digitsPattern, '%333698638%');
  assert.equal(parseAdminSearch('0333.698.638')?.digitsPattern, '%333698638%');
  assert.equal(parseAdminSearch('+84 333 698 638')?.digitsPattern, '%333698638%');
  assert.equal(parseAdminSearch('(0333) 698-638')?.digitsPattern, '%333698638%');
  // A short fragment keeps its leading zero (it may be the middle of a number).
  assert.equal(parseAdminSearch('0333')?.digitsPattern, '%0333%');
  assert.equal(parseAdminSearch('638')?.digitsPattern, '%638%');
});

test('parseAdminSearch: names and order codes are not treated as phone numbers', () => {
  assert.equal(parseAdminSearch('Nguyễn Văn A')?.digitsPattern, null);
  assert.equal(parseAdminSearch('ORD-12AB')?.digitsPattern, null);
  assert.equal(parseAdminSearch('12')?.digitsPattern, null, 'too few digits to be useful');
});

test('adminSearchSql: parameterised, appends to the caller values, empty without a search', () => {
  const columns = { code: 'order_number', name: 'customer_name', phone: 'customer_phone' };
  const untouched: unknown[] = ['NEW'];
  assert.equal(adminSearchSql(null, untouched, columns), '');
  assert.deepEqual(untouched, ['NEW']);

  const values: unknown[] = [['NEW', 'CONFIRMED']];
  const sql = adminSearchSql(parseAdminSearch('0333 698 638'), values, columns);
  assert.deepEqual(values, [['NEW', 'CONFIRMED'], '%0333 698 638%', '%333698638%']);
  assert.equal(sql, "and (order_number ilike $2 or customer_name ilike $2 or customer_phone ilike $2 or regexp_replace(customer_phone, '\\D', '', 'g') like $3)");
  assert.ok(!sql.includes('0333'), 'user input never appears in the SQL text');

  const textValues: unknown[] = [];
  assert.equal(adminSearchSql(parseAdminSearch("Lan'; drop table orders;--"), textValues, columns), 'and (order_number ilike $1 or customer_name ilike $1 or customer_phone ilike $1)');
  assert.deepEqual(textValues, ["%Lan'; drop table orders;--%"]);
});

// ---------------------------------------------------------------------------------------------
// DB-backed — the SQL really runs on PostgreSQL (needs the disposable TEST_DATABASE_URL).
// ---------------------------------------------------------------------------------------------

test('DB: orders and custom requests are found by code, name and phone in any typed format', { skip: !hasDb }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const tag = randomUUID().slice(0, 8).toUpperCase();
    // Unique 9-digit subscriber part so other tests' rows never match.
    const subscriber = `9${String(Date.now()).slice(-8)}`;
    await client.query(
      `insert into orders (order_number, customer_name, customer_phone, subtotal, total) values
        ($1, $2, $3, 1000, 1000), ($4, 'Khách khác 100%', '0111 222 333', 1000, 1000)`,
      [`ORD-A${tag}`, `Trần Thị Tìm ${tag}`, `0${subscriber}`, `ORD-B${tag}`]);
    await client.query(
      `insert into custom_requests (request_number, source_channel, customer_name, customer_phone, description, quantity)
       values ($1, 'ZALO', $2, $3, 'in thử', 1)`,
      [`CR-${tag}`, `Lê Văn Tìm ${tag}`, `+84 ${subscriber.slice(0, 3)} ${subscriber.slice(3, 6)} ${subscriber.slice(6)}`]);

    const orderNumbers = async (search: string, statuses?: string[]) => (await listOrders({ search, statuses })).items.map((order) => order.orderNumber);
    assert.deepEqual(await orderNumbers(`ord-a${tag.toLowerCase()}`), [`ORD-A${tag}`], 'order number, case-insensitive');
    assert.deepEqual(await orderNumbers(`tìm ${tag}`), [`ORD-A${tag}`], 'customer name');
    assert.deepEqual(await orderNumbers(`0${subscriber}`), [`ORD-A${tag}`], 'phone as stored');
    assert.deepEqual(await orderNumbers(`+84 ${subscriber}`), [`ORD-A${tag}`], 'phone typed with country code');
    assert.deepEqual(await orderNumbers(`0${subscriber.slice(0, 3)}.${subscriber.slice(3, 6)}.${subscriber.slice(6)}`), [`ORD-A${tag}`], 'phone typed with dots');
    assert.deepEqual(await orderNumbers(`ORD-A${tag}`, ['COMPLETED']), [], 'search combines with the status tab');
    assert.deepEqual(await orderNumbers(`ORD-_${tag}`), [], '"_" is a literal, not a wildcard');
    assert.ok((await orderNumbers('100%')).includes(`ORD-B${tag}`), '"%" is a literal');

    const requestNumbers = async (search: string) => (await listCustomRequests({ search })).items.map((request) => request.requestNumber);
    assert.deepEqual(await requestNumbers(`cr-${tag.toLowerCase()}`), [`CR-${tag}`]);
    assert.deepEqual(await requestNumbers(`0${subscriber}`), [`CR-${tag}`], 'stored with +84 and spaces, typed as 0xxxxxxxxx');
  } finally {
    await client.end();
  }
});
