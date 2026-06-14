import { driver, type Driver, type DriveStep, type PopoverDOM } from 'driver.js';
import 'driver.js/dist/driver.css';
import type { MessageKey } from './i18n/messages';
import { translate } from './i18n/messages';
import type { Locale } from './i18n/types';

export const TUTORIAL_CARD_PANEL_SELECTOR = '[data-tour="tutorial-question-card"]';
export const TUTORIAL_CARD_ANSWERS_SELECTOR = '[data-tour="tutorial-question-answers"]';
export const TUTORIAL_LEARN_HINT_SELECTOR = '[data-tour="question-hint-btn"]';
const TUTORIAL_SETUP_ANCHOR_SELECTOR = '[data-tour="btn-test"]';

const SETUP_OFFERED_KEY = 'prawko.tutorialSetupOffered.v1';
const HINT_SEEN_KEY = 'prawko.tutorialHintSeen.v1';
const LEGACY_SEEN_KEY = 'prawko.tutorialSeen.v1';

type TranslateFn = (key: MessageKey) => string;

export type TutorialHooks = {
  onEnterDemoLearn?: () => void | Promise<void>;
  onExitDemoLearn?: () => void | Promise<void>;
  onDone?: () => void;
};

type TutorialCtx = {
  demoActive: boolean;
  hintCompleted: boolean;
  restarting: boolean;
  setupStepCount: number;
  driveAt: (index: number) => void;
};

function migrateLegacyTutorialKeys(): void {
  try {
    if (localStorage.getItem(LEGACY_SEEN_KEY) === '1') {
      localStorage.setItem(SETUP_OFFERED_KEY, '1');
      localStorage.setItem(HINT_SEEN_KEY, '1');
      localStorage.removeItem(LEGACY_SEEN_KEY);
    }
  } catch {
    /* private mode */
  }
}

