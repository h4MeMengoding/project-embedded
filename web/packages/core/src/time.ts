const TZ = 'Asia/Jakarta';

const f = new Intl.DateTimeFormat('id-ID', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(d: Date) {
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return o;
}

/** YYYY-MM-DD di Asia/Jakarta. */
export function wibDayKey(d: Date): string {
  const p = parts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** 24 jam WIB; jam dan menit dipisah titik (cocok mockup). */
export function formatWib(d: Date, style: 'datetime' | 'time' | 'date'): string {
  const p = parts(d);
  const time = `${p.hour}.${p.minute}`;
  const date = `${p.day}/${p.month}/${p.year}`;
  return style === 'time' ? time : style === 'date' ? date : `${date} ${time}`;
}
