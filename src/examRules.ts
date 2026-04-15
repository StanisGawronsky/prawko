/** Stałe zgodne z typowymi zasadami egzaminu teoretycznym (WORD). */
export const EXAM_TOTAL_MS = 25 * 60 * 1000;
export const TAKNIE_READ_MS = 20 * 1000;
export const TAKNIE_ANSWER_MS = 15 * 1000;
export const ABC_TOTAL_MS = 50 * 1000;
export const PASS_POINTS_OFFICIAL = 68;
export const MAX_POINTS_OFFICIAL = 74;

/** Czy pytanie jest typu TAK/NIE (jednokrotny wybór). */
export function isYesNoQuestion(predefined: string[], answerA: string, answerB: string, answerC: string): boolean {
  const a = (answerA || '').trim();
  const b = (answerB || '').trim();
  const c = (answerC || '').trim();
  if (a || b || c) return false;
  const p = predefined.map((x) => x.trim().toUpperCase());
  return p.length === 2 && p.includes('TAK') && p.includes('NIE');
}

/** Próg zaliczenia przy dowolnej puli punktów (proporcja jak 68/74). */
export function isProportionalPass(earned: number, maxInSession: number): boolean {
  if (maxInSession <= 0) return false;
  return earned / maxInSession >= PASS_POINTS_OFFICIAL / MAX_POINTS_OFFICIAL;
}
