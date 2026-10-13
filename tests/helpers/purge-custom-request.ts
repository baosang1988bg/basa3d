import type { ClientBase } from 'pg';

/**
 * Phase 33 S2 (T6): the ONE sanctioned way to delete a custom request that has items.
 * custom_request_items rejects DELETE unless the session sets `basa3d.allow_item_purge = 'on'`;
 * `set local` scopes that flag to this transaction only, so nothing else on the connection can
 * delete items afterwards. Order: print jobs → quotes (they FK the items) → items → request.
 * Pass a dedicated client (pg.Client or a checked-out PoolClient), never a shared pool.
 */
export async function purgeCustomRequest(client: ClientBase, customRequestId: string): Promise<void> {
  await client.query('begin');
  try {
    await client.query("set local basa3d.allow_item_purge = 'on'");
    await client.query('delete from print_jobs where custom_request_id = $1', [customRequestId]);
    await client.query('delete from quotes where custom_request_id = $1', [customRequestId]);
    await client.query('delete from custom_request_items where custom_request_id = $1', [customRequestId]);
    await client.query('delete from custom_requests where id = $1', [customRequestId]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}
