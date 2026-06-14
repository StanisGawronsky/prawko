import { useCallback, useEffect, useId, useState } from 'react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from './i18n/context';

export type AppMenuConfig = {
  onGoHome?: () => void;
  isHome?: boolean;
  homeLabel?: string;
  onLearnProgress?: () => void;
  learnProgressDisabled?: boolean;
  learnProgressLabel?: string;
  onReplayTutorial?: () => void;
};

export function AppMenu({
  onGoHome,
  isHome = false,
  homeLabel,
  onLearnProgress,
  learnProgressDisabled = true,
  learnProgressLabel,
  onReplayTutorial,
}: AppMenuConfig) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header className="app-menu-bar">
      <button
        type="button"
        className="app-menu-btn"
        data-tour="app-menu-btn"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t('menuCloseAria') : t('menuOpenAria')}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            fill="currentColor"
            d="M4 7h16v1.75H4V7zm0 5.25h16V14H4v-1.75zm0 5.25h16V19H4v-1.75z"
          />
        </svg>
      </button>

      {open ? (
        <div className="app-menu-root" role="presentation" onClick={close}>
          <nav
            id={panelId}
            className="app-menu-panel"
            role="dialog"
            aria-label={t('menuTitle')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="app-menu-panel-head">
              <h2 className="app-menu-panel-title">{t('menuTitle')}</h2>
              <button type="button" className="app-menu-close" onClick={close} aria-label={t('menuCloseAria')}>
                ×
              </button>
            </div>

            {onGoHome ? (
              <section className="app-menu-section">
                <button
                  type="button"
                  className="app-menu-action"
                  data-tour="menu-go-home"
                  disabled={isHome}
                  onClick={() => {
                    close();
                    onGoHome();
                  }}
                >
                  {homeLabel ?? t('menuHome')}
                </button>
              </section>
            ) : null}

            <section className="app-menu-section">
              <h3 className="app-menu-section-label">{t('langSwitch')}</h3>
              <LanguageSwitcher onSwitch={close} />
            </section>

            <section className="app-menu-section">
              <button
                type="button"
                className="app-menu-action"
                data-tour="menu-learn-progress"
                disabled={learnProgressDisabled || !onLearnProgress}
                onClick={() => {
                  close();
                  onLearnProgress?.();
                }}
              >
                {learnProgressLabel ?? t('learnProgressMenu')}
              </button>
            </section>

            <section className="app-menu-section">
              <button
                type="button"
                className="app-menu-action secondary"
                data-tour="menu-replay-tutorial"
                disabled={!onReplayTutorial}
                onClick={() => {
                  close();
                  onReplayTutorial?.();
                }}
              >
                {t('menuReplayTutorial')}
              </button>
            </section>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
