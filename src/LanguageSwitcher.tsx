import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from './i18n/context';
import { LOCALES, type Locale } from './i18n/types';
import { swapLocaleInPath } from './routing';

export function LanguageSwitcher({ onSwitch }: { onSwitch?: () => void }) {
  const { locale, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  const switchTo = (next: Locale) => {
    if (next === locale) return;
    onSwitch?.();
    navigate(swapLocaleInPath(location.pathname, next) + location.search, { replace: true });
  };

  return (
    <nav className="lang-switch lang-switch--in-menu" aria-label={t('langSwitch')} data-tour="lang-switch">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className={`lang-switch-btn${code === locale ? ' lang-switch-btn--active' : ''}`}
          aria-current={code === locale ? 'true' : undefined}
          onClick={() => switchTo(code)}
        >
          {code === 'pl' ? t('langPl') : t('langEn')}
        </button>
      ))}
    </nav>
  );
}
