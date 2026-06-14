export const LOCALES = ['pl', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function detectDefaultLocale(): Locale {
  const lang = navigator.language?.toLowerCase() ?? '';
  return lang.startsWith('en') ? 'en' : 'pl';
}
