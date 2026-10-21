import type { LabelParams, OrganizerParams } from './organizer-params';
import type { OrganizerBuildSuccess, OrganizerWorkerRequest, OrganizerWorkerResponse } from './organizer-worker-protocol';

/**
 * Owns one geometry worker. `build()` resolves with the newest result only: a reply for an older
 * request id is dropped (its promise resolves to null) so slow builds never overwrite newer ones.
 */
export class OrganizerWorkerClient {
  private worker: Worker;
  private nextId = 1;
  private latestId = 0;
  private pending = new Map<number, (value: OrganizerBuildSuccess | null) => void>();
  private failures = new Map<number, (error: Error) => void>();

  constructor() {
    this.worker = new Worker(new URL('./organizer.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<OrganizerWorkerResponse>) => {
      const reply = event.data;
      const resolve = this.pending.get(reply.id);
      const reject = this.failures.get(reply.id);
      this.pending.delete(reply.id); this.failures.delete(reply.id);
      if (!resolve || !reject) return;
      if (reply.id !== this.latestId) { resolve(null); return; }
      if (reply.ok) resolve(reply); else reject(new Error(reply.error));
    };
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'Organizer worker error');
      this.failures.forEach((reject) => reject(error));
      this.pending.clear(); this.failures.clear();
    };
  }

  build(params: Partial<OrganizerParams>, label: Partial<LabelParams> | null): Promise<OrganizerBuildSuccess | null> {
    const id = this.nextId++;
    this.latestId = id;
    // Older requests can never win any more; settle them now.
    this.pending.forEach((resolve) => resolve(null));
    this.pending.clear(); this.failures.clear();
    return new Promise((resolve, reject) => {
      this.pending.set(id, resolve);
      this.failures.set(id, reject);
      this.post({ type: 'build', id, params, label });
    });
  }

  setFont(bytes: ArrayBuffer | null) { this.post({ type: 'font', bytes }); }

  dispose() {
    this.worker.terminate();
    this.pending.forEach((resolve) => resolve(null));
    this.pending.clear(); this.failures.clear();
  }

  private post(message: OrganizerWorkerRequest) { this.worker.postMessage(message); }
}
