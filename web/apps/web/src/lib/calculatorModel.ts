import { runFuzzy, dewPointDepression, ACTIVE_FUZZY_CONFIG, type FuzzyResult } from '@ws/core';

export type CalculatorModel = {
  result: FuzzyResult;
  dpd: number;
  activeRules: { no: string; text: string; strength: number }[];
};

export function buildCalculatorModel(input: { deltaP3h: number; rh: number; temp?: number; dpd?: number }): CalculatorModel {
  const { deltaP3h, rh } = input;
  if (!Number.isFinite(deltaP3h)) throw new Error('ΔP3h harus berupa angka');
  if (!Number.isFinite(rh) || rh < 0 || rh > 100) throw new Error('RH harus antara 0 dan 100 %');
  let dpd: number;
  if (input.temp != null && Number.isFinite(input.temp)) dpd = dewPointDepression(input.temp, rh);
  else if (input.dpd != null && Number.isFinite(input.dpd) && input.dpd >= 0) dpd = input.dpd;
  else throw new Error('Isi suhu atau DPD (DPD tidak boleh negatif)');
  const result = runFuzzy({ deltaP3h, rh, dpd });
  const activeRules = ACTIVE_FUZZY_CONFIG.rules.flatMap((r, i) =>
    result.ruleStrengths[i] > 0
      ? [{ no: `R${i + 1}`, text: `JIKA ΔP3h = ${r.dp} DAN RH = ${r.rh} DAN DPD = ${r.dpd} MAKA Peluang = ${r.out}`, strength: result.ruleStrengths[i] }]
      : [],
  );
  return { result, dpd, activeRules };
}
