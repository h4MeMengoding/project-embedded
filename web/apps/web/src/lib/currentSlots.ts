import { slotBounds } from '@ws/core';

/** Slot yang memuat `now` menjadi yang pertama; bila tidak ada, slot mendatang pertama. Rows terurut naik. */
export function selectCurrentSlots<T extends { utcDatetime: Date }>(rows: T[], now: Date, mode: 'start' | 'center', count: number): T[] {
  const t = now.getTime();
  let idx = rows.findIndex((r) => {
    const b = slotBounds(r.utcDatetime, mode);
    return b.start.getTime() <= t && t < b.end.getTime();
  });
  if (idx < 0) idx = rows.findIndex((r) => slotBounds(r.utcDatetime, mode).start.getTime() > t);
  if (idx < 0) return [];
  return rows.slice(idx, idx + count);
}
