export const isOnline = (lastSeenAt: Date | null, now: Date, offlineAfterSec: number): boolean =>
  lastSeenAt != null && now.getTime() - lastSeenAt.getTime() <= offlineAfterSec * 1000;
