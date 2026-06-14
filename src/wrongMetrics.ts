import type { ExamExport, QuestionRow } from './types';

export type WrongMetricsRow = {
  learnWrong: number;
  examWrong: number;
  examTimeout: number;
  testWrong: number;
  testTimeout: number;
  lastWrongAt: number;
};

/** Klucz: `String(questionId)` */
export type WrongMetricsStore = Record<string, WrongMetricsRow>;

export const WRONG_METRICS_STORAGE_KEY = 'prawko.wrongMetrics.v1';

export type WrongRecordReason = 'learn' | 'exam_wrong' | 'exam_timeout' | 'test_wrong' | 'test_timeout';

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
    testWrong: isFiniteNumber(o.testWrong) ? Math.max(0, Math.floor(o.testWrong)) : 0,
    testTimeout: isFiniteNumber(o.testTimeout) ? Math.max(0, Math.floor(o.testTimeout)) : 0,
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
  const prevRow = prev[key] ?? {
    learnWrong: 0,
    examWrong: 0,
    examTimeout: 0,
    testWrong: 0,
    testTimeout: 0,
    lastWrongAt: 0,
  };
  const row: WrongMetricsRow = { ...prevRow, lastWrongAt: Date.now() };
  if (reason === 'learn') row.learnWrong += 1;
  else if (reason === 'exam_wrong') row.examWrong += 1;
  else if (reason === 'exam_timeout') row.examTimeout += 1;
  else if (reason === 'test_wrong') row.testWrong += 1;
  else row.testTimeout += 1;
  return { ...prev, [key]: row };
}

function totalWrongCount(row: WrongMetricsRow): number {
  return row.learnWrong + row.examWrong + row.examTimeout + row.testWrong + row.testTimeout;
}

export function countQuestionsWithErrors(store: WrongMetricsStore): number {
  return Object.values(store).filter((r) => totalWrongCount(r) > 0).length;
}

export function getWrongQuestionIdsSorted(store: WrongMetricsStore): number[] {
  return Object.entries(store)
    .filter(([, r]) => totalWrongCount(r) > 0)
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
