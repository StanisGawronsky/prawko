import { isLocale, type Locale } from './i18n/types';

export type Mode = 'setup' | 'learn' | 'learnWrong' | 'test' | 'examIntro' | 'exam' | 'examResult';
export type SetupScreen = 'main' | 'learnProgress';

export type AppRoute = {
  mode: Mode;
  setupScreen: SetupScreen;
};

const SEGMENT_BY_MODE: Record<Exclude<Mode, 'setup'>, string> = {
  learn: 'learn',
  learnWrong: 'review',
  test: 'test',
  examIntro: 'exam',
  exam: 'exam/run',
  examResult: 'exam/result',
};

export function parseAppSubpath(subpath: string | undefined): AppRoute {
  const path = (subpath ?? '').replace(/^\/+|\/+$/g, '');
  switch (path) {
    case '':
      return { mode: 'setup', setupScreen: 'main' };
    case 'progress':
      return { mode: 'setup', setupScreen: 'learnProgress' };
    case 'learn':
      return { mode: 'learn', setupScreen: 'main' };
    case 'review':
      return { mode: 'learnWrong', setupScreen: 'main' };
    case 'test':
      return { mode: 'test', setupScreen: 'main' };
    case 'exam':
      return { mode: 'examIntro', setupScreen: 'main' };
    case 'exam/run':
      return { mode: 'exam', setupScreen: 'main' };
    case 'exam/result':
      return { mode: 'examResult', setupScreen: 'main' };
    default:
      return { mode: 'setup', setupScreen: 'main' };
  }
}

export function buildAppSubpath(mode: Mode, setupScreen: SetupScreen = 'main'): string {
  if (mode === 'setup') {
    return setupScreen === 'learnProgress' ? 'progress' : '';
  }
  return SEGMENT_BY_MODE[mode];
}

export function buildLocalePath(locale: Locale, mode: Mode, setupScreen: SetupScreen = 'main'): string {
  const sub = buildAppSubpath(mode, setupScreen);
  return sub ? `/${locale}/${sub}` : `/${locale}`;
}

export function swapLocaleInPath(pathname: string, nextLocale: Locale): string {
  const parts = pathname.split('/').filter(Boolean);
  const localeIdx = parts.findIndex((part) => isLocale(part));
  if (localeIdx === -1) return `/${nextLocale}${parts.length ? `/${parts.join('/')}` : ''}`;
  parts[localeIdx] = nextLocale;
  return `/${parts.join('/')}`;
}

export function examDataFileForLocale(locale: Locale): string {
  return locale === 'en' ? 'exam-all-modules-export.en.json' : 'exam-all-modules-export.json';
}
