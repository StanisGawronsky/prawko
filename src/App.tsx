import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ExamExport, QuestionBody, QuestionRow } from './types';
import { pickMediaUrl } from './mediaPath';
import { ExamProgressBar } from './ExamProgressBar';
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
  clearWrongMetricsStorage,
  countQuestionsWithErrors,
  findQuestionRowById,
  getWrongQuestionIdsSorted,
  loadWrongMetrics,
  saveWrongMetrics,
  type WrongMetricsStore,
} from './wrongMetrics';

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

function formatModuleScopeDescription(scope: ModuleScope): string {
  if (scope.kind === 'all') return 'wszystkie moduły';
  const sorted = sortUniqueModuleIds(scope.ids);
  if (sorted.length === 0) return 'brak wyboru modułów';
  if (sorted.length <= 8) return `moduły: ${sorted.join(', ')}`;
  return `moduły: ${sorted.slice(0, 8).join(', ')}… (+${sorted.length - 8})`;
}

function canStartSession(scope: ModuleScope): boolean {
  return scope.kind === 'all' || scope.ids.length > 0;
}

type Mode = 'setup' | 'learn' | 'learnWrong' | 'test' | 'examIntro' | 'exam' | 'examResult';

/** TAK/NIE: czytanie → (film) → odpowiedź. ABC: jeden timer. */
type ExamPhase = 'reading' | 'playback' | 'answer' | 'abc';

