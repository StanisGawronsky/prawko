import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import type { ExamExport, QuestionBody, QuestionRow } from './types';
import { pickMediaUrl } from './mediaPath';
import { ExamProgressBar } from './ExamProgressBar';
import type { MessageKey } from './i18n/messages';
import { useI18n } from './i18n/context';
import type { Locale } from './i18n/types';
import { AppMenu, type AppMenuConfig } from './AppMenu';
import {
  buildLocalePath,
  examDataFileForLocale,
  parseAppSubpath,
  type Mode,
  type SetupScreen,
} from './routing';
import {
  ABC_TOTAL_MS,
  EXAM_TOTAL_MS,
  isProportionalPass,
  isYesNoQuestion,
  MAX_POINTS_OFFICIAL,
  PASS_POINTS_OFFICIAL,
  TAKNIE_ANSWER_MS,
  TAKNIE_READ_MS,
} from './examRules';
import {
  applyWrongRecord,
  getWrongQuestionIdsSorted,
  loadWrongMetrics,
  saveWrongMetrics,
  type WrongMetricsStore,
} from './wrongMetrics';
import {
  isMastered,
  loadLearnMastered,
  markMastered,
  moduleIdsForScope,
  resetMasteredForModules,
  saveLearnMastered,
  toggleMastered,
  toggleModuleMastered,
  unmarkMastered,
  type LearnMasteredStore,
} from './learnMastered';
import {
  clearLearnSessionStorage,
  loadLearnSession,
  resolveQuestionRows,
  saveLearnSession,
} from './learnSession';
import {
  hasHintTutorialSeen,
  hasSetupTutorialOffered,
  startCardOnlyTutorial,
  startSetupTutorial,
  TUTORIAL_CARD_PANEL_SELECTOR,
  waitForElement,
} from './tutorial';

type LearnBackSnapshot = {
  session: QuestionRow[];
  index: number;
  picked: string | null;
};

const LEARN_CORRECT_FLASH_MS = 650;
const LEARN_WRONG_ADVANCE_MS = 550;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function byQuestionOrder(a: QuestionRow, b: QuestionRow): number {
  return a.questionNumber - b.questionNumber;
}

