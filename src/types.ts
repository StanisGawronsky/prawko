export interface ExamExportMeta {
  source?: string;
  mergedAt?: string;
  totalModules?: number;
  totalQuestions?: number;
}

export interface QuestionBody {
  id: number;
  text: string;
  answerA: string;
  answerB: string;
  answerC: string;
  predefinedAnswers: string[];
  correct: string;
  mediaFile: string;
  mediaType: string;
  questionType: string;
  points: number;
}

export interface MediaLocalSource {
  type?: string;
  path: string;
}

export interface MediaBlock {
  primaryUrl: string | null;
  imageUrl: string | null;
  allSources: { type: string; src: string }[];
  local: {
    primary: string | null;
    sources: MediaLocalSource[];
  };
}

export interface SummaryBlock {
  questionId: number;
  questionNumber: number;
  stem: string;
  answers: string[];
  correct: string;
  points: number;
  mediaKind: 'image' | 'video' | 'none' | string;
  mediaRelativePath: string | null;
}

export interface QuestionRow {
  module: { id: number; name: string };
  moduleId: string;
  questionNumber: number;
  question: QuestionBody;
  media: MediaBlock;
  summary: SummaryBlock;
}

export interface ModuleBlock {
  moduleId: number;
  meta: Record<string, unknown>;
  questions: QuestionRow[];
}

export interface ExamExport {
  meta: ExamExportMeta;
  modules: ModuleBlock[];
}