export function hasSetupTutorialOffered(): boolean {
  migrateLegacyTutorialKeys();
  try {
    return localStorage.getItem(SETUP_OFFERED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markSetupTutorialOffered(): void {
  try {
    localStorage.setItem(SETUP_OFFERED_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function hasHintTutorialSeen(): boolean {
  migrateLegacyTutorialKeys();
  try {
    return localStorage.getItem(HINT_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markHintTutorialSeen(): void {
  try {
    localStorage.setItem(HINT_SEEN_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function waitForElement(selector: string, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const ready = () => {
      const el = document.querySelector(selector);
      return el && el.getBoundingClientRect().width > 0;
    };
    if (ready()) {
      resolve();
      return;
    }
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      if (ready()) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error(`waitForElement timeout: ${selector}`));
        return;
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}

function buildSetupSteps(t: TranslateFn): DriveStep[] {
  return [
    {
      element: '[data-tour="app-intro"]',
      popover: {
        title: t('tourWelcomeTitle'),
        description: t('tourWelcomeDesc'),
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="app-menu-btn"]',
      popover: {
        title: t('tourMenuTitle'),
        description: t('tourMenuDesc'),
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '[data-tour="module-scope"]',
      popover: {
        title: t('tourScopeTitle'),
        description: t('tourScopeDesc'),
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="module-list"]',
      popover: {
        title: t('tourModulesTitle'),
        description: t('tourModulesDesc'),
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="btn-learn"]',
      popover: {
        title: t('tourLearnTitle'),
        description: t('tourLearnDesc'),
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="btn-test"]',
      popover: {
        title: t('tourTestTitle'),
        description: t('tourTestDesc'),
        side: 'top',
        align: 'start',
      },
    },
  ];
}

function buildCardSteps(t: TranslateFn): DriveStep[] {
  return [
    {
      element: TUTORIAL_CARD_PANEL_SELECTOR,
      disableActiveInteraction: true,
      popover: {
        title: t('tourQuestionCardTitle'),
        description: t('tourQuestionCardDesc'),
        side: 'top',
        align: 'start',
      },
    },
    {
      element: TUTORIAL_CARD_ANSWERS_SELECTOR,
      disableActiveInteraction: true,
      popover: {
        title: t('tourQuestionAnswersTitle'),
        description: t('tourQuestionAnswersDesc'),
        side: 'top',
        align: 'start',
      },
    },
    {
      element: TUTORIAL_LEARN_HINT_SELECTOR,
      disableActiveInteraction: true,
      popover: {
        title: t('tourHintTitle'),
        description: t('tourHintDesc'),
        side: 'top',
        align: 'start',
      },
    },
  ];
}

function createDriverOptions(t: TranslateFn) {
  return {
    showProgress: true,
    animate: true,
    smoothScroll: true,
    overlayOpacity: 0.72,
    stagePadding: 8,
    stageRadius: 10,
    popoverClass: 'prawko-tour-popover',
    nextBtnText: t('tourNext'),
    prevBtnText: t('tourPrev'),
    doneBtnText: t('tourDone'),
  } as const;
}

function cleanupTutorialUi(): void {
  document.body.classList.remove('tutorial-demo-active');
}

function isCardStep(index: number, setupStepCount: number): boolean {
  return index >= setupStepCount;
}

async function enterDemo(hooks: TutorialHooks): Promise<void> {
  await hooks.onEnterDemoLearn?.();
  document.body.classList.add('tutorial-demo-active');
}

async function exitDemo(hooks: TutorialHooks): Promise<void> {
  document.body.classList.remove('tutorial-demo-active');
  await hooks.onExitDemoLearn?.();
  await waitForElement(TUTORIAL_SETUP_ANCHOR_SELECTOR);
}

function renderTourDots(popover: PopoverDOM, driverObj: Driver, ctx: TutorialCtx, hooks: TutorialHooks): void {
  const steps = driverObj.getConfig().steps ?? [];
  const activeIndex = driverObj.getActiveIndex() ?? 0;
  const total = steps.length;
  if (total <= 1) return;

  let dotsRow = popover.footer.querySelector<HTMLDivElement>('.tour-dots');
  if (!dotsRow) {
    dotsRow = document.createElement('div');
    dotsRow.className = 'tour-dots';
    popover.footer.insertBefore(dotsRow, popover.footerButtons);
  }

  dotsRow.replaceChildren();
  for (let i = 0; i < total; i += 1) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `tour-dot${i === activeIndex ? ' tour-dot--active' : ''}`;
    dot.setAttribute('aria-label', `${i + 1} / ${total}`);
    dot.setAttribute('aria-current', i === activeIndex ? 'step' : 'false');
    dot.addEventListener('click', () => {
      if (i === activeIndex) return;
      void (async () => {
        const fromCard = isCardStep(activeIndex, ctx.setupStepCount);
        const toCard = isCardStep(i, ctx.setupStepCount);
        try {
          if (fromCard && !toCard && ctx.demoActive) {
            await exitDemo(hooks);
            ctx.demoActive = false;
          } else if (toCard && !fromCard && !ctx.demoActive) {
            await enterDemo(hooks);
            ctx.demoActive = true;
          }
          ctx.driveAt(i);
        } catch {
          /* driveAt handles destroy on failure */
        }
      })();
    });
    dotsRow.appendChild(dot);
  }
}

function attachBoundaryHooks(
  steps: DriveStep[],
  ctx: TutorialCtx,
  hooks: TutorialHooks
): DriveStep[] {
  const lastSetupIndex = ctx.setupStepCount - 1;
  const firstCardIndex = ctx.setupStepCount;
  const lastIndex = steps.length - 1;

  return steps.map((step, index) => {
    const popover = { ...step.popover };

    if (index === lastSetupIndex && ctx.setupStepCount > 0) {
      popover.onNextClick = () => {
        void (async () => {
          try {
            if (!ctx.demoActive) {
              await enterDemo(hooks);
              ctx.demoActive = true;
            }
            ctx.driveAt(firstCardIndex);
          } catch {
            ctx.restarting = false;
          }
        })();
      };
    }

    if (index === firstCardIndex) {
      popover.onPrevClick = () => {
        void (async () => {
          try {
            if (ctx.demoActive) {
              await exitDemo(hooks);
              ctx.demoActive = false;
            }
            ctx.driveAt(lastSetupIndex);
          } catch {
            ctx.restarting = false;
          }
        })();
      };
    }

    if (index === lastIndex) {
      popover.onNextClick = (_el, _s, { driver: d }) => {
        ctx.hintCompleted = true;
        d.destroy();
      };
    }

    return { ...step, popover };
  });
}

function runTutorial(locale: Locale, steps: DriveStep[], hooks: TutorialHooks, setupStepCount: number): void {
  const t: TranslateFn = (key) => translate(locale, key);
  const ctx: TutorialCtx = {
    demoActive: false,
    hintCompleted: false,
    restarting: false,
    setupStepCount,
    driveAt: () => {},
  };

  let activeDriver: Driver | null = null;

  const driveAt = (index: number) => {
    ctx.restarting = true;
    activeDriver?.destroy();
    ctx.restarting = false;
    const stepsWithHooks = attachBoundaryHooks(steps, ctx, hooks);
    activeDriver = driver({
      ...createDriverOptions(t),
      steps: stepsWithHooks,
      onPopoverRender: (popover, { driver: d }) => {
        renderTourDots(popover, d, ctx, hooks);
      },
      onDestroyed: () => {
        cleanupTutorialUi();
        if (ctx.restarting) return;
        if (ctx.demoActive) void hooks.onExitDemoLearn?.();
        markSetupTutorialOffered();
        if (ctx.hintCompleted) markHintTutorialSeen();
        hooks.onDone?.();
      },
    });
    activeDriver.drive(index);
  };

  ctx.driveAt = driveAt;
  driveAt(0);
}

export function startSetupTutorial(locale: Locale, hooks: TutorialHooks = {}): void {
  const t: TranslateFn = (key) => translate(locale, key);
  const setupSteps = buildSetupSteps(t).filter((step) => {
    if (!step.element || typeof step.element !== 'string') return true;
    return document.querySelector(step.element) !== null;
  });
  const steps = [...setupSteps, ...buildCardSteps(t)];
  if (setupSteps.length === 0) return;
  runTutorial(locale, steps, hooks, setupSteps.length);
}

/** Tylko kroki karty (7–9) — gdy ktoś pominął pełny tutorial. */
export function startCardOnlyTutorial(locale: Locale): void {
  const t: TranslateFn = (key) => translate(locale, key);
  const steps = buildCardSteps(t);
  let hintCompleted = false;
  const lastIndex = steps.length - 1;

  void (async () => {
    try {
      await waitForElement(TUTORIAL_CARD_PANEL_SELECTOR);
      document.body.classList.add('tutorial-demo-active');

      const stepsWithDone = steps.map((step, index) => {
        if (index !== lastIndex) return step;
        return {
          ...step,
          popover: {
            ...step.popover,
            onNextClick: (_el: Element | undefined, _s: DriveStep, { driver: d }: { driver: Driver }) => {
              hintCompleted = true;
              d.destroy();
            },
          },
        };
      });

      const driverObj = driver({
        ...createDriverOptions(t),
        steps: stepsWithDone,
        onDestroyed: () => {
          cleanupTutorialUi();
          if (hintCompleted) markHintTutorialSeen();
        },
      });

      driverObj.drive();
    } catch {
      cleanupTutorialUi();
    }
  })();
}