function normalizeAnswerValue(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function resolveCorrectAnswer(question: QuestionBody): string {
  const raw = normalizeAnswerValue(question.correct);
  const letter = raw.toUpperCase();
  if (letter === 'A' || letter === 'B' || letter === 'C') {
    const byLetter =
      letter === 'A' ? question.answerA : letter === 'B' ? question.answerB : question.answerC;
    const mappedByLetter = normalizeAnswerValue(byLetter);
    if (mappedByLetter) return mappedByLetter;
    const idx = letter.charCodeAt(0) - 'A'.charCodeAt(0);
    const mappedFromPredefined = normalizeAnswerValue(question.predefinedAnswers?.[idx]);
    if (mappedFromPredefined) return mappedFromPredefined;
  }
  return raw;
}

function isAnswerMatch(pickedAnswer: string | null | undefined, correctAnswer: string): boolean {
  return normalizeAnswerValue(pickedAnswer) === normalizeAnswerValue(correctAnswer);
}

/** Zakres: cała baza albo posortowany, unikalny podzbiór `moduleId`. */
type ModuleScope = { kind: 'all' } | { kind: 'subset'; ids: number[] };

function sortUniqueModuleIds(ids: number[]): number[] {
  return [...new Set(ids)].sort((a, b) => a - b);
}

function flattenQuestions(data: ExamExport, scope: ModuleScope): QuestionRow[] {
  if (scope.kind === 'all') {
    const modules = [...data.modules].sort((a, b) => a.moduleId - b.moduleId);
    return modules.flatMap((m) => [...m.questions].sort(byQuestionOrder));
  }
  const sortedIds = sortUniqueModuleIds(scope.ids);
  return sortedIds.flatMap((id) => {
    const block = data.modules.find((m) => m.moduleId === id);
    return block ? [...block.questions].sort(byQuestionOrder) : [];
  });
}

function isEmptyModuleSelection(scope: ModuleScope): boolean {
  return scope.kind === 'subset' && scope.ids.length === 0;
}

function resolveReviewWrongScope(scope: ModuleScope): ModuleScope {
  if (isEmptyModuleSelection(scope)) return { kind: 'all' };
  return scope;
}

function getReviewWrongPending(
  data: ExamExport,
  moduleScope: ModuleScope,
  wrongMetrics: WrongMetricsStore,
  learnMastered: LearnMasteredStore,
  questionIds?: number[]
): QuestionRow[] {
  const scope = resolveReviewWrongScope(moduleScope);
  const flat = flattenQuestions(data, scope);
  const notMastered = (row: QuestionRow) => !isMastered(learnMastered, row.module.id, row.question.id);

  if (questionIds && questionIds.length > 0) {
    const idSet = new Set(questionIds);
    return flat.filter((row) => idSet.has(row.question.id) && notMastered(row));
  }

  if (isEmptyModuleSelection(moduleScope)) {
    return flat.filter(notMastered);
  }

  const wrongIdSet = new Set(getWrongQuestionIdsSorted(wrongMetrics));
  return flat.filter((row) => wrongIdSet.has(row.question.id) && notMastered(row));
}

function formatModuleScopeDescription(
  scope: ModuleScope,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
): string {
  if (scope.kind === 'all') return t('scopeAllModules');
  const sorted = sortUniqueModuleIds(scope.ids);
  if (sorted.length === 0) return t('scopeNoSelection');
  if (sorted.length <= 8) return t('scopeModules', { ids: sorted.join(', ') });
  return t('scopeModulesMore', { ids: sorted.slice(0, 8).join(', '), more: sorted.length - 8 });
}

function canStartSession(scope: ModuleScope): boolean {
  return scope.kind === 'all' || scope.ids.length > 0;
}

/** Pierwsze pytanie z pierwszego modułu — demo na kroku 7 tutoriala. */
function pickFirstModuleFirstQuestion(data: ExamExport): QuestionRow | null {
  const modules = [...data.modules].sort((a, b) => a.moduleId - b.moduleId);
  for (const mod of modules) {
    const questions = [...mod.questions].sort(byQuestionOrder);
    if (questions[0]) return questions[0];
  }
  return null;
}

/** TAK/NIE: czytanie → (film) → odpowiedź. ABC: jeden timer. */
type ExamPhase = 'reading' | 'playback' | 'answer' | 'abc';

function formatMs(ms: number): string {
  if (ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function buildGoogleSearchQuery(
  locale: Locale,
  displayText: string,
  questionId: number,
  polishTextById: Map<number, string> | null,
  questionsFallback: boolean
): string {
  if (locale !== 'en' || questionsFallback) return displayText;
  const polish = polishTextById?.get(questionId) ?? displayText;
  return `zdamy to; ${polish}, answer in English`;
}

/** Google search URLs use + for spaces (application/x-www-form-urlencoded), not %20. */
function encodeGoogleQuery(text: string): string {
  return encodeURIComponent(text).replace(/%20/g, '+');
}

function openGoogleSearchForQuestion(text: string, locale: Locale = 'pl'): void {
  const q = encodeGoogleQuery(text);
  const hl = locale === 'en' ? '&hl=en' : '';
  window.open(`https://www.google.com/search?q=${q}${hl}`, '_blank', 'noopener,noreferrer');
}

function AppFrame({ children, menu }: { children: ReactNode; menu?: AppMenuConfig }) {
  return (
    <>
      <AppMenu {...menu} />
      {children}
    </>
  );
}

function IconLearnMastered() {
  return (
    <svg className="learn-status-icon learn-status-icon--ok" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M7 12l3.5 3.5L17 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLearnPending() {
  return (
    <svg className="learn-status-icon learn-status-icon--pending" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9 9l6 6M15 9l-6 6" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}

/** Oznacz cały moduł jako opanowany (ikona przy częściowym stanie). */
function IconModuleMarkAll() {
  return (
    <svg className="learn-module-toggle-icon learn-module-toggle-icon--mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M5 6h10M5 11h8M5 16h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M15.5 13.5l1.8 1.8L22 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Cofnij opanowanie całego modułu (gdy wszystkie już opanowane). */
function IconModuleClearAll() {
  return (
    <svg className="learn-module-toggle-icon learn-module-toggle-icon--clear" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M5 6h10M5 11h8M5 16h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M17 8l4 4M21 8l-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCarTitle() {
  return (
    <svg className="app-title-car" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"
      />
    </svg>
  );
}

function AppTitleHeading() {
  const { t } = useI18n();
  return (
    <h1 className="app-title-heading">
      <IconCarTitle />
      {t('appTitle')}
    </h1>
  );
}

export function App() {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const splat = useParams()['*'];
  const { mode, setupScreen } = useMemo(() => parseAppSubpath(splat), [splat]);
  const goTo = useCallback(
    (nextMode: Mode, nextSetup: SetupScreen = 'main') => {
      navigate(buildLocalePath(locale, nextMode, nextSetup));
    },
    [locale, navigate]
  );

  const [data, setData] = useState<ExamExport | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [questionsFallback, setQuestionsFallback] = useState(false);
  const [polishTextById, setPolishTextById] = useState<Map<number, string> | null>(null);
  const [moduleScope, setModuleScope] = useState<ModuleScope>({ kind: 'subset', ids: [] });
  const [session, setSession] = useState<QuestionRow[]>([]);
  const [index, setIndex] = useState(0);
  const [learnBackStack, setLearnBackStack] = useState<LearnBackSnapshot[]>([]);
  const learnBackStackRef = useRef<LearnBackSnapshot[]>([]);
  const pushLearnBackSnapshot = useCallback((snap: LearnBackSnapshot) => {
    const next = [...learnBackStackRef.current, snap];
    learnBackStackRef.current = next;
    setLearnBackStack(next);
  }, []);

  const popLearnBackSnapshot = useCallback((): LearnBackSnapshot | null => {
    if (learnBackStackRef.current.length === 0) return null;
    const snap = learnBackStackRef.current[learnBackStackRef.current.length - 1];
    const next = learnBackStackRef.current.slice(0, -1);
    learnBackStackRef.current = next;
    setLearnBackStack(next);
    return snap;
  }, []);

  const clearLearnBackStack = useCallback(() => {
    learnBackStackRef.current = [];
    setLearnBackStack([]);
  }, []);
  const [learnFlash, setLearnFlash] = useState<'ok' | 'bad' | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [testAnswers, setTestAnswers] = useState<Record<number, string>>({});
  const [testFinished, setTestFinished] = useState(false);
  const [lastTestWrongIds, setLastTestWrongIds] = useState<number[]>([]);

  const [examGlobalEndsAt, setExamGlobalEndsAt] = useState(0);
  const [examPhase, setExamPhase] = useState<ExamPhase>('abc');
  const [examAnswers, setExamAnswers] = useState<Record<number, string>>({});
  const [examTick, setExamTick] = useState(0);
  const [wrongMetrics, setWrongMetrics] = useState<WrongMetricsStore>(() => loadWrongMetrics());
  const [learnMastered, setLearnMastered] = useState<LearnMasteredStore>({});
  /** Zakres modułów z momentu ostatniego startu Nauka — do resetu „tego modułu” w sesji. */
  const [activeLearnScope, setActiveLearnScope] = useState<ModuleScope | null>(null);
  const [setupLearnMessage, setSetupLearnMessage] = useState<string | null>(null);
  /** W widoku postępu nauki: który moduł jest rozwinięty w akordeonie (jeden naraz). */
  const [learnAccordionOpenModuleId, setLearnAccordionOpenModuleId] = useState<number | null>(null);
  const [readingEndsAt, setReadingEndsAt] = useState<number | null>(null);
  const [answerEndsAt, setAnswerEndsAt] = useState<number | null>(null);
  const [abcEndsAt, setAbcEndsAt] = useState<number | null>(null);

  const timersRef = useRef<number[]>([]);
  const indexRef = useRef(0);
  const sessionRef = useRef<QuestionRow[]>([]);
  const modeRef = useRef<Mode>(mode);
  const pickedRef = useRef<string | null>(null);
  const examAdvanceLock = useRef(false);
  const examPhaseRef = useRef<ExamPhase>('abc');
  const taknieAnswerStartedRef = useRef(false);
  /** Film zakończony (lub błąd) jeszcze w fazie czytania — po 20 s od razu 15 s na odpowiedź. */
  const videoEndedDuringReadingRef = useRef(false);
  /** Moment wejścia w fazę playback — ignorujemy „ended” zaraz po przejściu (np. film już na końcu po play). */
  const playbackPhaseEnteredAtRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const learnSessionRestoredRef = useRef(false);
  const learnAdvanceTimerRef = useRef<number | null>(null);
  const tutorialStartedRef = useRef(false);
  const learnHintTutorialRef = useRef(false);
  const tutorialDemoLearnRef = useRef(false);

  indexRef.current = index;
  sessionRef.current = session;
  modeRef.current = mode;
  pickedRef.current = picked;
  examPhaseRef.current = examPhase;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadErr(null);
      setQuestionsFallback(false);
      const primary = examDataFileForLocale(locale);
      const fallback = 'exam-all-modules-export.json';
      const candidates = primary === fallback ? [primary] : [primary, fallback];
      let lastErr: string | null = null;
      for (const file of candidates) {
        try {
          const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = (await res.json()) as ExamExport;
          if (!cancelled) {
            setData(json);
            setQuestionsFallback(file !== primary);
          }
          return;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
      }
      if (!cancelled) setLoadErr(lastErr);
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    if (locale !== 'en') {
      setPolishTextById(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}exam-all-modules-export.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ExamExport;
        const map = new Map<number, string>();
        for (const mod of json.modules) {
          for (const row of mod.questions) {
            map.set(row.question.id, row.question.text);
          }
        }
        if (!cancelled) setPolishTextById(map);
      } catch {
        if (!cancelled) setPolishTextById(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    setWrongMetrics(loadWrongMetrics());
  }, []);

  const applyTestResults = useCallback((answers: Record<number, string>, rows: QuestionRow[]) => {
    const failures: { row: QuestionRow; index: number }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const expected = resolveCorrectAnswer(row.question);
      if (!isAnswerMatch(answers[i], expected)) failures.push({ row, index: i });
    }
    setLastTestWrongIds(failures.map(({ row }) => row.question.id));
    if (failures.length === 0) return;

    setLearnMastered((prev) => {
      let next = prev;
      for (const { row } of failures) {
        next = unmarkMastered(next, row.module.id, row.question.id);
      }
      saveLearnMastered(next);
      return next;
    });
    setWrongMetrics((prev) => {
      let next = prev;
      for (const { row, index } of failures) {
        const reason = answers[index] === undefined ? 'test_timeout' : 'test_wrong';
        next = applyWrongRecord(next, row.question.id, reason);
      }
      saveWrongMetrics(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setLearnMastered(loadLearnMastered());
  }, []);

  useEffect(() => {
    if (!data) return;
    const remapRows = (rows: QuestionRow[]) => {
      if (rows.length === 0) return rows;
      const remapped = resolveQuestionRows(
        data,
        rows.map((row) => row.question.id)
      );
      return remapped.length > 0 ? remapped : rows;
    };

    setSession((prev) => remapRows(prev));

    setLearnBackStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.map((snap) => ({
        ...snap,
        session: remapRows(snap.session),
      }));
      learnBackStackRef.current = next;
      return next;
    });
  }, [data]);

  useEffect(() => {
    if (mode !== 'learn') {
      learnSessionRestoredRef.current = false;
      return;
    }
    if (tutorialDemoLearnRef.current) return;
    if (!data || session.length > 0 || learnSessionRestoredRef.current) return;

    const stored = loadLearnSession();
    learnSessionRestoredRef.current = true;
    if (!stored) return;

    const rows = resolveQuestionRows(data, stored.questionIds);
    if (rows.length === 0) {
      clearLearnSessionStorage();
      return;
    }
    setModuleScope(stored.scope);
    setActiveLearnScope(stored.scope);
    setSession(rows);
    setIndex(Math.min(stored.index, rows.length - 1));
    setPicked(null);
  }, [mode, data, session.length]);

  useEffect(() => {
    if (tutorialDemoLearnRef.current) return;
    if (mode !== 'learn' || session.length === 0) return;
    const scope = activeLearnScope ?? moduleScope;
    saveLearnSession({
      scope,
      questionIds: session.map((r) => r.question.id),
      index,
    });
  }, [mode, session, index, activeLearnScope, moduleScope]);

  const enterTutorialDemoLearn = useCallback(async () => {
    if (!data) throw new Error('tutorial: no data');
    const demo = pickFirstModuleFirstQuestion(data);
    if (!demo) throw new Error('tutorial: no questions');
    tutorialDemoLearnRef.current = true;
    flushSync(() => {
      setActiveLearnScope(null);
      setSession([demo]);
      setIndex(0);
      clearLearnBackStack();
      setPicked(null);
    });
    goTo('learn');
    await waitForElement(TUTORIAL_CARD_PANEL_SELECTOR);
  }, [data, goTo, clearLearnBackStack]);

  const exitTutorialDemoLearn = useCallback(async () => {
    tutorialDemoLearnRef.current = false;
    clearLearnSessionStorage();
    learnSessionRestoredRef.current = false;
    setActiveLearnScope(null);
    setSession([]);
    setIndex(0);
    clearLearnBackStack();
    setPicked(null);
    goTo('setup', 'main');
    await waitForElement('[data-tour="btn-test"]');
  }, [goTo, clearLearnBackStack]);

  const tutorialHooks = useMemo(
    () => ({
      onEnterDemoLearn: enterTutorialDemoLearn,
      onExitDemoLearn: exitTutorialDemoLearn,
    }),
    [enterTutorialDemoLearn, exitTutorialDemoLearn]
  );

  const runSetupTutorial = useCallback(() => {
    startSetupTutorial(locale, tutorialHooks);
  }, [locale, tutorialHooks]);

  useEffect(() => {
    if (mode !== 'setup' || setupScreen !== 'main' || !data || hasSetupTutorialOffered() || tutorialStartedRef.current) {
      return;
    }
    tutorialStartedRef.current = true;
    const timer = window.setTimeout(() => {
      runSetupTutorial();
    }, 500);
    return () => clearTimeout(timer);
  }, [mode, setupScreen, data, runSetupTutorial]);

  useEffect(() => {
    if (mode !== 'learn' || session.length === 0) return;
    if (hasHintTutorialSeen() || learnHintTutorialRef.current || tutorialDemoLearnRef.current) return;

    learnHintTutorialRef.current = true;
    const timer = window.setTimeout(() => {
      void waitForElement(TUTORIAL_CARD_PANEL_SELECTOR).then(() => {
        startCardOnlyTutorial(locale);
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [mode, session.length, locale]);

  useEffect(() => {
    setSetupLearnMessage(null);
  }, [moduleScope]);

  useEffect(() => {
    if (mode !== 'exam' && mode !== 'test') return;
    const id = window.setInterval(() => setExamTick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, [mode]);

  const moduleOptions = useMemo(() => {
    if (!data) return [];
    return data.modules
      .map((m) => ({
        id: m.moduleId,
        name: (m.meta as { module?: { name?: string } })?.module?.name ?? t('moduleFallback', { id: m.moduleId }),
        count: m.questions.length,
      }))
      .sort((a, b) => a.id - b.id);
  }, [data, t]);

  /** Liczba opanowanych pytań w module (wg aktualnej bazy i storage). */
  const masteredCountByModuleId = useMemo(() => {
    if (!data) return new Map<number, number>();
    const map = new Map<number, number>();
    for (const m of data.modules) {
      const mid = m.moduleId;
      const masteredIds = new Set(learnMastered[String(mid)] ?? []);
      const n = m.questions.filter((row) => masteredIds.has(row.question.id)).length;
      map.set(mid, n);
    }
    return map;
  }, [data, learnMastered]);

  const questionCountInScope = useMemo(() => {
    if (!data) return 0;
    return flattenQuestions(data, moduleScope).length;
  }, [data, moduleScope]);

  const learnPendingInScope = useMemo(() => {
    if (!data) return 0;
    const flat = flattenQuestions(data, moduleScope);
    return flat.filter((row) => !isMastered(learnMastered, row.module.id, row.question.id)).length;
  }, [data, moduleScope, learnMastered]);

  const learnMasteredInScope = useMemo(
    () => Math.max(0, questionCountInScope - learnPendingInScope),
    [questionCountInScope, learnPendingInScope]
  );

  const learnPercentInScope = useMemo(() => {
    if (!questionCountInScope) return 0;
    return Math.round((100 * learnMasteredInScope) / questionCountInScope);
  }, [questionCountInScope, learnMasteredInScope]);

  const wrongPendingInScope = useMemo(() => {
    if (!data) return [] as QuestionRow[];
    return getReviewWrongPending(data, moduleScope, wrongMetrics, learnMastered);
  }, [data, moduleScope, wrongMetrics, learnMastered]);

  const reviewWrongUsesAllUnmastered = isEmptyModuleSelection(moduleScope);

  const learnProgressModules = useMemo(() => {
    if (!data) return [] as { moduleId: number; name: string; rows: QuestionRow[] }[];
    const flat = flattenQuestions(data, moduleScope);
    const list: { moduleId: number; name: string; rows: QuestionRow[] }[] = [];
    const indexById = new Map<number, number>();
    for (const row of flat) {
      const id = row.module.id;
      const idx = indexById.get(id);
      if (idx === undefined) {
        indexById.set(id, list.length);
        list.push({ moduleId: id, name: row.module.name, rows: [row] });
      } else {
        list[idx].rows.push(row);
      }
    }
    return list;
  }, [data, moduleScope]);

  const scopeReady = canStartSession(moduleScope);

  const openLearnProgress = useCallback(() => {
    setLearnAccordionOpenModuleId(learnProgressModules[0]?.moduleId ?? null);
    goTo('setup', 'learnProgress');
  }, [learnProgressModules, goTo]);

  const handleReplayTutorial = useCallback(() => {
    const run = () => runSetupTutorial();
    if (mode === 'setup' && setupScreen === 'main') {
      window.setTimeout(run, 100);
      return;
    }
    goTo('setup', 'main');
    window.setTimeout(run, 450);
  }, [mode, setupScreen, goTo, runSetupTutorial]);

  const startLearn = useCallback(() => {
    if (!data || !canStartSession(moduleScope)) return;
    const flat = flattenQuestions(data, moduleScope);
    const pending = flat.filter((row) => !isMastered(learnMastered, row.module.id, row.question.id));
    if (pending.length === 0) {
      setSetupLearnMessage(t('learnNoPending'));
      return;
    }
    setActiveLearnScope(moduleScope);
    setSession(pending);
    setIndex(0);
    clearLearnBackStack();
    setPicked(null);
    setTestFinished(false);
    setSetupLearnMessage(null);
    goTo('learn');
  }, [data, moduleScope, learnMastered, goTo, t, clearLearnBackStack]);

  const startTest = useCallback(() => {
    if (!data || !canStartSession(moduleScope)) return;
    setActiveLearnScope(null);
    const flat = flattenQuestions(data, moduleScope);
    setSession(shuffle(flat));
    setIndex(0);
    setPicked(null);
    setTestAnswers({});
    setTestFinished(false);
    setLastTestWrongIds([]);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setReadingEndsAt(null);
    setAnswerEndsAt(null);
    setAbcEndsAt(null);
    setExamPhase('abc');
    goTo('test');
  }, [data, moduleScope, goTo]);

  const startReviewWrong = useCallback(
    (questionIds?: number[]) => {
      if (!data) return;
      const pending = getReviewWrongPending(data, moduleScope, wrongMetrics, learnMastered, questionIds);
      if (pending.length === 0) {
        setSetupLearnMessage(t('reviewWrongEmpty'));
        return;
      }
      setActiveLearnScope(null);
      setSession(shuffle(pending));
      setIndex(0);
      clearLearnBackStack();
      setPicked(null);
      setTestFinished(false);
      setSetupLearnMessage(null);
      goTo('learnWrong');
    },
    [data, moduleScope, wrongMetrics, learnMastered, goTo, t, clearLearnBackStack]
  );

  const exitToSetup = useCallback(() => {
    clearLearnSessionStorage();
    learnSessionRestoredRef.current = false;
    setActiveLearnScope(null);
    setSession([]);
    setIndex(0);
    clearLearnBackStack();
    setPicked(null);
    setTestFinished(false);
    setLastTestWrongIds([]);
    goTo('setup', 'main');
  }, [goTo, clearLearnBackStack]);

  const isHome = mode === 'setup' && setupScreen === 'main';

  const goHome = useCallback(() => {
    if (mode === 'exam' && !window.confirm(t('confirmAbortExam'))) return;
    exitToSetup();
  }, [mode, exitToSetup, t]);

  const menuConfig = useMemo<AppMenuConfig>(
    () => ({
      onGoHome: goHome,
      isHome,
      onLearnProgress: openLearnProgress,
      learnProgressDisabled: !scopeReady,
      learnProgressLabel: scopeReady
        ? t('learnProgressBtn', { percent: learnPercentInScope })
        : t('learnProgressMenu'),
      onReplayTutorial: handleReplayTutorial,
    }),
    [goHome, isHome, openLearnProgress, scopeReady, learnPercentInScope, t, handleReplayTutorial]
  );

  const toggleLearnQuestionMastered = useCallback((moduleId: number, questionId: number) => {
    setLearnMastered((prev) => {
      const next = toggleMastered(prev, moduleId, questionId);
      saveLearnMastered(next);
      return next;
    });
  }, []);

  const toggleLearnModuleMastered = useCallback((moduleId: number, questionIds: number[]) => {
    setLearnMastered((prev) => {
      const next = toggleModuleMastered(prev, moduleId, questionIds);
      saveLearnMastered(next);
      return next;
    });
  }, []);

  const toggleSubsetModule = useCallback(
    (o: { id: number; name: string; count: number }, nextChecked: boolean) => {
      if (moduleScope.kind !== 'subset') return;
      if (!nextChecked) {
        setModuleScope({ kind: 'subset', ids: moduleScope.ids.filter((x) => x !== o.id) });
        return;
      }
      if (moduleScope.ids.includes(o.id)) return;
      setModuleScope({ kind: 'subset', ids: sortUniqueModuleIds([...moduleScope.ids, o.id]) });
    },
    [moduleScope]
  );

  /** Czyści opanowane tylko dla modułów z aktualnego zakresu (subset lub pełna baza = wszystkie moduły w bazie). */
  const resetLearnProgressForSelectedScope = useCallback(() => {
    if (!data || !canStartSession(moduleScope)) return;
    const ids = moduleIdsForScope(data, moduleScope);
    const confirmKey: MessageKey =
      moduleScope.kind === 'all'
        ? 'confirmResetScopeAll'
        : ids.length === 1
          ? 'confirmResetScopeSingle'
          : 'confirmResetScopeMultiple';
    let confirmVars: Record<string, string | number>;
    if (moduleScope.kind === 'all') confirmVars = { count: ids.length };
    else if (ids.length === 1) confirmVars = { id: ids[0] };
    else confirmVars = { count: ids.length, ids: ids.join(', ') };
    if (!window.confirm(t(confirmKey, confirmVars))) return;
    setLearnMastered((prev) => {
      const next = resetMasteredForModules(prev, ids);
      saveLearnMastered(next);
      return next;
    });
  }, [data, moduleScope, t]);

  const goNextExam = useCallback((answer: string | null) => {
    if (examAdvanceLock.current) return;
    examAdvanceLock.current = true;
    try {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      const i = indexRef.current;
      const len = sessionRef.current.length;
      const q = sessionRef.current[i];
      if (q) {
        const expected = resolveCorrectAnswer(q.question);
        if (answer === null) {
          setWrongMetrics((prev) => {
            const next = applyWrongRecord(prev, q.question.id, 'exam_timeout');
            saveWrongMetrics(next);
            return next;
          });
        } else if (!isAnswerMatch(answer, expected)) {
          setWrongMetrics((prev) => {
            const next = applyWrongRecord(prev, q.question.id, 'exam_wrong');
            saveWrongMetrics(next);
            return next;
          });
        }
      }
      setExamAnswers((prev) => (answer !== null ? { ...prev, [i]: answer } : prev));
      setReadingEndsAt(null);
      setAnswerEndsAt(null);
      setAbcEndsAt(null);
      const next = i + 1;
      if (next >= len) {
        navigate(buildLocalePath(locale, 'examResult'));
      } else {
        setIndex(next);
      }
    } finally {
      queueMicrotask(() => {
        examAdvanceLock.current = false;
      });
    }
  }, [locale, navigate]);

  const goNextTest = useCallback(
    (forcedAnswer: string | null) => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setReadingEndsAt(null);
      setAnswerEndsAt(null);
      setAbcEndsAt(null);
      taknieAnswerStartedRef.current = false;
      const i = indexRef.current;
      const len = sessionRef.current.length;
      const answer = forcedAnswer ?? pickedRef.current;
      const rows = sessionRef.current;

      setTestAnswers((prev) => {
        const updated = answer !== null ? { ...prev, [i]: answer } : prev;
        if (i + 1 >= len) applyTestResults(updated, rows);
        return updated;
      });
      setPicked(null);
      if (i + 1 >= len) setTestFinished(true);
      else setIndex(i + 1);
    },
    [applyTestResults]
  );

  const advanceOnQuestionTimeout = useCallback(() => {
    if (modeRef.current === 'exam') goNextExam(null);
    else if (modeRef.current === 'test') goNextTest(null);
  }, [goNextExam, goNextTest]);

  const startAnswerPhaseTakNie = useCallback(() => {
    if (taknieAnswerStartedRef.current) return;
    taknieAnswerStartedRef.current = true;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setExamPhase('answer');
    const end = Date.now() + TAKNIE_ANSWER_MS;
    setAnswerEndsAt(end);
    const tAns = window.setTimeout(() => advanceOnQuestionTimeout(), TAKNIE_ANSWER_MS);
    timersRef.current.push(tAns);
  }, [advanceOnQuestionTimeout]);

  const startExam = useCallback(() => {
    if (!data || !canStartSession(moduleScope)) return;
    setActiveLearnScope(null);
    const flat = flattenQuestions(data, moduleScope);
    setSession(shuffle(flat));
    setIndex(0);
    setExamAnswers({});
    setExamGlobalEndsAt(Date.now() + EXAM_TOTAL_MS);
    goTo('exam');
  }, [data, moduleScope, goTo]);

  const current = session[index];
  const total = session.length;

  useEffect(() => {
    return () => {
      if (learnAdvanceTimerRef.current !== null) window.clearTimeout(learnAdvanceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setLearnFlash(null);
    if (learnAdvanceTimerRef.current !== null) {
      window.clearTimeout(learnAdvanceTimerRef.current);
      learnAdvanceTimerRef.current = null;
    }
  }, [mode, index, current?.question.id]);

  const advanceLearnAnswer = useCallback(
    (pickedAnswer: string) => {
      if (mode === 'learnWrong') {
        const idx = indexRef.current;
        const row = sessionRef.current[idx];
        if (row && isAnswerMatch(pickedAnswer, resolveCorrectAnswer(row.question))) {
          setLearnMastered((prev) => {
            const next = markMastered(prev, row.module.id, row.question.id);
            saveLearnMastered(next);
            return next;
          });
        }
        if (indexRef.current + 1 < sessionRef.current.length) setIndex((i) => i + 1);
        else exitToSetup();
        return;
      }

      if (mode !== 'learn') return;

      const idx = indexRef.current;
      const prevSession = sessionRef.current;
      const row = prevSession[idx];
      if (!row) return;

      const expected = resolveCorrectAnswer(row.question);
      const ok = isAnswerMatch(pickedAnswer, expected);
      if (ok) {
        setLearnMastered((prev) => {
          const next = markMastered(prev, row.module.id, row.question.id);
          saveLearnMastered(next);
          return next;
        });
        const newSession = prevSession.filter((_, i) => i !== idx);
        if (newSession.length === 0) {
          setSession([]);
          setIndex(0);
          exitToSetup();
          return;
        }
        setSession(newSession);
        setIndex((i) => Math.min(i, newSession.length - 1));
        return;
      }
      const rotated = [...prevSession.slice(0, idx), ...prevSession.slice(idx + 1), row];
      setSession(rotated);
    },
    [mode, exitToSetup]
  );

  const examGlobalLeftMs = useMemo(() => {
    if (mode !== 'exam' && mode !== 'examResult') return 0;
    return Math.max(0, examGlobalEndsAt - Date.now());
  }, [mode, examGlobalEndsAt, examTick]);

  const currentIsYesNo = current
    ? isYesNoQuestion(
        current.question.predefinedAnswers,
        current.question.answerA,
        current.question.answerB,
        current.question.answerC
      )
    : false;

  const media = current ? pickMediaUrl(current) : null;
  const examHasVideo = current && media?.kind === 'video';

  useEffect(() => {
    if ((mode !== 'exam' && mode !== 'test') || !current) return;
    taknieAnswerStartedRef.current = false;
    videoEndedDuringReadingRef.current = false;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setReadingEndsAt(null);
    setAnswerEndsAt(null);
    setAbcEndsAt(null);

    const yn = currentIsYesNo;
    const hasVideo = media?.kind === 'video';

    if (!yn) {
      setExamPhase('abc');
      const end = Date.now() + ABC_TOTAL_MS;
      setAbcEndsAt(end);
      const t = window.setTimeout(() => advanceOnQuestionTimeout(), ABC_TOTAL_MS);
      timersRef.current.push(t);
      return () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
      };
    }

    setExamPhase('reading');
    setReadingEndsAt(Date.now() + TAKNIE_READ_MS);
    const tRead = window.setTimeout(() => {
      setReadingEndsAt(null);
      if (hasVideo) {
        if (videoEndedDuringReadingRef.current) {
          startAnswerPhaseTakNie();
        } else {
          playbackPhaseEnteredAtRef.current = Date.now();
          setExamPhase('playback');
        }
      } else {
        startAnswerPhaseTakNie();
      }
    }, TAKNIE_READ_MS);
    timersRef.current.push(tRead);
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [mode, index, current?.question.id, currentIsYesNo, current, advanceOnQuestionTimeout, media?.kind, startAnswerPhaseTakNie]);

  useEffect(() => {
    if (mode !== 'exam') return;
    const left = examGlobalEndsAt - Date.now();
    if (left <= 0) {
      navigate(buildLocalePath(locale, 'examResult'));
      return;
    }
    const g = window.setTimeout(() => navigate(buildLocalePath(locale, 'examResult')), left);
    return () => clearTimeout(g);
  }, [mode, examGlobalEndsAt, locale, navigate]);

  useLayoutEffect(() => {
    if (examPhase === 'playback') {
      playbackPhaseEnteredAtRef.current = Date.now();
    } else {
      playbackPhaseEnteredAtRef.current = null;
    }
  }, [examPhase, index]);

  /** Po wejściu w playback: jeśli film już jest na końcu, odpal odpowiedź po krótkim opóźnieniu (gdy „ended” było zbyt wcześnie i je odrzuciliśmy). */
  useEffect(() => {
    if ((mode !== 'exam' && mode !== 'test') || examPhase !== 'playback' || !examHasVideo) return;
    const v = videoRef.current;
    if (!v) return;
    const t = window.setTimeout(() => {
      if (examPhaseRef.current !== 'playback') return;
      if (v.ended) startAnswerPhaseTakNie();
    }, 120);
    return () => clearTimeout(t);
  }, [mode, examPhase, examHasVideo, index, current?.question.id, startAnswerPhaseTakNie]);

  const canAcceptPlaybackMediaEvent = useCallback(() => {
    const since = playbackPhaseEnteredAtRef.current;
    if (since === null) return true;
    return Date.now() - since >= 80;
  }, []);

  const onExamVideoEnded = useCallback(() => {
    if (modeRef.current !== 'exam' && modeRef.current !== 'test') return;
    const phase = examPhaseRef.current;
    if (phase === 'reading') {
      videoEndedDuringReadingRef.current = true;
      return;
    }
    if (phase === 'playback') {
      if (!canAcceptPlaybackMediaEvent()) return;
      startAnswerPhaseTakNie();
    }
  }, [startAnswerPhaseTakNie, canAcceptPlaybackMediaEvent]);

  const onExamVideoError = useCallback(() => {
    if (modeRef.current !== 'exam' && modeRef.current !== 'test') return;
    const phase = examPhaseRef.current;
    if (phase === 'reading') {
      videoEndedDuringReadingRef.current = true;
      return;
    }
    if (phase === 'playback') {
      if (!canAcceptPlaybackMediaEvent()) return;
      startAnswerPhaseTakNie();
    }
  }, [startAnswerPhaseTakNie, canAcceptPlaybackMediaEvent]);

  const submitAnswer = (answer: string) => {
    if (!current) return;
    if (mode === 'learn' || mode === 'learnWrong') {
      if (picked !== null) return;
      const expected = resolveCorrectAnswer(current.question);
      const ok = isAnswerMatch(answer, expected);
      if (mode === 'learn') {
        flushSync(() => {
          pushLearnBackSnapshot({ session: [...session], index, picked: null });
        });
      }
      setPicked(answer);
      if (!ok) {
        setWrongMetrics((prev) => {
          const next = applyWrongRecord(prev, current.question.id, 'learn');
          saveWrongMetrics(next);
          return next;
        });
      }
      if (ok) setLearnFlash('ok');
      else setLearnFlash('bad');
      if (learnAdvanceTimerRef.current !== null) window.clearTimeout(learnAdvanceTimerRef.current);
      learnAdvanceTimerRef.current = window.setTimeout(() => {
        learnAdvanceTimerRef.current = null;
        setLearnFlash(null);
        setPicked(null);
        advanceLearnAnswer(answer);
      }, ok ? LEARN_CORRECT_FLASH_MS : LEARN_WRONG_ADVANCE_MS);
      return;
    }
    if (mode === 'test') {
      goNextTest(answer);
      return;
    }
    if (mode === 'exam') {
      goNextExam(answer);
    }
  };

  const goNext = () => {
    const pickedNow = picked;
    setPicked(null);

    if (mode === 'learn') {
      if (!current) return;
      if (pickedNow !== null) return;
      pushLearnBackSnapshot({ session: [...session], index, picked: null });
      if (index + 1 < total) setIndex((i) => i + 1);
      else exitToSetup();
      return;
    }

    if (mode === 'learnWrong') {
      if (index + 1 < total) setIndex((i) => i + 1);
      else exitToSetup();
      return;
    }

    if (index + 1 < total) setIndex((i) => i + 1);
    else exitToSetup();
  };

  const goPrev = () => {
    if (learnAdvanceTimerRef.current !== null) {
      window.clearTimeout(learnAdvanceTimerRef.current);
      learnAdvanceTimerRef.current = null;
    }
    setLearnFlash(null);

    if (mode === 'learn' && learnBackStack.length > 0) {
      const snap = popLearnBackSnapshot();
      if (!snap) return;
      setSession(snap.session);
      setIndex(snap.index);
      setPicked(snap.picked);
      return;
    }
    setPicked(null);
    if (index > 0) setIndex((i) => i - 1);
  };

  const canGoPrev = mode === 'learn' ? learnBackStack.length > 0 || index > 0 : index > 0;

  const correct = current ? resolveCorrectAnswer(current.question) : '';
  const isLearnLike = mode === 'learn' || mode === 'learnWrong';
  const testYesNoDock = mode === 'test' && currentIsYesNo;
  const showResult = isLearnLike && picked !== null;

  const testScore = useMemo(() => {
    if (!testFinished || mode !== 'test') return null;
    let ok = 0;
    session.forEach((q, i) => {
      const expected = resolveCorrectAnswer(q.question);
      if (isAnswerMatch(testAnswers[i], expected)) ok += 1;
    });
    return { ok, total: session.length };
  }, [testFinished, mode, session, testAnswers]);

  const examScore = useMemo(() => {
    if (mode !== 'examResult') return null;
    let earned = 0;
    let maxPts = 0;
    session.forEach((q, i) => {
      maxPts += q.question.points;
      const expected = resolveCorrectAnswer(q.question);
      if (isAnswerMatch(examAnswers[i], expected)) earned += q.question.points;
    });
    const passed = isProportionalPass(earned, maxPts);
    return { earned, maxPts, passed };
  }, [mode, session, examAnswers]);

  const now = Date.now();
  const isTimedQuestion = mode === 'exam' || mode === 'test';
  const readingFrac =
    isTimedQuestion && examPhase === 'reading' && readingEndsAt !== null
      ? Math.max(0, (readingEndsAt - now) / TAKNIE_READ_MS)
      : 0;
  const readingLeftMs =
    isTimedQuestion && examPhase === 'reading' && readingEndsAt !== null
      ? Math.max(0, readingEndsAt - now)
      : 0;
  const answerFrac =
    isTimedQuestion && examPhase === 'answer' && answerEndsAt !== null
      ? Math.max(0, (answerEndsAt - now) / TAKNIE_ANSWER_MS)
      : 0;
  const answerLeftMs =
    isTimedQuestion && examPhase === 'answer' && answerEndsAt !== null ? Math.max(0, answerEndsAt - now) : 0;
  const abcFrac =
    isTimedQuestion && examPhase === 'abc' && abcEndsAt !== null
      ? Math.max(0, (abcEndsAt - now) / ABC_TOTAL_MS)
      : 0;
  const abcLeftMs =
    isTimedQuestion && examPhase === 'abc' && abcEndsAt !== null ? Math.max(0, abcEndsAt - now) : 0;
  const globalFrac = mode === 'exam' ? Math.max(0, examGlobalLeftMs / EXAM_TOTAL_MS) : 0;

  if (loadErr) {
    return (
      <AppFrame menu={menuConfig}>
        <div className="app">
          <AppTitleHeading />
          <p className="err">
            {t('loadErr', { err: loadErr })} {t('loadErrHint')}
          </p>
        </div>
      </AppFrame>
    );
  }

  if (!data) {
    return (
      <AppFrame menu={menuConfig}>
        <div className="app">
          <AppTitleHeading />
          <p className="sub">{t('loading')}</p>
        </div>
      </AppFrame>
    );
  }

  if (mode === 'examIntro') {
    return (
      <AppFrame menu={menuConfig}>
        <div className="app">
          <h1>{t('examIntroTitle')}</h1>
          <div className="panel exam-rules">
            <ul className="rules-list">
              <li>{t('examRule1')}</li>
              <li>{t('examRule2')}</li>
              <li>{t('examRule3')}</li>
              <li>{t('examRule4')}</li>
              <li>{t('examRule5')}</li>
              <li>{t('examRule6')}</li>
              <li>{t('examRule7')}</li>
            </ul>
            <p className="sub">
              {t('examScope', {
                scope: formatModuleScopeDescription(moduleScope, t),
                count: questionCountInScope,
              })}
            </p>
            <div className="toolbar">
              <button type="button" className="btn" onClick={startExam} disabled={!scopeReady}>
                {t('startExam')}
              </button>
              <button type="button" className="btn secondary" onClick={exitToSetup}>
                {t('back')}
              </button>
            </div>
          </div>
        </div>
      </AppFrame>
    );
  }

  if (mode === 'examResult' && examScore) {
    return (
      <AppFrame menu={menuConfig}>
        <div className="app">
          <h1>{t('examResultTitle')}</h1>
          <div className="panel summary-end">
            <h2>{t('examPoints', { earned: examScore.earned, max: examScore.maxPts })}</h2>
            <p className="sub">
              {t('examPassThreshold', {
                pass: PASS_POINTS_OFFICIAL,
                max: MAX_POINTS_OFFICIAL,
                percent: ((PASS_POINTS_OFFICIAL / MAX_POINTS_OFFICIAL) * 100).toFixed(1),
              })}
            </p>
            <p className={examScore.passed ? 'feedback ok' : 'feedback bad'}>
              {examScore.passed ? t('examPassed') : t('examFailed')}
            </p>
            <button type="button" className="btn" onClick={exitToSetup}>
              {t('backToMenu')}
            </button>
          </div>
        </div>
      </AppFrame>
    );
  }

  if (mode === 'setup' && setupScreen === 'learnProgress') {
    return (
      <AppFrame menu={menuConfig}>
        <div className="app learn-progress-page">
          <h1>{t('learnProgressTitle')}</h1>
          <p className="sub learn-progress-lead">
            {t('learnProgressLead', {
              scope: formatModuleScopeDescription(moduleScope, t),
              mastered: learnMasteredInScope,
              total: questionCountInScope,
              percent: learnPercentInScope,
            })}
          </p>

          <div className="panel learn-progress-detail">
            <h2 className="learn-progress-h2">{t('learnProgressDetails')}</h2>
            <div className="learn-progress-scroll">
              {!scopeReady ? (
                <p className="err">{t('learnProgressSelectModule')}</p>
              ) : (
                learnProgressModules.map((block) => {
                  const total = block.rows.length;
                  const mastered = block.rows.filter((r) => isMastered(learnMastered, r.module.id, r.question.id)).length;
                  const pct = total ? Math.round((100 * mastered) / total) : 0;
                  const allModuleMastered = total > 0 && mastered === total;
                  const moduleQuestionIds = block.rows.map((r) => r.question.id);
                  const isOpen = learnAccordionOpenModuleId === block.moduleId;
                  const panelId = `learn-mod-panel-${block.moduleId}`;
                  const triggerId = `learn-mod-trigger-${block.moduleId}`;
                  return (
                    <section key={block.moduleId} className="learn-module-block">
                      <div className="learn-module-accordion-top">
                        <button
                          type="button"
                          id={triggerId}
                          className="learn-module-accordion-trigger"
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          onClick={() =>
                            setLearnAccordionOpenModuleId((prev) => (prev === block.moduleId ? null : block.moduleId))
                          }
                        >
                          <span className="learn-module-accordion-chevron" aria-hidden>
                            {isOpen ? '▼' : '▶'}
                          </span>
                          <span className="learn-module-accordion-trigger-text">
                            <span className="learn-module-title">
                              {t('moduleTitle', { id: block.moduleId, name: block.name })}
                            </span>
                            <span className="sub learn-module-stats">
                              {t('moduleMastered', { mastered, total, percent: pct })}
                            </span>
                          </span>
                        </button>
                        {scopeReady ? (
                          <button
                            type="button"
                            className="learn-module-toggle-all-btn"
                            disabled={total === 0}
                            onClick={() => toggleLearnModuleMastered(block.moduleId, moduleQuestionIds)}
                            title={allModuleMastered ? t('moduleClearAllTitle') : t('moduleMarkAllTitle')}
                            aria-label={allModuleMastered ? t('moduleClearAllAria') : t('moduleMarkAllAria')}
                          >
                            {allModuleMastered ? <IconModuleClearAll /> : <IconModuleMarkAll />}
                          </button>
                        ) : null}
                      </div>
                      {isOpen ? (
                        <div id={panelId} className="learn-module-panel" role="region" aria-labelledby={triggerId}>
                          <ul className="learn-question-list">
                            {block.rows.map((row) => {
                              const done = isMastered(learnMastered, row.module.id, row.question.id);
                              const preview =
                                row.question.text.length > 140 ? `${row.question.text.slice(0, 140)}…` : row.question.text;
                              const action = done ? t('markAsToLearn') : t('markAsMastered');
                              return (
                                <li key={row.question.id} className="learn-question-item">
                                  <button
                                    type="button"
                                    className="learn-question-row"
                                    aria-pressed={done}
                                    title={t('questionToggleTitle', { text: row.question.text, action })}
                                    onClick={() => toggleLearnQuestionMastered(row.module.id, row.question.id)}
                                  >
                                    <span className="learn-question-icon" aria-hidden>
                                      {done ? <IconLearnMastered /> : <IconLearnPending />}
                                    </span>
                                    <span className="learn-question-num">#{row.questionNumber}</span>
                                    <span className="learn-question-text">{preview}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}
                    </section>
                  );
                })
              )}
            </div>
          </div>

          <div className="toolbar learn-progress-toolbar">
            <button
              type="button"
              className="btn secondary"
              onClick={resetLearnProgressForSelectedScope}
              disabled={!scopeReady}
              title={t('resetAllTitle')}
            >
              {t('resetAll')}
            </button>
            <button type="button" className="btn" onClick={() => goTo('setup', 'main')}>
              {t('backToMenu')}
            </button>
          </div>
        </div>
      </AppFrame>
    );
  }

  if (mode === 'setup') {
    return (
      <AppFrame menu={menuConfig}>
        <div className="app">
          <AppTitleHeading />
          <p className="sub" data-tour="app-intro">
            {t('metaQuestions', {
              questions: data.meta.totalQuestions ?? '—',
              modules: data.meta.totalModules ?? data.modules.length,
            })}
          </p>
          {locale === 'en' && questionsFallback && (
            <p className="sub">{t('questionsInPolishNotice')}</p>
          )}
          <div className="panel">
            {setupLearnMessage && <p className="err">{setupLearnMessage}</p>}
            <div className="row">
              <div className="field field-modules" data-tour="module-scope">
                <span>{t('moduleScope')}</span>
                <label className="field-inline-check">
                  <input
                    type="checkbox"
                    checked={moduleScope.kind === 'all'}
                    onChange={(e) => {
                      if (e.target.checked) setModuleScope({ kind: 'all' });
                      else setModuleScope({ kind: 'subset', ids: [] });
                    }}
                  />
                  {t('fullDatabase')}
                </label>
                <div
                  className="module-pick-list"
                  role="group"
                  aria-label={t('moduleListAria')}
                  aria-disabled={moduleScope.kind === 'all'}
                  data-tour="module-list"
                >
                  {moduleOptions.map((o) => {
                    const mastered = masteredCountByModuleId.get(o.id) ?? 0;
                    const total = o.count;
                    const complete = total > 0 && mastered >= total;
                    const selected =
                      moduleScope.kind === 'all' || (moduleScope.kind === 'subset' && moduleScope.ids.includes(o.id));
                    return (
                      <label
                        key={o.id}
                        className={`module-pick-row${selected ? ' module-pick-row--selected' : ''}${moduleScope.kind === 'all' ? ' module-pick-row--locked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="module-pick-check"
                          disabled={moduleScope.kind === 'all'}
                          checked={selected}
                          onChange={(e) => toggleSubsetModule(o, e.target.checked)}
                        />
                        <span className="module-pick-status" aria-hidden>
                          {complete ? <IconLearnMastered /> : <IconLearnPending />}
                        </span>
                        <span className="module-pick-label">
                          {o.id}. {o.name}{' '}
                          <span className="module-pick-fraction">
                            ({mastered}/{total})
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {moduleScope.kind === 'subset' && <span className="sub field-hint">{t('modulePickHint')}</span>}
              </div>
            </div>
            {moduleScope.kind === 'subset' && moduleScope.ids.length === 0 && (
              <p className="err scope-warning">{t('scopeWarning')}</p>
            )}
            {wrongPendingInScope.length > 0 && (
              <p className="sub">
                {reviewWrongUsesAllUnmastered
                  ? t('reviewWrongCountUnmastered', { count: wrongPendingInScope.length })
                  : t('wrongQuestions', { count: wrongPendingInScope.length })}
              </p>
            )}
            <div className="toolbar">
              <button type="button" className="btn" data-tour="btn-learn" onClick={startLearn} disabled={!scopeReady}>
                {t('learn')}
              </button>
              <button type="button" className="btn secondary" data-tour="btn-test" onClick={startTest} disabled={!scopeReady}>
                {t('test')}
              </button>
              <button
                type="button"
                className="btn secondary"
                data-tour="btn-review-wrong"
                onClick={() => startReviewWrong()}
                disabled={wrongPendingInScope.length === 0}
              >
                {t('reviewWrong')}
              </button>
            </div>
          </div>
        </div>
      </AppFrame>
    );
  }

  if (mode === 'test' && testFinished && testScore) {
    const wrongFromTest = lastTestWrongIds.length;
    return (
      <AppFrame menu={menuConfig}>
        <div className="app">
          <h1>{t('testResultTitle')}</h1>
          <div className="panel summary-end">
            <h2>{t('testCorrect', { ok: testScore.ok, total: testScore.total })}</h2>
            <p className="sub">
              {testScore.total ? `${Math.round((100 * testScore.ok) / testScore.total)}%` : '—'}
            </p>
            {wrongFromTest > 0 && (
              <p className="sub">{t('testWrongMarked', { count: wrongFromTest })}</p>
            )}
            <div className="toolbar">
              {wrongFromTest > 0 && (
                <button type="button" className="btn" onClick={() => startReviewWrong(lastTestWrongIds)}>
                  {t('reviewWrongFromTest')}
                </button>
              )}
              <button type="button" className="btn secondary" onClick={exitToSetup}>
                {t('backToMenu')}
              </button>
            </div>
          </div>
        </div>
      </AppFrame>
    );
  }

  if (!current) {
    const learnQueueEmpty = mode === 'learn' && session.length === 0;
    return (
      <AppFrame menu={menuConfig}>
        <div className="app">
          <p className="err">{learnQueueEmpty ? t('learnQueueEmpty') : t('noQuestionsInScope')}</p>
          <button type="button" className="btn" onClick={exitToSetup}>
            {t('menu')}
          </button>
        </div>
      </AppFrame>
    );
  }

  const answers = current.question.predefinedAnswers?.length
    ? current.question.predefinedAnswers
    : [current.question.answerA, current.question.answerB, current.question.answerC].filter(Boolean);

  const renderMedia = () => {
    if (!media) return null;
    const timedYesNo = (mode === 'exam' || mode === 'test') && currentIsYesNo;
    if (timedYesNo && media.kind === 'video') {
      return (
        <video
          key={current.question.id}
          ref={videoRef}
          src={media.href}
          controls={examPhase !== 'answer'}
          playsInline
          onEnded={onExamVideoEnded}
          onError={onExamVideoError}
        />
      );
    }
    if (timedYesNo && media.kind === 'image') {
      return <img src={media.href} alt="" loading="lazy" />;
    }
    if (timedYesNo) return null;
    return media.kind === 'video' ? (
      <video key={media.href} controls playsInline src={media.href} />
    ) : (
      <img src={media.href} alt="" loading="lazy" />
    );
  };

  return (
    <AppFrame menu={menuConfig}>
      {learnFlash && (
        <div className={`learn-answer-flash learn-answer-flash--${learnFlash}`} aria-hidden>
          <div className="learn-answer-flash-badge">
            {learnFlash === 'ok' ? (
              <svg className="learn-answer-flash-icon" viewBox="0 0 24 24" width="36" height="36">
                <path
                  d="M7 12l3.5 3.5L17 9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg className="learn-answer-flash-icon" viewBox="0 0 24 24" width="36" height="36">
                <path
                  d="M9 9l6 6M15 9l-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
        </div>
      )}
      <div className={`app${testYesNoDock ? ' app--test-yes-no' : ''}`}>
        {mode === 'exam' && (
          <div className="exam-bar">
            <span>{t('examRemaining', { time: formatMs(examGlobalLeftMs) })}</span>
            <span>{t('questionOf', { current: index + 1, total })}</span>
            {currentIsYesNo ? (
              <span className="exam-phase">
                {examPhase === 'reading' && t('phaseReading')}
                {examPhase === 'playback' && t('phasePlayback')}
                {examPhase === 'answer' && t('phaseAnswer')}
              </span>
            ) : (
              <span className="exam-phase">{t('phaseAbc')}</span>
            )}
            <div className="global-progress">
              <ExamProgressBar
                label={t('examTimeLabel')}
                remainingFraction={globalFrac}
                remainingMs={examGlobalLeftMs}
                totalMs={EXAM_TOTAL_MS}
              />
            </div>
          </div>
        )}
        <div className="progress">
          {mode === 'learn'
            ? t('modeLearn')
            : mode === 'learnWrong'
              ? t('modeReviewWrong')
              : mode === 'test'
                ? t('modeTest')
                : mode === 'exam'
                  ? t('modeExam')
                  : ''}{' '}
          · {t('questionOf', { current: index + 1, total })}
          {current.module?.name ? ` · ${current.module.name}` : ''}
        </div>
        <div className={`panel${testYesNoDock ? ' panel--test-yes-no' : ''}`} data-tour="tutorial-question-card">
          {(mode === 'exam' || mode === 'test') && (
            <>
              {examPhase === 'reading' && currentIsYesNo && readingEndsAt !== null && (
                <ExamProgressBar
                  label={t('readingProgress')}
                  remainingFraction={readingFrac}
                  remainingMs={readingLeftMs}
                  totalMs={TAKNIE_READ_MS}
                />
              )}
              {examPhase === 'playback' && currentIsYesNo && examHasVideo && (
                <p className="sub" style={{ marginTop: 0 }}>
                  {t('playbackHint')}
                </p>
              )}
              {examPhase === 'answer' && currentIsYesNo && answerEndsAt !== null && (
                <ExamProgressBar
                  label={t('answerYesNoProgress')}
                  remainingFraction={answerFrac}
                  remainingMs={answerLeftMs}
                  totalMs={TAKNIE_ANSWER_MS}
                />
              )}
              {examPhase === 'abc' && abcEndsAt !== null && (
                <ExamProgressBar
                  label={t('answerAbcProgress')}
                  remainingFraction={abcFrac}
                  remainingMs={abcLeftMs}
                  totalMs={ABC_TOTAL_MS}
                />
              )}
            </>
          )}
          <div className={testYesNoDock ? 'question-body' : undefined}>
            <p className="stem">{current.question.text}</p>
            {media && <div className="media-box">{renderMedia()}</div>}
          </div>
          <div
            className={`answers${currentIsYesNo ? ' answers--yes-no' : ''}`}
            data-tour="tutorial-question-answers"
          >
            {answers.map((a) => {
              const isSel = picked === a;
              const isCor = isAnswerMatch(a, correct);
              let cls = 'answer-btn';
              if (showResult) {
                if (isCor) cls += ' correct';
                else if (isSel && !isCor) cls += ' wrong';
              }
              return (
                <button
                  key={a}
                  type="button"
                  className={cls}
                  disabled={isLearnLike && picked !== null}
                  onClick={() => submitAnswer(a)}
                >
                  {a}
                </button>
              );
            })}
          </div>
          {isLearnLike && (
            <button
              type="button"
              className="question-hint-btn"
              data-tour="question-hint-btn"
              aria-label={t('searchGoogleAria')}
              title={t('searchGoogleTitle')}
              onClick={() =>
                openGoogleSearchForQuestion(
                  buildGoogleSearchQuery(
                    locale,
                    current.question.text,
                    current.question.id,
                    polishTextById,
                    questionsFallback
                  ),
                  locale
                )
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
                <text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">
                  ?
                </text>
              </svg>
              <span>{t('questionHint')}</span>
            </button>
          )}
          <div className="toolbar">
            {isLearnLike && (
              <>
                <button type="button" className="btn secondary" onClick={goPrev} disabled={!canGoPrev}>
                  {t('prev')}
                </button>
                <button type="button" className="btn" onClick={goNext} disabled={picked !== null}>
                  {index + 1 >= total ? t('end') : t('next')}
                </button>
              </>
            )}
            {mode === 'exam' && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    if (window.confirm(t('confirmAbortExam'))) exitToSetup();
                  }}
                >
                  {t('abortExam')}
              </button>
            )}
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
