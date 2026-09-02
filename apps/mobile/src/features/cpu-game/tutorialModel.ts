export type TutorialTopic = 'deal' | 'submit' | 'pass' | 'dayNight' | 'effects';

export type TutorialPageId = 'deal' | 'leadUpdate' | 'passClear' | 'dayNight' | 'skills';

export type TutorialPage = {
  id: TutorialPageId;
  titleKey: string;
  bodyKey: string;
  imageAssetId: string;
  topics: readonly TutorialTopic[];
};

export type TutorialProgress = {
  completed: boolean;
  completedAt: string | null;
};

export const CPU_GAME_TUTORIAL_STORAGE_KEY = 'card-game-app:cpu-game-tutorial:v1';

export const REQUIRED_TUTORIAL_TOPICS: readonly TutorialTopic[] = [
  'deal',
  'submit',
  'pass',
  'dayNight',
  'effects',
];

export const DEFAULT_TUTORIAL_PROGRESS: TutorialProgress = {
  completed: false,
  completedAt: null,
};

export const CPU_GAME_TUTORIAL_PAGES: readonly TutorialPage[] = [
  {
    id: 'deal',
    titleKey: 'cpuGame.tutorial.page.deal.title',
    bodyKey: 'cpuGame.tutorial.page.deal.body',
    imageAssetId: 'm3-tutorial-history-stats',
    topics: ['deal'],
  },
  {
    id: 'leadUpdate',
    titleKey: 'cpuGame.tutorial.page.leadUpdate.title',
    bodyKey: 'cpuGame.tutorial.page.leadUpdate.body',
    imageAssetId: 'm3-tutorial-lead-update',
    topics: ['submit'],
  },
  {
    id: 'passClear',
    titleKey: 'cpuGame.tutorial.page.passClear.title',
    bodyKey: 'cpuGame.tutorial.page.passClear.body',
    imageAssetId: 'm3-tutorial-locks',
    topics: ['pass'],
  },
  {
    id: 'dayNight',
    titleKey: 'cpuGame.tutorial.page.dayNight.title',
    bodyKey: 'cpuGame.tutorial.page.dayNight.body',
    imageAssetId: 'm3-tutorial-strength-order',
    topics: ['dayNight'],
  },
  {
    id: 'skills',
    titleKey: 'cpuGame.tutorial.page.skills.title',
    bodyKey: 'cpuGame.tutorial.page.skills.body',
    imageAssetId: 'm3-tutorial-skills',
    topics: ['effects'],
  },
];

export function tutorialCoversRequiredTopics(
  pages: readonly TutorialPage[] = CPU_GAME_TUTORIAL_PAGES,
): boolean {
  const covered = new Set<TutorialTopic>();
  for (const page of pages) {
    for (const topic of page.topics) covered.add(topic);
  }
  return REQUIRED_TUTORIAL_TOPICS.every((topic) => covered.has(topic));
}

export function clampTutorialIndex(
  index: number,
  pages: readonly TutorialPage[] = CPU_GAME_TUTORIAL_PAGES,
): number {
  if (pages.length === 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(Math.trunc(index), pages.length - 1));
}

export function parseTutorialProgress(raw: string | null): TutorialProgress {
  if (!raw) return DEFAULT_TUTORIAL_PROGRESS;
  try {
    const parsed = JSON.parse(raw) as Partial<TutorialProgress>;
    if (parsed.completed !== true || typeof parsed.completedAt !== 'string') {
      return DEFAULT_TUTORIAL_PROGRESS;
    }
    return { completed: true, completedAt: parsed.completedAt };
  } catch {
    return DEFAULT_TUTORIAL_PROGRESS;
  }
}

export function serializeTutorialProgress(completedAtMillis: number): string {
  return JSON.stringify({
    completed: true,
    completedAt: new Date(completedAtMillis).toISOString(),
  });
}
