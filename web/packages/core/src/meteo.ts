const A = 17.62;
const B = 243.12;

/** Titik embun (Magnus). RH di-clamp ke [1,100]. */
export function dewPoint(tempC: number, rhPct: number): number {
  const rh = Math.min(100, Math.max(1, rhPct));
  const g = Math.log(rh / 100) + (A * tempC) / (B + tempC);
  return (B * g) / (A - g);
}

export function dewPointDepression(tempC: number, rhPct: number): number {
  return tempC - dewPoint(tempC, rhPct);
}
