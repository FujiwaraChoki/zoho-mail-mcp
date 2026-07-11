/** Sliding-window rate limiter for Zoho API (30 requests/minute). */

const WINDOW_MS = 60_000;

const timestamps: number[] = [];

/** Waits until a request slot is available. */
export async function waitForSlot(maxRequests = 30): Promise<void> {
  const now = Date.now();

  // Remove timestamps outside the window
  while (timestamps.length > 0 && timestamps[0]! < now - WINDOW_MS) {
    timestamps.shift();
  }

  if (timestamps.length >= maxRequests) {
    const waitTime = timestamps[0]! + WINDOW_MS - now;
    console.error(`[rate-limiter] At capacity, waiting ${waitTime}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    return waitForSlot(maxRequests);
  }

  timestamps.push(Date.now());
}
