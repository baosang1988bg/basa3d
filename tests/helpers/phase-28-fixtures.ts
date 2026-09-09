import { randomUUID } from 'node:crypto';
import type { Client, PoolClient } from 'pg';

// Call only after configureTestEnvironment(), against a migrated disposable local database.
export async function seedPhase28Lists(client: Client | PoolClient) {
  const prefix = `P28${randomUUID().slice(0, 8)}`;
  const ids: string[] = Array.from({ length: 105 }, () => randomUUID()).sort();
  const materialId = randomUUID();
  const warehouseId = randomUUID();
  await client.query(`insert into materials (id, name, material_type) values ($1, $2, $2)`, [materialId, prefix]);
  await client.query(`insert into warehouses (id, name, code) values ($1, $2, $2)`, [warehouseId, prefix.toUpperCase()]);
  // All timestamps tie, forcing the ID tie-breaker across every page boundary.
  await client.query(`insert into orders (id, order_number, customer_name, customer_phone, subtotal, total, created_at)
    select id, $2 || '-' || n, $2, '0900000000', 0, 0, '2099-01-01' from unnest($1::uuid[]) with ordinality as f(id,n)`, [ids, prefix]);
  await client.query(`insert into custom_requests (id, request_number, source_channel, customer_name, customer_phone, description, quantity, created_at)
    select id, $2 || '-' || n, 'OTHER', $2, '0900000000', 'Phase 28 fixture', 1, '2099-01-01' from unnest($1::uuid[]) with ordinality as f(id,n)`, [ids, prefix]);
  await client.query(`insert into print_jobs (id, custom_request_id, created_at)
    select id, id, '2099-01-01' from unnest($1::uuid[]) as id`, [ids]);
  await client.query(`insert into products (id, name, slug, product_type, base_price, created_at)
    select id, $2 || '-' || n, lower($2) || '-' || n, 'READY_STOCK', 0, '2099-01-01' from unnest($1::uuid[]) with ordinality as f(id,n)`, [ids, prefix]);
  await client.query(`insert into filament_spools (id, spool_code, material_id, warehouse_id, initial_weight_grams, used_weight_grams, purchase_cost)
    select id, '!' || $2 || '-' || lpad(n::text, 3, '0'), $3, $4, 1000, case when n = 105 then 900 else 0 end, 123456
    from unnest($1::uuid[]) with ordinality as f(id,n)`, [ids, prefix, materialId, warehouseId]);
  return { prefix, ids, materialId, warehouseId };
}

export async function cleanupPhase28Lists(client: Client | PoolClient, fixture: Awaited<ReturnType<typeof seedPhase28Lists>>) {
  // These fixtures never create inventory movements. Audit records from actions remain immutable.
  for (const table of ['print_jobs', 'custom_requests', 'orders', 'products', 'filament_spools']) {
    await client.query(`delete from ${table} where id = any($1::uuid[])`, [fixture.ids]);
  }
  await client.query('delete from materials where id = $1', [fixture.materialId]);
  await client.query('delete from warehouses where id = $1', [fixture.warehouseId]);
}
