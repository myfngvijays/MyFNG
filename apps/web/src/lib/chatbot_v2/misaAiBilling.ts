export type MisaAiModelPricing = {
  inputPer1M: number;
  outputPer1M: number;
};

export const MISA_AI_MODEL_PRICING_USD: Record<string, MisaAiModelPricing> = {
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4.1': { inputPer1M: 2, outputPer1M: 8 },
  'gpt-4.1-mini': { inputPer1M: 0.4, outputPer1M: 1.6 },
};

export const DEFAULT_MISA_AI_USD_INR_RATE = 85;

export function getMisaAiUsdInrRate(): number {
  const raw = Number(process.env.MISA_AI_USD_INR_RATE || DEFAULT_MISA_AI_USD_INR_RATE);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MISA_AI_USD_INR_RATE;
}

export function estimateMisaAiCostUsd(input: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const model = String(input.model || 'gpt-4o').trim();
  const pricing =
    MISA_AI_MODEL_PRICING_USD[model] ||
    MISA_AI_MODEL_PRICING_USD[Object.keys(MISA_AI_MODEL_PRICING_USD).find((key) => model.startsWith(key)) || ''] ||
    MISA_AI_MODEL_PRICING_USD['gpt-4o'];

  const promptTokens = Math.max(0, Number(input.promptTokens || 0));
  const completionTokens = Math.max(0, Number(input.completionTokens || 0));

  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;
  return Number((inputCost + outputCost).toFixed(6));
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(amount >= 1 ? 2 : 4)}`;
}

export function formatInrFromUsd(amountUsd: number, rate = getMisaAiUsdInrRate()): string {
  return `₹${Math.round(amountUsd * rate).toLocaleString('en-IN')}`;
}
