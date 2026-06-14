import type { Locale } from './types';

export type MessageKey =
  | 'appTitle'
  | 'loading'
  | 'loadErr'
  | 'loadErrHint'
  | 'questionsInPolishNotice'
  | 'scopeAllModules'
  | 'scopeNoSelection'
  | 'scopeModules'
  | 'scopeModulesMore'
  | 'moduleFallback'
  | 'learnNoPending'
  | 'confirmClearWrong'
  | 'confirmMasteredModule'
  | 'confirmResetScopeAll'
  | 'confirmResetScopeSingle'
  | 'confirmResetScopeMultiple'
  | 'confirmResetModuleInLearn'
  | 'confirmAbortExam'
  | 'examIntroTitle'
  | 'examRule1'
  | 'examRule2'
  | 'examRule3'
  | 'examRule4'
  | 'examRule5'
  | 'examRule6'
  | 'examRule7'
  | 'examScope'
  | 'startExam'
  | 'back'
  | 'examResultTitle'
  | 'examPoints'
  | 'examPassThreshold'
  | 'examPassed'
  | 'examFailed'
  | 'backToMenu'
  | 'learnProgressTitle'
  | 'learnProgressLead'
  | 'learnProgressDetails'
  | 'learnProgressSelectModule'
  | 'moduleTitle'
  | 'moduleMastered'
  | 'moduleMarkAllTitle'
  | 'moduleMarkAllAria'
  | 'moduleClearAllTitle'
  | 'moduleClearAllAria'
  | 'questionToggleTitle'
  | 'resetAll'
  | 'resetAllTitle'
  | 'metaQuestions'
  | 'moduleScope'
  | 'fullDatabase'
  | 'moduleListAria'
  | 'modulePickHint'
  | 'scopeWarning'
  | 'learn'
  | 'test'
  | 'learnProgressBtn'
  | 'wrongQuestions'
  | 'reviewWrong'
  | 'reviewWrongEmpty'
  | 'reviewWrongFromTest'
  | 'reviewWrongCountUnmastered'
  | 'testWrongMarked'
  | 'clearWrongMetrics'
  | 'testResultTitle'
  | 'testCorrect'
  | 'learnQueueEmpty'
  | 'noQuestionsInScope'
  | 'menu'
  | 'examRemaining'
  | 'questionOf'
  | 'phaseReading'
  | 'phasePlayback'
  | 'phaseAnswer'
  | 'phaseAbc'
  | 'examTimeLabel'
  | 'modeLearn'
  | 'modeReviewWrong'
  | 'modeTest'
  | 'modeExam'
  | 'readingProgress'
  | 'playbackHint'
  | 'answerYesNoProgress'
  | 'answerAbcProgress'
  | 'searchGoogleAria'
  | 'searchGoogleTitle'
  | 'questionHint'
  | 'feedbackCorrect'
  | 'feedbackWrong'
  | 'feedbackWrongShort'
  | 'prev'
  | 'next'
  | 'finishTest'
  | 'end'
  | 'resetModule'
  | 'resetModuleTitle'
  | 'abortExam'
  | 'markAsToLearn'
  | 'markAsMastered'
  | 'langSwitch'
  | 'langPl'
  | 'langEn'
  | 'menuOpenAria'
  | 'menuCloseAria'
  | 'menuTitle'
  | 'menuHome'
  | 'learnProgressMenu'
  | 'menuReplayTutorial'
  | 'pageTitleSuffix'
  | 'tourWelcomeTitle'
  | 'tourWelcomeDesc'
  | 'tourLangTitle'
  | 'tourLangDesc'
  | 'tourMenuTitle'
  | 'tourMenuDesc'
  | 'tourScopeTitle'
  | 'tourScopeDesc'
  | 'tourModulesTitle'
  | 'tourModulesDesc'
  | 'tourLearnTitle'
  | 'tourLearnDesc'
  | 'tourTestTitle'
  | 'tourTestDesc'
  | 'tourProgressTitle'
  | 'tourProgressDesc'
  | 'tourQuestionCardTitle'
  | 'tourQuestionCardDesc'
  | 'tourQuestionAnswersTitle'
  | 'tourQuestionAnswersDesc'
  | 'tourHintTitle'
  | 'tourHintDesc'
  | 'tourNext'
  | 'tourPrev'
  | 'tourDone';