function formatMs(ms: number): string {
  if (ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function openGoogleSearchForQuestion(text: string): void {
  const q = encodeURIComponent(text);
  window.open(`https://www.google.com/search?q=${q}`, '_blank', 'noopener,noreferrer');
}

export function App() {
  const [data, setData] = useState<ExamExport | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [moduleScope, setModuleScope] = useState<ModuleScope>({ kind: 'all' });
  const [mode, setMode] = useState<Mode>('setup');
  const [session, setSession] = useState<QuestionRow[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [testAnswers, setTestAnswers] = useState<Record<number, string>>({});
  const [testFinished, setTestFinished] = useState(false);

  const [examGlobalEndsAt, setExamGlobalEndsAt] = useState(0);
  const [examPhase, setExamPhase] = useState<ExamPhase>('abc');
  const [examAnswers, setExamAnswers] = useState<Record<number, string>>({});
  const [examTick, setExamTick] = useState(0);
  const [wrongMetrics, setWrongMetrics] = useState<WrongMetricsStore>({});
  const [readingEndsAt, setReadingEndsAt] = useState<number | null>(null);
  const [answerEndsAt, setAnswerEndsAt] = useState<number | null>(null);
  const [abcEndsAt, setAbcEndsAt] = useState<number | null>(null);

  const timersRef = useRef<number[]>([]);
  const indexRef = useRef(0);
  const sessionRef = useRef<QuestionRow[]>([]);
  const examAdvanceLock = useRef(false);
  const examPhaseRef = useRef<ExamPhase>('abc');
  const taknieAnswerStartedRef = useRef(false);
  /** Film zakończony (lub błąd) jeszcze w fazie czytania — po 20 s od razu 15 s na odpowiedź. */
  const videoEndedDuringReadingRef = useRef(false);
  /** Moment wejścia w fazę playback — ignorujemy „ended” zaraz po przejściu (np. film już na końcu po play). */
  const playbackPhaseEnteredAtRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  indexRef.current = index;
  sessionRef.current = session;
  examPhaseRef.current = examPhase;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}exam-all-modules-export.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ExamExport;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setWrongMetrics(loadWrongMetrics());
  }, []);

  useEffect(() => {
    if (mode !== 'exam') return;
    const id = window.setInterval(() => setExamTick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, [mode]);

  const moduleOptions = useMemo(() => {
    if (!data) return [];
    return data.modules
      .map((m) => ({
        id: m.moduleId,
        name: (m.meta as { module?: { name?: string } })?.module?.name ?? `Moduł ${m.moduleId}`,
        count: m.questions.length,
      }))
      .sort((a, b) => a.id - b.id);
  }, [data]);

  const questionCountInScope = useMemo(() => {
    if (!data) return 0;
    return flattenQuestions(data, moduleScope).length;
  }, [data, moduleScope]);

  const scopeReady = canStartSession(moduleScope);
  const subsetIdsForSelect =
    moduleScope.kind === 'subset' ? sortUniqueModuleIds(moduleScope.ids) : [];
  const moduleSelectSize = useMemo(() => {
    const n = moduleOptions.length;
    if (n <= 0) return 4;
    return Math.min(12, Math.max(4, n));
  }, [moduleOptions.length]);

  const startLearn = useCallback(() => {
    if (!data || !canStartSession(moduleScope)) return;
    const flat = flattenQuestions(data, moduleScope);
    setSession(flat);
    setIndex(0);
    setPicked(null);
    setTestFinished(false);
    setMode('learn');
  }, [data, moduleScope]);

  const startTest = useCallback(() => {
    if (!data || !canStartSession(moduleScope)) return;
    const flat = flattenQuestions(data, moduleScope);
    setSession(shuffle(flat));
    setIndex(0);
    setPicked(null);
    setTestAnswers({});
    setTestFinished(false);
    setMode('test');
  }, [data, moduleScope]);

  const wrongQuestionCount = useMemo(() => countQuestionsWithErrors(wrongMetrics), [wrongMetrics]);

  const startReviewWrong = useCallback(() => {
    if (!data) return;
    const ids = getWrongQuestionIdsSorted(wrongMetrics);
    const rows = ids.map((id) => findQuestionRowById(data, id)).filter((r): r is QuestionRow => r !== null);
    if (rows.length === 0) return;
    setSession(shuffle(rows));
    setIndex(0);
    setPicked(null);
    setTestFinished(false);
    setMode('learnWrong');
  }, [data, wrongMetrics]);

  const clearWrongMetricsHandler = useCallback(() => {
    if (!window.confirm('Wyczyścić wszystkie metryki błędnych odpowiedzi (nauka + egzamin)?')) return;
    clearWrongMetricsStorage();
    setWrongMetrics({});
  }, []);

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
        setMode('examResult');
      } else {
        setIndex(next);
      }
    } finally {
      queueMicrotask(() => {
        examAdvanceLock.current = false;
      });
    }
  }, []);

  const startAnswerPhaseTakNie = useCallback(() => {
    if (taknieAnswerStartedRef.current) return;
    taknieAnswerStartedRef.current = true;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setExamPhase('answer');
    const end = Date.now() + TAKNIE_ANSWER_MS;
    setAnswerEndsAt(end);
    const tAns = window.setTimeout(() => goNextExam(null), TAKNIE_ANSWER_MS);
    timersRef.current.push(tAns);
  }, [goNextExam]);

  const startExam = useCallback(() => {
    if (!data || !canStartSession(moduleScope)) return;
    const flat = flattenQuestions(data, moduleScope);
    setSession(shuffle(flat));
    setIndex(0);
    setExamAnswers({});
    setExamGlobalEndsAt(Date.now() + EXAM_TOTAL_MS);
    setMode('exam');
  }, [data, moduleScope]);

  const current = session[index];
  const total = session.length;

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
    if (mode !== 'exam' || !current) return;
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
      const t = window.setTimeout(() => goNextExam(null), ABC_TOTAL_MS);
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
  }, [mode, index, current?.question.id, currentIsYesNo, current, goNextExam, media?.kind, startAnswerPhaseTakNie]);

  useEffect(() => {
    if (mode !== 'exam') return;
    const left = examGlobalEndsAt - Date.now();
    if (left <= 0) {
      setMode('examResult');
      return;
    }
    const g = window.setTimeout(() => setMode('examResult'), left);
    return () => clearTimeout(g);
  }, [mode, examGlobalEndsAt]);

  useLayoutEffect(() => {
    if (examPhase === 'playback') {
      playbackPhaseEnteredAtRef.current = Date.now();
    } else {
      playbackPhaseEnteredAtRef.current = null;
    }
  }, [examPhase, index]);

  /** Po wejściu w playback: jeśli film już jest na końcu, odpal odpowiedź po krótkim opóźnieniu (gdy „ended” było zbyt wcześnie i je odrzuciliśmy). */
  useEffect(() => {
    if (mode !== 'exam' || examPhase !== 'playback' || !examHasVideo) return;
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
    if (mode !== 'exam') return;
    const phase = examPhaseRef.current;
    if (phase === 'reading') {
      videoEndedDuringReadingRef.current = true;
      return;
    }
    if (phase === 'playback') {
      if (!canAcceptPlaybackMediaEvent()) return;
      startAnswerPhaseTakNie();
    }
  }, [mode, startAnswerPhaseTakNie, canAcceptPlaybackMediaEvent]);

  const onExamVideoError = useCallback(() => {
    if (mode !== 'exam') return;
    const phase = examPhaseRef.current;
    if (phase === 'reading') {
      videoEndedDuringReadingRef.current = true;
      return;
    }
    if (phase === 'playback') {
      if (!canAcceptPlaybackMediaEvent()) return;
      startAnswerPhaseTakNie();
    }
  }, [mode, startAnswerPhaseTakNie, canAcceptPlaybackMediaEvent]);

  const submitAnswer = (answer: string) => {
    if (!current) return;
    if (mode === 'learn' || mode === 'learnWrong') {
      setPicked(answer);
      const expected = resolveCorrectAnswer(current.question);
      if (!isAnswerMatch(answer, expected)) {
        setWrongMetrics((prev) => {
          const next = applyWrongRecord(prev, current.question.id, 'learn');
          saveWrongMetrics(next);
          return next;
        });
      }
      return;
    }
    if (mode === 'test') {
      setTestAnswers((prev) => ({ ...prev, [index]: answer }));
      setPicked(answer);
      return;
    }
    if (mode === 'exam') {
      goNextExam(answer);
    }
  };

  const goNext = () => {
    setPicked(null);
    if (index + 1 < total) setIndex((i) => i + 1);
    else if (mode === 'test') setTestFinished(true);
    else setMode('setup');
  };

  const goPrev = () => {
    setPicked(null);
    if (index > 0) setIndex((i) => i - 1);
  };

  const correct = current ? resolveCorrectAnswer(current.question) : '';
  const isLearnLike = mode === 'learn' || mode === 'learnWrong';
  const showResult =
    (isLearnLike && picked !== null) || (mode === 'test' && picked !== null);

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
  const readingFrac =
    mode === 'exam' && examPhase === 'reading' && readingEndsAt !== null
      ? Math.max(0, (readingEndsAt - now) / TAKNIE_READ_MS)
      : 0;
  const readingLeftMs =
    mode === 'exam' && examPhase === 'reading' && readingEndsAt !== null
      ? Math.max(0, readingEndsAt - now)
      : 0;
  const answerFrac =
    mode === 'exam' && examPhase === 'answer' && answerEndsAt !== null
      ? Math.max(0, (answerEndsAt - now) / TAKNIE_ANSWER_MS)
      : 0;
  const answerLeftMs =
    mode === 'exam' && examPhase === 'answer' && answerEndsAt !== null ? Math.max(0, answerEndsAt - now) : 0;
  const abcFrac =
    mode === 'exam' && examPhase === 'abc' && abcEndsAt !== null
      ? Math.max(0, (abcEndsAt - now) / ABC_TOTAL_MS)
      : 0;
  const abcLeftMs =
    mode === 'exam' && examPhase === 'abc' && abcEndsAt !== null ? Math.max(0, abcEndsAt - now) : 0;
  const globalFrac = mode === 'exam' ? Math.max(0, examGlobalLeftMs / EXAM_TOTAL_MS) : 0;

  if (loadErr) {
    return (
      <div className="app">
        <h1>Prawko — lokalnie</h1>
        <p className="err">
          Nie udało się wczytać danych: {loadErr}. Lokalnie: w <code>public/</code> symlink do{' '}
          <code>data/exam-all-modules-export.json</code>. Na GitHub Pages: plik musi być w buildzie (Vite kopiuje{' '}
          <code>public/</code>); multimedia są opcjonalne.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app">
        <h1>Prawko — lokalnie</h1>
        <p className="sub">Wczytywanie bazy pytań…</p>
      </div>
    );
  }

  if (mode === 'examIntro') {
    return (
      <div className="app">
        <h1>Podstawowe informacje o przebiegu egzaminu</h1>
        <div className="panel exam-rules">
          <ul className="rules-list">
            <li>Czas trwania egzaminu: <strong>25 minut</strong>.</li>
            <li>Test jest jednokrotnego wyboru.</li>
            <li>Pytaniom zostały przydzielone „wagi” — punktacja zależy od znaczenia pytania.</li>
            <li>
              Przy odpowiedziach <strong>TAK</strong> / <strong>NIE</strong>: <strong>20 s</strong> na przeczytanie pytania, potem{' '}
              przy filmie — odtwarzanie po tym czasie; <strong>15 s</strong> na odpowiedź <strong>od zakończenia filmu</strong>{' '}
              (przy samej grafice — bez filmu — 15 s od końca fazy czytania).
            </li>
            <li>
              Przy odpowiedziach <strong>A, B, C</strong>: <strong>50 s</strong> na odpowiedź.
            </li>
            <li>Nie ma możliwości powrotu do pytań ani zmiany odpowiedzi po wyborze.</li>
            <li>
              Maksymalna liczba punktów do uzyskania na egzaminie państwowym to <strong>74</strong>; do zaliczenia potrzeba co
              najmniej <strong>68 punktów</strong>. W symulacji na pełnej bazie stosujemy ten sam <strong>procentowy próg</strong>{' '}
              (punktacja ważona w Twojej sesji).
            </li>
          </ul>
          <p className="sub">
            Zakres: {formatModuleScopeDescription(moduleScope)} — {questionCountInScope} pytań (losowa kolejność).
          </p>
          <div className="toolbar">
            <button type="button" className="btn" onClick={startExam} disabled={!scopeReady}>
              Rozpocznij egzamin
            </button>
            <button type="button" className="btn secondary" onClick={() => setMode('setup')}>
              Wróć
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'examResult' && examScore) {
    return (
      <div className="app">
        <h1>Wynik egzaminu</h1>
        <div className="panel summary-end">
          <h2>
            Punkty: {examScore.earned} / {examScore.maxPts}
          </h2>
          <p className="sub">
            Próg jak na egzaminie państwowym: {PASS_POINTS_OFFICIAL} / {MAX_POINTS_OFFICIAL} pkt (proporcjonalnie:{' '}
            {((PASS_POINTS_OFFICIAL / MAX_POINTS_OFFICIAL) * 100).toFixed(1)}% poprawnej punktacji).
          </p>
          <p className={examScore.passed ? 'feedback ok' : 'feedback bad'}>
            {examScore.passed ? 'Zaliczono (wg proporcjonalnego progu).' : 'Niezaliczone (wg proporcjonalnego progu).'}
          </p>
          <button type="button" className="btn" onClick={() => setMode('setup')}>
            Wróć do menu
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'setup') {
    return (
      <div className="app">
        <h1>Prawko — nauka lokalna</h1>
        <p className="sub">
          {data.meta.totalQuestions ?? '—'} pytań · {data.meta.totalModules ?? data.modules.length} modułów
        </p>
        <div className="panel">
          <p className="sub" style={{ marginTop: 0 }}>
            W tym zakresie: <strong>{questionCountInScope}</strong> pytań. <strong>Nauka</strong> — stała kolejność.{' '}
            <strong>Test</strong> — wszystkie pytania losowo, z podpowiedziami. <strong>Egzamin</strong> — zasady jak na egzaminie
            (czas, brak cofania, punktacja ważona).
          </p>
          <div className="row">
            <div className="field field-modules">
              <span>Zakres modułów</span>
              <label className="field-inline-check">
                <input
                  type="checkbox"
                  checked={moduleScope.kind === 'all'}
                  onChange={(e) => {
                    if (e.target.checked) setModuleScope({ kind: 'all' });
                    else setModuleScope({ kind: 'subset', ids: [] });
                  }}
                />
                Pełna baza (wszystkie moduły)
              </label>
              <select
                multiple
                className="select-modules"
                size={moduleSelectSize}
                disabled={moduleScope.kind === 'all'}
                value={subsetIdsForSelect.map(String)}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions, (o) => Number(o.value));
                  setModuleScope({ kind: 'subset', ids: sortUniqueModuleIds(opts) });
                }}
              >
                {moduleOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id}. {o.name} ({o.count})
                  </option>
                ))}
              </select>
              {moduleScope.kind === 'subset' && (
                <span className="sub field-hint">
                  Wybór wielu pozycji: Ctrl lub Cmd + klik (zależnie od przeglądarki i urządzenia).
                </span>
              )}
            </div>
          </div>
          {moduleScope.kind === 'subset' && moduleScope.ids.length === 0 && (
            <p className="err scope-warning">Wybierz co najmniej jeden moduł (lista powyżej).</p>
          )}
          <div className="toolbar">
            <button type="button" className="btn" onClick={startLearn} disabled={!scopeReady}>
              Nauka
            </button>
            <button type="button" className="btn secondary" onClick={startTest} disabled={!scopeReady}>
              Test (losowa kolejność)
            </button>
            <button type="button" className="btn secondary" onClick={() => setMode('examIntro')} disabled={!scopeReady}>
              Egzamin (zasady WORD)
            </button>
          </div>
          <p className="sub" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
            Pytania z zapisanymi błędami (nauka + egzamin): <strong>{wrongQuestionCount}</strong>
          </p>
          <div className="toolbar">
            <button type="button" className="btn secondary" onClick={startReviewWrong} disabled={!data || wrongQuestionCount === 0}>
              Powtórz błędne
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={clearWrongMetricsHandler}
              disabled={wrongQuestionCount === 0}
            >
              Wyczyść metryki błędów
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'test' && testFinished && testScore) {
    return (
      <div className="app">
        <h1>Wynik testu</h1>
        <div className="panel summary-end">
          <h2>
            Poprawne: {testScore.ok} / {testScore.total}
          </h2>
          <p className="sub">
            {testScore.total ? `${Math.round((100 * testScore.ok) / testScore.total)}%` : '—'}
          </p>
          <button type="button" className="btn" onClick={() => setMode('setup')}>
            Wróć do menu
          </button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="app">
        <p className="err">Brak pytań w wybranym zakresie.</p>
        <button type="button" className="btn" onClick={() => setMode('setup')}>
          Menu
        </button>
      </div>
    );
  }

  const answers = current.question.predefinedAnswers?.length
    ? current.question.predefinedAnswers
    : [current.question.answerA, current.question.answerB, current.question.answerC].filter(Boolean);

  const renderMedia = () => {
    if (!media) return null;
    if (mode === 'exam' && currentIsYesNo && media.kind === 'video') {
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
    if (mode === 'exam' && currentIsYesNo && media.kind === 'image') {
      return <img src={media.href} alt="" loading="lazy" />;
    }
    if (mode === 'exam' && currentIsYesNo) return null;
    return media.kind === 'video' ? (
      <video key={media.href} controls playsInline src={media.href} />
    ) : (
      <img src={media.href} alt="" loading="lazy" />
    );
  };

  return (
    <div className="app">
      {mode === 'exam' && (
        <div className="exam-bar">
          <span>Egzamin · pozostały czas: {formatMs(examGlobalLeftMs)}</span>
          <span>
            Pytanie {index + 1} / {total}
          </span>
          {currentIsYesNo ? (
            <span className="exam-phase">
              {examPhase === 'reading' && 'Czytanie (20 s)'}
              {examPhase === 'playback' && 'Czekanie na koniec filmu — potem 15 s na odpowiedź'}
              {examPhase === 'answer' && 'Czas na odpowiedź (15 s)'}
            </span>
          ) : (
            <span className="exam-phase">Czas na odpowiedź (50 s)</span>
          )}
          <div className="global-progress">
            <ExamProgressBar
              label="Czas egzaminu (25 min)"
              remainingFraction={globalFrac}
              remainingMs={examGlobalLeftMs}
              totalMs={EXAM_TOTAL_MS}
            />
          </div>
        </div>
      )}
      <div className="progress">
        {mode === 'learn'
          ? 'Nauka'
          : mode === 'learnWrong'
            ? 'Powtórka błędnych'
            : mode === 'test'
              ? 'Test'
              : mode === 'exam'
                ? 'Egzamin'
                : ''}{' '}
        · Pytanie {index + 1} / {total}
        {current.module?.name ? ` · ${current.module.name}` : ''}
      </div>
      <div className="panel">
        {mode === 'exam' && (
          <>
            {examPhase === 'reading' && currentIsYesNo && readingEndsAt !== null && (
              <ExamProgressBar
                label="Czytanie pytania (20 s)"
                remainingFraction={readingFrac}
                remainingMs={readingLeftMs}
                totalMs={TAKNIE_READ_MS}
              />
            )}
            {examPhase === 'playback' && currentIsYesNo && examHasVideo && (
              <p className="sub" style={{ marginTop: 0 }}>
                Dokończ oglądanie — po zakończeniu filmu startuje 15 s na odpowiedź.
              </p>
            )}
            {examPhase === 'answer' && currentIsYesNo && answerEndsAt !== null && (
              <ExamProgressBar
                label="Odpowiedź TAK / NIE (15 s)"
                remainingFraction={answerFrac}
                remainingMs={answerLeftMs}
                totalMs={TAKNIE_ANSWER_MS}
              />
            )}
            {examPhase === 'abc' && abcEndsAt !== null && (
              <ExamProgressBar
                label="Odpowiedź A / B / C (50 s)"
                remainingFraction={abcFrac}
                remainingMs={abcLeftMs}
                totalMs={ABC_TOTAL_MS}
              />
            )}
          </>
        )}
        <div className="stem-row">
          <p className="stem">{current.question.text}</p>
          <button
            type="button"
            className="stem-help-btn"
            aria-label="Szukaj tego pytania w Google (nowa karta)"
            title="Szukaj tego pytania w Google (nowa karta)"
            onClick={() => openGoogleSearchForQuestion(current.question.text)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">
                ?
              </text>
            </svg>
          </button>
        </div>
        {media && <div className="media-box">{renderMedia()}</div>}
        <div className="answers">
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
                disabled={isLearnLike ? picked !== null : mode === 'test' ? picked !== null : false}
                onClick={() => submitAnswer(a)}
              >
                {a}
              </button>
            );
          })}
        </div>
        {isLearnLike && picked !== null && (
          <div className={`feedback ${isAnswerMatch(picked, correct) ? 'ok' : 'bad'}`}>
            {isAnswerMatch(picked, correct) ? 'Poprawnie.' : `Błędnie. Poprawna odpowiedź: ${correct}`}
          </div>
        )}
        {mode === 'test' && picked !== null && (
          <div className={`feedback ${isAnswerMatch(picked, correct) ? 'ok' : 'bad'}`}>
            {isAnswerMatch(picked, correct) ? 'Poprawnie.' : `Błędnie. Poprawna: ${correct}`}
          </div>
        )}
        <div className="toolbar">
          {isLearnLike && (
            <button type="button" className="btn secondary" onClick={goPrev} disabled={index === 0}>
              Wstecz
            </button>
          )}
          {(isLearnLike || mode === 'test') && (
            <button type="button" className="btn" onClick={goNext} disabled={picked === null}>
              {index + 1 >= total ? (mode === 'test' ? 'Zakończ test' : 'Koniec') : 'Dalej'}
            </button>
          )}
          {(isLearnLike || mode === 'test') && (
            <button type="button" className="btn secondary" onClick={() => setMode('setup')}>
              Menu
            </button>
          )}
          {mode === 'exam' && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                if (window.confirm('Przerwać egzamin i wrócić do menu?')) setMode('setup');
              }}
            >
              Przerwij egzamin
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
