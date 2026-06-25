import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CAR_QUIZ_POOL,
  DAILY_QUIZ_QUESTION_COUNT,
  getDailyQuizQuestionIndices,
  getLocalDayKey,
  type QuizQuestion,
} from './smartToolsLogic';

const STORAGE_KEY = 'myfng_car_quiz_daily_v1';

export type CarQuizDailyProgress = {
  dayKey: string;
  poolIndices: number[];
  currentIndex: number;
  score: number;
  selections: Array<number | null>;
  completed: boolean;
  completedAt?: string;
};

function emptySelections(length: number): Array<number | null> {
  return Array.from({ length }, () => null);
}

function createFreshProgress(dayKey = getLocalDayKey()): CarQuizDailyProgress {
  const poolIndices = getDailyQuizQuestionIndices(dayKey);
  return {
    dayKey,
    poolIndices,
    currentIndex: 0,
    score: 0,
    selections: emptySelections(poolIndices.length),
    completed: false,
  };
}

function normalizeProgress(raw: unknown, dayKey: string): CarQuizDailyProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<CarQuizDailyProgress>;
  if (data.dayKey !== dayKey) return null;
  if (!Array.isArray(data.poolIndices) || data.poolIndices.length === 0) return null;

  const poolIndices = data.poolIndices
    .map((idx) => Number(idx))
    .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < CAR_QUIZ_POOL.length);

  if (poolIndices.length === 0) return null;

  const selections = emptySelections(poolIndices.length);
  if (Array.isArray(data.selections)) {
    data.selections.forEach((value, index) => {
      if (index >= selections.length) return;
      const parsed = Number(value);
      selections[index] = Number.isInteger(parsed) ? parsed : null;
    });
  }

  const currentIndex = Math.min(
    Math.max(0, Number(data.currentIndex) || 0),
    Math.max(0, poolIndices.length - 1),
  );
  const score = Math.min(
    Math.max(0, Number(data.score) || 0),
    poolIndices.length,
  );

  return {
    dayKey,
    poolIndices,
    currentIndex,
    score,
    selections,
    completed: Boolean(data.completed),
    completedAt: typeof data.completedAt === 'string' ? data.completedAt : undefined,
  };
}

export function resolveQuizQuestions(progress: CarQuizDailyProgress): QuizQuestion[] {
  return progress.poolIndices.map((idx) => CAR_QUIZ_POOL[idx]);
}

export async function loadCarQuizDailyProgress(): Promise<CarQuizDailyProgress> {
  const dayKey = getLocalDayKey();
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = normalizeProgress(JSON.parse(raw), dayKey);
      if (parsed) return parsed;
    }
  } catch {
    // fall through to fresh progress
  }

  const fresh = createFreshProgress(dayKey);
  await saveCarQuizDailyProgress(fresh);
  return fresh;
}

export async function saveCarQuizDailyProgress(progress: CarQuizDailyProgress): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export async function recordCarQuizAnswer(
  progress: CarQuizDailyProgress,
  optionIndex: number,
): Promise<CarQuizDailyProgress> {
  const questions = resolveQuizQuestions(progress);
  const question = questions[progress.currentIndex];
  if (!question || progress.completed) return progress;

  const selections = [...progress.selections];
  if (selections[progress.currentIndex] !== null) return progress;

  selections[progress.currentIndex] = optionIndex;
  const score = optionIndex === question.correct ? progress.score + 1 : progress.score;

  const next: CarQuizDailyProgress = {
    ...progress,
    selections,
    score,
  };
  await saveCarQuizDailyProgress(next);
  return next;
}

export async function advanceCarQuizProgress(progress: CarQuizDailyProgress): Promise<CarQuizDailyProgress> {
  const questions = resolveQuizQuestions(progress);
  const isLast = progress.currentIndex >= questions.length - 1;

  if (isLast) {
    const completed: CarQuizDailyProgress = {
      ...progress,
      completed: true,
      completedAt: new Date().toISOString(),
    };
    await saveCarQuizDailyProgress(completed);
    return completed;
  }

  const next: CarQuizDailyProgress = {
    ...progress,
    currentIndex: progress.currentIndex + 1,
  };
  await saveCarQuizDailyProgress(next);
  return next;
}

export function getQuizProgressPercent(progress: CarQuizDailyProgress): number {
  const total = Math.max(1, progress.poolIndices.length || DAILY_QUIZ_QUESTION_COUNT);
  if (progress.completed) return 100;
  const answered = progress.selections.filter((value) => value !== null).length;
  return Math.round((answered / total) * 100);
}

export function getQuizScoreMessage(score: number, total: number): string {
  const pct = Math.round((score / Math.max(1, total)) * 100);
  if (pct >= 80) return 'Car Expert!';
  if (pct >= 50) return 'Good Job!';
  return 'Keep Learning!';
}
