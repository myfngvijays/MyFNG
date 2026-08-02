type TaskManagerModule = typeof import('expo-task-manager');

let cached: TaskManagerModule | null | undefined;

/** Lazy load — old dev builds without expo-task-manager native code won't crash. */
export function getTaskManager(): TaskManagerModule | null {
  if (cached !== undefined) return cached;
  try {
    cached = require('expo-task-manager') as TaskManagerModule;
  } catch {
    cached = null;
  }
  return cached;
}

export function isTaskManagerAvailable(): boolean {
  return getTaskManager() != null;
}