type Messages = Record<MessageKey, string>;

const pl: Messages = {
  appTitle: 'Prawko',
  menuOpenAria: 'Otwórz menu',
  menuCloseAria: 'Zamknij menu',
  menuTitle: 'Menu',
  menuHome: 'Strona główna',
  learnProgressMenu: 'Postęp nauki',
  menuReplayTutorial: 'Pokaż tutorial ponownie',
  pageTitleSuffix: '',
  loading: 'Wczytywanie bazy pytań…',
  loadErr: 'Nie udało się wczytać danych: {{err}}.',
  loadErrHint:
    'Lokalnie: w public/ symlink do data/exam-all-modules-export.json. Na GitHub Pages: plik musi być w buildzie (Vite kopiuje public/); multimedia są opcjonalne.',
  questionsInPolishNotice: 'Treść pytań jest po polsku (oficjalna baza egzaminacyjna).',
  scopeAllModules: 'wszystkie moduły',
  scopeNoSelection: 'brak wyboru modułów',
  scopeModules: 'moduły: {{ids}}',
  scopeModulesMore: 'moduły: {{ids}}… (+{{more}})',
  moduleFallback: 'Moduł {{id}}',
  learnNoPending:
    'W tym zakresie nie ma pytań do nauki (wszystkie są już opanowane). Zresetuj postęp nauki dla zakresu lub całej bazy, aby zacząć od nowa.',
  confirmClearWrong: 'Wyczyścić wszystkie metryki błędnych odpowiedzi (nauka + egzamin)?',
  confirmMasteredModule:
    'Ten moduł jest już w całości opanowany. Zresetować postęp modułu i dodać go do zakresu nauki od zera?',
  confirmResetScopeAll: 'Wyzerować postęp nauki (opanowane) dla pełnej bazy ({{count}} modułów)?',
  confirmResetScopeSingle: 'Wyzerować postęp nauki (opanowane) dla modułu {{id}}?',
  confirmResetScopeMultiple: 'Wyzerować postęp nauki (opanowane) dla wybranych modułów ({{count}}): {{ids}}?',
  confirmResetModuleInLearn: 'Wyzerować postęp nauki dla modułu {{id}}? Kolejka zostanie przeładowana.',
  confirmAbortExam: 'Przerwać egzamin i wrócić do menu?',
  examIntroTitle: 'Podstawowe informacje o przebiegu egzaminu',
  examRule1: 'Czas trwania egzaminu: 25 minut.',
  examRule2: 'Test jest jednokrotnego wyboru.',
  examRule3: 'Pytaniom zostały przydzielone „wagi” — punktacja zależy od znaczenia pytania.',
  examRule4:
    'Przy odpowiedziach TAK / NIE: 20 s na przeczytanie pytania, potem przy filmie — odtwarzanie po tym czasie; 15 s na odpowiedź od zakończenia filmu (przy samej grafice — bez filmu — 15 s od końca fazy czytania).',
  examRule5: 'Przy odpowiedziach A, B, C: 50 s na odpowiedź.',
  examRule6: 'Nie ma możliwości powrotu do pytań ani zmiany odpowiedzi po wyborze.',
  examRule7:
    'Maksymalna liczba punktów do uzyskania na egzaminie państwowym to 74; do zaliczenia potrzeba co najmniej 68 punktów. W symulacji na pełnej bazie stosujemy ten sam procentowy próg (punktacja ważona w Twojej sesji).',
  examScope: 'Zakres: {{scope}} — {{count}} pytań.',
  startExam: 'Rozpocznij egzamin',
  back: 'Wróć',
  examResultTitle: 'Wynik egzaminu',
  examPoints: 'Punkty: {{earned}} / {{max}}',
  examPassThreshold:
    'Próg jak na egzaminie państwowym: {{pass}} / {{max}} pkt (proporcjonalnie: {{percent}}% poprawnej punktacji).',
  examPassed: 'Zaliczono (wg proporcjonalnego progu).',
  examFailed: 'Niezaliczone (wg proporcjonalnego progu).',
  backToMenu: 'Wróć do menu',
  learnProgressTitle: 'Postęp nauki',
  learnProgressLead: 'Zakres: {{scope}} · opanowane: {{mastered}} / {{total}} ({{percent}}%)',
  learnProgressDetails: 'Szczegóły',
  learnProgressSelectModule: 'Wybierz co najmniej jeden moduł w menu głównym, aby zobaczyć postęp.',
  moduleTitle: 'Moduł {{id}} — {{name}}',
  moduleMastered: 'Opanowane: {{mastered}} / {{total}} ({{percent}}%)',
  moduleMarkAllTitle: 'Kliknij, aby oznaczyć wszystkie pytania w module jako opanowane',
  moduleMarkAllAria: 'Oznacz wszystkie pytania modułu jako opanowane',
  moduleClearAllTitle: 'Cały moduł opanowany — kliknij, aby oznaczyć wszystkie pytania jako do nauki',
  moduleClearAllAria: 'Oznacz wszystkie pytania modułu jako do nauki',
  questionToggleTitle: '{{text}} — kliknij, aby {{action}}.',
  resetAll: 'Resetuj wszystkie',
  resetAllTitle: 'Czyści opanowanie dla wszystkich modułów z aktualnego zakresu (tego wybranego w menu głównym).',
  metaQuestions: '{{questions}} pytań · {{modules}} modułów',
  moduleScope: 'Zakres modułów',
  fullDatabase: 'Pełna baza (wszystkie moduły)',
  moduleListAria: 'Lista modułów do wyboru',
  modulePickHint: 'Zaznacz jeden lub więcej modułów (wiele naraz).',
  scopeWarning: 'Wybierz co najmniej jeden moduł (lista powyżej).',
  learn: 'Nauka',
  test: 'Test',
  learnProgressBtn: 'Postęp nauki — sprawdź ({{percent}}%)',
  wrongQuestions: 'Pytania do powtórki (nauka + test + egzamin): {{count}}',
  reviewWrong: 'Powtórz błędne',
  reviewWrongEmpty: 'Brak błędnych pytań do powtórki w wybranym zakresie.',
  reviewWrongFromTest: 'Powtórz błędne z testu',
  reviewWrongCountUnmastered: 'Nieopanowane pytania (cała baza): {{count}}',
  testWrongMarked: '{{count}} pytań oznaczono jako nieopanowane.',
  clearWrongMetrics: 'Wyczyść metryki błędów',
  testResultTitle: 'Wynik testu',
  testCorrect: 'Poprawne: {{ok}} / {{total}}',
  learnQueueEmpty: 'Brak pytań w kolejce nauki. Wróć do menu lub zresetuj postęp nauki dla zakresu.',
  noQuestionsInScope: 'Brak pytań w wybranym zakresie.',
  menu: 'Menu',
  examRemaining: 'Egzamin · pozostały czas: {{time}}',
  questionOf: 'Pytanie {{current}} / {{total}}',
  phaseReading: 'Czytanie (20 s)',
  phasePlayback: 'Czekanie na koniec filmu — potem 15 s na odpowiedź',
  phaseAnswer: 'Czas na odpowiedź (15 s)',
  phaseAbc: 'Czas na odpowiedź (50 s)',
  examTimeLabel: 'Czas egzaminu (25 min)',
  modeLearn: 'Nauka',
  modeReviewWrong: 'Powtórka błędnych',
  modeTest: 'Test',
  modeExam: 'Egzamin',
  readingProgress: 'Czytanie pytania (20 s)',
  playbackHint: 'Dokończ oglądanie — po zakończeniu filmu startuje 15 s na odpowiedź.',
  answerYesNoProgress: 'Odpowiedź TAK / NIE (15 s)',
  answerAbcProgress: 'Odpowiedź A / B / C (50 s)',
  searchGoogleAria: 'Szukaj tego pytania w Google (nowa karta)',
  searchGoogleTitle: 'Szukaj tego pytania w Google (nowa karta)',
  questionHint: 'Podpowiedź',
  feedbackCorrect: 'Poprawnie.',
  feedbackWrong: 'Błędnie. Poprawna odpowiedź: {{answer}}',
  feedbackWrongShort: 'Błędnie. Poprawna: {{answer}}',
  prev: 'Wstecz',
  next: 'Dalej',
  finishTest: 'Zakończ test',
  end: 'Koniec',
  resetModule: 'Reset modułu',
  resetModuleTitle: 'Wyzeruj opanowane pytania w tym module i przeładuj kolejkę nauki',
  abortExam: 'Przerwij egzamin',
  markAsToLearn: 'oznaczyć jako do nauki',
  markAsMastered: 'oznaczyć jako opanowane',
  langSwitch: 'Język',
  langPl: 'Polski',
  langEn: 'English',
  tourWelcomeTitle: 'Witaj w Prawko',
  tourWelcomeDesc:
    'Krótki przewodnik po aplikacji. Baza pytań z oficjalnego egzaminu — wybierz moduły i zacznij naukę lub test.',
  tourLangTitle: 'Język',
  tourLangDesc: 'Przełącz interfejs między polskim a angielskim. Treść pytań pozostaje z polskiej bazy egzaminacyjnej.',
  tourMenuTitle: 'Menu',
  tourMenuDesc:
    'Ustawienia: język interfejsu, postęp nauki (po wyborze modułów) oraz ponowne uruchomienie przewodnika.',
  tourScopeTitle: 'Zakres modułów',
  tourScopeDesc:
    'Zaznacz „Pełna baza”, aby ćwiczyć wszystkie moduły, albo wybierz konkretne moduły z listy poniżej.',
  tourModulesTitle: 'Lista modułów',
  tourModulesDesc:
    'Zaznacz jeden lub więcej modułów. Ikona ✓ przy module oznacza, że wszystkie pytania są już opanowane.',
  tourLearnTitle: 'Nauka',
  tourLearnDesc:
    'Tryb nauki: widzisz odpowiedź po wyborze. Poprawne pytanie znika z kolejki; błędne wraca na koniec.',
  tourTestTitle: 'Test',
  tourTestDesc: 'Losowy test z wybranego zakresu. Na końcu zobaczysz wynik — bez zapisywania postępu opanowania.',
  tourProgressTitle: 'Postęp nauki',
  tourProgressDesc:
    'Podgląd i ręczna edycja opanowanych pytań — dostępne w menu (☰) po zaznaczeniu zakresu.',
  tourQuestionCardTitle: 'Karta pytania',
  tourQuestionCardDesc:
    'Tutaj widzisz treść pytania. Przy pytaniach ze zdjęciem lub filmem pojawi się też podgląd materiału — warto go przeanalizować przed odpowiedzią.',
  tourQuestionAnswersTitle: 'Odpowiedzi',
  tourQuestionAnswersDesc:
    'Wybierz jedną odpowiedź. W trybie nauki od razu zobaczysz poprawny wynik; w teście wynik poznasz na końcu sesji.',
  tourHintTitle: 'Podpowiedź — ikona ?',
  tourHintDesc:
    'Kliknij ?, aby wyszukać pytanie w Google (nowa karta). Poczekaj chwilę na AI Overview u góry wyników — często podaje wyjaśnienie poprawnej odpowiedzi.',
  tourNext: 'Dalej',
  tourPrev: 'Wstecz',
  tourDone: 'Zaczynamy',
};

