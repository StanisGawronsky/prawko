import type { ExamExport, QuestionRow } from './types';

export type ModuleScope = { kind: 'all' } | { kind: 'subset'; ids: number[] };

export type LearnSessionPersist = {
  scope: ModuleScope;
  questionIds: number[];
  index: number;
};

export const LEARN_SESSION_STORAGE_KEY = 'prawko.learnSession.v1';

function parseScope(raw: unknown): ModuleScope | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { kind?: unknown; ids?: unknown };
  if (o.kind === 'all') return { kind: 'all' };
  if (o.kind === 'subset' && Array.isArray(o.ids)) {
    const ids = o.ids.map((v) => Number(v)).filter((n) => Number.isFinite(n));
    return { kind: 'subset', ids };
  }
  return null;
}

export function loadLearnSession(): LearnSessionPersist | null {
  try {
    const raw = localStorage.getItem(LEARN_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    const scope = parseScope(o.scope);
    if (!scope) return null;
    if (!Array.isArray(o.questionIds) || o.questionIds.length === 0) return null;
    const questionIds = o.questionIds.map((v) => Number(v)).filter((n) => Number.isFinite(n));
    if (questionIds.length === 0) return null;
    const index = Number(o.index);
    return {
      scope,
      questionIds,
      index: Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0,
    };
  } catch {
    return null;
  }
}

export function saveLearnSession(session: LearnSessionPersist): void {
  try {
    localStorage.setItem(LEARN_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* quota / private mode */
  }
}

export function clearLearnSessionStorage(): void {
  localStorage.removeItem(LEARN_SESSION_STORAGE_KEY);
}

export function resolveQuestionRows(data: ExamExport, questionIds: number[]): QuestionRow[] {
  const byId = new Map<number, QuestionRow>();
  for (const mod of data.modules) {
    for (const row of mod.questions) {
      byId.set(row.question.id, row);
    }
  }
  return questionIds.map((id) => byId.get(id)).filter((r): r is QuestionRow => r !== undefined);
}
