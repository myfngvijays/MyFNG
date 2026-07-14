const DEFAULT_INTER_SEND_MS = 1200;

export async function throttleCronSends(index: number, interSendMs = DEFAULT_INTER_SEND_MS) {
  if (index <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, interSendMs));
}

export function cronBatchLimit(requested: number, maxPerRun = 20) {
  return Math.max(0, Math.min(requested, maxPerRun));
}