const en: Messages = {
  appTitle: 'Driving License',
  menuOpenAria: 'Open menu',
  menuCloseAria: 'Close menu',
  menuTitle: 'Menu',
  menuHome: 'Home',
  learnProgressMenu: 'Learning progress',
  menuReplayTutorial: 'Show tutorial again',
  pageTitleSuffix: ' — practice exam',
  loading: 'Loading question bank…',
  loadErr: 'Failed to load data: {{err}}.',
  loadErrHint:
    'Locally: symlink public/ to data/exam-all-modules-export.json. On GitHub Pages: the file must be in the build (Vite copies public/); media is optional.',
  questionsInPolishNotice: 'Question content is in Polish (official exam database).',
  scopeAllModules: 'all modules',
  scopeNoSelection: 'no modules selected',
  scopeModules: 'modules: {{ids}}',
  scopeModulesMore: 'modules: {{ids}}… (+{{more}})',
  moduleFallback: 'Module {{id}}',
  learnNoPending:
    'No questions to learn in this scope (all are already mastered). Reset learning progress for the scope or full database to start again.',
  confirmClearWrong: 'Clear all wrong-answer metrics (learn + exam)?',
  confirmMasteredModule:
    'This module is fully mastered. Reset module progress and add it to the learning scope from scratch?',
  confirmResetScopeAll: 'Reset learning progress (mastered) for the full database ({{count}} modules)?',
  confirmResetScopeSingle: 'Reset learning progress (mastered) for module {{id}}?',
  confirmResetScopeMultiple: 'Reset learning progress (mastered) for selected modules ({{count}}): {{ids}}?',
  confirmResetModuleInLearn: 'Reset learning progress for module {{id}}? The queue will reload.',
  confirmAbortExam: 'Abort the exam and return to the menu?',
  examIntroTitle: 'Basic exam flow information',
  examRule1: 'Exam duration: 25 minutes.',
  examRule2: 'Single-choice test.',
  examRule3: 'Questions have assigned weights — scoring depends on question importance.',
  examRule4:
    'For YES / NO answers: 20 s to read the question, then for video — playback after that time; 15 s to answer after the video ends (for image only — no video — 15 s from the end of the reading phase).',
  examRule5: 'For A, B, C answers: 50 s to answer.',
  examRule6: 'You cannot go back to questions or change an answer after selecting one.',
  examRule7:
    'The maximum score on the official state exam is 74; you need at least 68 points to pass. In a full-database simulation we use the same proportional threshold (weighted scoring in your session).',
  examScope: 'Scope: {{scope}} — {{count}} questions.',
  startExam: 'Start exam',
  back: 'Back',
  examResultTitle: 'Exam result',
  examPoints: 'Points: {{earned}} / {{max}}',
  examPassThreshold:
    'Threshold as on the state exam: {{pass}} / {{max}} pts (proportionally: {{percent}}% of correct scoring).',
  examPassed: 'Passed (by proportional threshold).',
  examFailed: 'Failed (by proportional threshold).',
  backToMenu: 'Back to menu',
  learnProgressTitle: 'Learning progress',
  learnProgressLead: 'Scope: {{scope}} · mastered: {{mastered}} / {{total}} ({{percent}}%)',
  learnProgressDetails: 'Details',
  learnProgressSelectModule: 'Select at least one module on the main menu to see progress.',
  moduleTitle: 'Module {{id}} — {{name}}',
  moduleMastered: 'Mastered: {{mastered}} / {{total}} ({{percent}}%)',
  moduleMarkAllTitle: 'Click to mark all questions in the module as mastered',
  moduleMarkAllAria: 'Mark all module questions as mastered',
  moduleClearAllTitle: 'Whole module mastered — click to mark all questions as to learn',
  moduleClearAllAria: 'Mark all module questions as to learn',
  questionToggleTitle: '{{text}} — click to {{action}}.',
  resetAll: 'Reset all',
  resetAllTitle: 'Clears mastery for all modules in the current scope (selected on the main menu).',
  metaQuestions: '{{questions}} questions · {{modules}} modules',
  moduleScope: 'Module scope',
  fullDatabase: 'Full database (all modules)',
  moduleListAria: 'Module selection list',
  modulePickHint: 'Select one or more modules (multiple at once).',
  scopeWarning: 'Select at least one module (list above).',
  learn: 'Learn',
  test: 'Test',
  learnProgressBtn: 'Learning progress — check ({{percent}}%)',
  wrongQuestions: 'Questions to review (learn + test + exam): {{count}}',
  reviewWrong: 'Review wrong',
  reviewWrongEmpty: 'No wrong questions to review in the selected scope.',
  reviewWrongFromTest: 'Review wrong from test',
  reviewWrongCountUnmastered: 'Unmastered questions (full database): {{count}}',
  testWrongMarked: '{{count}} questions marked as not mastered.',
  clearWrongMetrics: 'Clear error metrics',
  testResultTitle: 'Test result',
  testCorrect: 'Correct: {{ok}} / {{total}}',
  learnQueueEmpty: 'No questions in the learning queue. Return to the menu or reset learning progress for the scope.',
  noQuestionsInScope: 'No questions in the selected scope.',
  menu: 'Menu',
  examRemaining: 'Exam · time left: {{time}}',
  questionOf: 'Question {{current}} / {{total}}',
  phaseReading: 'Reading (20 s)',
  phasePlayback: 'Waiting for video to end — then 15 s to answer',
  phaseAnswer: 'Time to answer (15 s)',
  phaseAbc: 'Time to answer (50 s)',
  examTimeLabel: 'Exam time (25 min)',
  modeLearn: 'Learn',
  modeReviewWrong: 'Wrong answers review',
  modeTest: 'Test',
  modeExam: 'Exam',
  readingProgress: 'Reading question (20 s)',
  playbackHint: 'Finish watching — after the video ends, 15 s to answer starts.',
  answerYesNoProgress: 'YES / NO answer (15 s)',
  answerAbcProgress: 'A / B / C answer (50 s)',
  searchGoogleAria: 'Search this question on Google (new tab)',
  searchGoogleTitle: 'Search this question on Google (new tab)',
  questionHint: 'Hint',
  feedbackCorrect: 'Correct.',
  feedbackWrong: 'Wrong. Correct answer: {{answer}}',
  feedbackWrongShort: 'Wrong. Correct: {{answer}}',
  prev: 'Back',
  next: 'Next',
  finishTest: 'Finish test',
  end: 'End',
  resetModule: 'Reset module',
  resetModuleTitle: 'Clear mastered questions in this module and reload the learning queue',
  abortExam: 'Abort exam',
  markAsToLearn: 'mark as to learn',
  markAsMastered: 'mark as mastered',
  langSwitch: 'Language',
  langPl: 'Polski',
  langEn: 'English',
  tourWelcomeTitle: 'Welcome to Driving License',
  tourWelcomeDesc:
    'A quick tour of the app. Official exam question bank — pick modules and start learning or take a test.',
  tourLangTitle: 'Language',
  tourLangDesc: 'Switch the interface between Polish and English. Question content stays from the Polish exam database.',
  tourMenuTitle: 'Menu',
  tourMenuDesc:
    'Settings: interface language, learning progress (after selecting modules), and replay the guided tour.',
  tourScopeTitle: 'Module scope',
  tourScopeDesc: 'Check “Full database” to practice all modules, or pick specific modules from the list below.',
  tourModulesTitle: 'Module list',
  tourModulesDesc:
    'Select one or more modules. A ✓ icon means all questions in that module are already mastered.',
  tourLearnTitle: 'Learn',
  tourLearnDesc:
    'Learning mode: you see the answer after choosing. Correct questions leave the queue; wrong ones go to the end.',
  tourTestTitle: 'Test',
  tourTestDesc: 'Random test from your scope. You get a score at the end — mastery progress is not updated.',
  tourProgressTitle: 'Learning progress',
  tourProgressDesc:
    'Review and manually toggle mastered questions — available in the menu (☰) after you select a scope.',
  tourQuestionCardTitle: 'Question card',
  tourQuestionCardDesc:
    'This is the question text. When the item includes an image or video, it appears here too — review it before answering.',
  tourQuestionAnswersTitle: 'Answers',
  tourQuestionAnswersDesc:
    'Pick one answer. In Learn mode you see the result right away; in Test mode you get your score at the end.',
  tourHintTitle: 'Hint — the ? icon',
  tourHintDesc:
    'Tap ? to search the question on Google (new tab). Wait a moment for the AI Overview at the top of the results — it often explains the correct answer.',
  tourNext: 'Next',
  tourPrev: 'Back',
  tourDone: 'Get started',
};

const catalogs: Record<Locale, Messages> = { pl, en };

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>
): string {
  let text = catalogs[locale][key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{{${name}}}`, String(value));
    }
  }
  return text;
}
