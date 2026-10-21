// Feature 003 (FR-015): a per-model time budget. The losing promise cannot be cancelled (a Drive
// "Stream" read keeps going), so the caller drops its result and `onTimeout` resets shared state
// such as the render page.
export class ModelTimeoutError extends Error {}

export async function withTimeout<T>(work: Promise<T>, ms: number, onTimeout?: () => Promise<void> | void): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ModelTimeoutError(`TIMEOUT_${Math.round(ms / 1000)}s: mẫu xử lý quá thời gian cho phép (--timeout)`)), ms);
  });
  try {
    return await Promise.race([work, expired]);
  } catch (error) {
    if (error instanceof ModelTimeoutError) await onTimeout?.();
    throw error;
  } finally {
    clearTimeout(timer);
    work.catch(() => undefined); // a late failure of the abandoned work must not crash the run
  }
}
