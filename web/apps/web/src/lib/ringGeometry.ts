const ARC = 405; // 270° dari keliling 540 (r=86)
const CIRC = 540;

export function ringGeometry(percent: number): { dash: string; track: string } {
  const p = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return { dash: `${Math.round((ARC * p) / 100)} ${CIRC}`, track: `${ARC} ${CIRC}` };
}
