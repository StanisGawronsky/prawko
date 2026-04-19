import type { ExamExport } from './types';

/** Klucz: `String(moduleId)` → lista `question.id` uznanych za opanowane w nauce */
export type LearnMasteredStore = Record<string, number[]>;

export const LEARN_MASTERED_STORAGE_KEY = 'prawko.learnMastered.v1';

function uniqueSortedIds(ids: number[]): number[] {
  return [...new Set(ids.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
}

export function loadLearnMastered(): LearnMasteredStore {
  try {
    const raw = localStorage.getItem(LEARN_MASTERED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: LearnMasteredStore = {};
    for (const [modKey, arr] of Object.entries(parsed as Record<string, unknown>)) {
      const modId = Number(modKey);
      if (!Number.isFinite(modId)) continue;
      if (!Array.isArray(arr)) continue;
      const ids: number[] = [];
      for (const v of arr) {
        const qid = typeof v === 'number' ? v : Number(v);
        if (Number.isFinite(qid)) ids.push(qid);
      }
      const sorted = uniqueSortedIds(ids);
      if (sorted.length) out[String(modId)] = sorted;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveLearnMastered(store: LearnMasteredStore): void {
  try {
    localStorage.setItem(LEARN_MASTERED_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function clearLearnMasteredStorage(): void {
  localStorage.removeItem(LEARN_MASTERED_STORAGE_KEY);
}

export function isMastered(store: LearnMasteredStore, moduleId: number, questionId: number): boolean {
  const list = store[String(moduleId)];
  if (!list?.length) return false;
  return list.includes(questionId);
}

export function markMastered(
  prev: LearnMasteredStore,
  moduleId: number,
  questionId: number
): LearnMasteredStore {
  const key = String(moduleId);
  const list = prev[key] ?? [];
  if (list.includes(questionId)) return prev;
  const nextList = uniqueSortedIds([...list, questionId]);
  return { ...prev, [key]: nextList };
}

export function unmarkMastered(
  prev: LearnMasteredStore,
  moduleId: number,
  questionId: number
): LearnMasteredStore {
  const key = String(moduleId);
  const list = prev[key];
  if (!list?.length || !list.includes(questionId)) return prev;
  const nextList = list.filter((id) => id !== questionId);
  const next: LearnMasteredStore = { ...prev };
  if (nextList.length === 0) delete next[key];
  else next[key] = nextList;
  return next;
}

export function toggleMastered(
  prev: LearnMasteredStore,
  moduleId: number,
  questionId: number
): LearnMasteredStore {
  if (isMastered(prev, moduleId, questionId)) return unmarkMastered(prev, moduleId, questionId);
  return markMastered(prev, moduleId, questionId);
}

/** Jeśli wszystkie `allQuestionIdsInModule` są opanowane — czyści moduł; w przeciwnym razie ustawia wszystkie jako opanowane. */
export function toggleModuleMastered(
  prev: LearnMasteredStore,
  moduleId: number,
  allQuestionIdsInModule: number[]
): LearnMasteredStore {
  if (allQuestionIdsInModule.length === 0) return prev;
  const allMastered = allQuestionIdsInModule.every((id) => isMastered(prev, moduleId, id));
  if (allMastered) return resetMasteredForModules(prev, [moduleId]);
  const key = String(moduleId);
  return { ...prev, [key]: uniqueSortedIds(allQuestionIdsInModule) };
}

/** Usuwa opanowane dla wskazanych modułów (reset zakresu). */
export function resetMasteredForModules(prev: LearnMasteredStore, moduleIds: number[]): LearnMasteredStore {
  if (moduleIds.length === 0) return prev;
  const next: LearnMasteredStore = { ...prev };
  for (const id of moduleIds) {
    delete next[String(id)];
  }
  return next;
}

export function resetMasteredAll(): LearnMasteredStore {
  clearLearnMasteredStorage();
  return {};
}

export function moduleIdsForScope(
  data: ExamExport,
  scope: { kind: 'all' } | { kind: 'subset'; ids: number[] }
): number[] {
  if (scope.kind === 'all') {
    return [...data.modules].map((m) => m.moduleId).sort((a, b) => a - b);
  }
  return [...new Set(scope.ids)].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
}
