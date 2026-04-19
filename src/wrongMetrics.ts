import type { ExamExport, QuestionRow } from './types';

export type WrongMetricsRow = {
  learnWrong: number;
  examWrong: number;
  examTimeout: number;
  lastWrongAt: number;
};

/** Klucz: `String(questionId)` */
export type WrongMetricsStore = Record<string, WrongMetricsRow>;

export const WRONG_METRICS_STORAGE_KEY = 'prawko.wrongMetrics.v1';

export type WrongRecordReason = 'learn' | 'exam_wrong' | 'exam_timeout';

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function parseRow(v: unknown): WrongMetricsRow | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  return {
    learnWrong: isFiniteNumber(o.learnWrong) ? Math.max(0, Math.floor(o.learnWrong)) : 0,
    examWrong: isFiniteNumber(o.examWrong) ? Math.max(0, Math.floor(o.examWrong)) : 0,
    examTimeout: isFiniteNumber(o.examTimeout) ? Math.max(0, Math.floor(o.examTimeout)) : 0,
    lastWrongAt: isFiniteNumber(o.lastWrongAt) ? o.lastWrongAt : 0,
  };
}

export function loadWrongMetrics(): WrongMetricsStore {
  try {
    const raw = localStorage.getItem(WRONG_METRICS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: WrongMetricsStore = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      const row = parseRow(v);
      if (!row) continue;
      out[String(id)] = row;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveWrongMetrics(store: WrongMetricsStore): void {
  try {
    localStorage.setItem(WRONG_METRICS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function clearWrongMetricsStorage(): void {
  localStorage.removeItem(WRONG_METRICS_STORAGE_KEY);
}

export function applyWrongRecord(
  prev: WrongMetricsStore,
  questionId: number,
  reason: WrongRecordReason
): WrongMetricsStore {
  const key = String(questionId);
  const prevRow = prev[key] ?? { learnWrong: 0, examWrong: 0, examTimeout: 0, lastWrongAt: 0 };
  const row: WrongMetricsRow = { ...prevRow, lastWrongAt: Date.now() };
  if (reason === 'learn') row.learnWrong += 1;
  else if (reason === 'exam_wrong') row.examWrong += 1;
  else row.examTimeout += 1;
  return { ...prev, [key]: row };
}

export function countQuestionsWithErrors(store: WrongMetricsStore): number {
  return Object.values(store).filter((r) => r.learnWrong + r.examWrong + r.examTimeout > 0).length;
}

export function getWrongQuestionIdsSorted(store: WrongMetricsStore): number[] {
  return Object.entries(store)
    .filter(([, r]) => r.learnWrong + r.examWrong + r.examTimeout > 0)
    .map(([k]) => Number(k))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b);
}

export function findQuestionRowById(data: ExamExport, questionId: number): QuestionRow | null {
  for (const m of data.modules) {
    for (const row of m.questions) {
      if (row.question.id === questionId) return row;
    }
  }
  return null;
}
