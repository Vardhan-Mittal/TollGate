import { google } from "@ai-sdk/google";
import { APICallError, RetryError, type LanguageModel } from "ai";

// Pricing runs in the background, so it can use a stronger, slower model.
// The research agent runs live in front of the user, so it uses a fast one.
// Each list is tried in order; later entries are fallbacks for when Gemini
// reports a model as overloaded or rate-limited.
export const PRICING_MODELS = [process.env.AI_MODEL_PRICING ?? "gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
export const AGENT_MODELS = [process.env.AI_MODEL_AGENT ?? "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"];

function isCapacityError(err: unknown): boolean {
  const inner = err instanceof RetryError ? err.lastError : err;
  return APICallError.isInstance(inner) && (inner.statusCode === 503 || inner.statusCode === 429);
}

/** Runs `fn` with the first model in `ids` that is not overloaded. */
export async function withModelFallback<T>(
  ids: string[],
  fn: (model: LanguageModel, modelId: string) => Promise<T>,
): Promise<T> {
  const unique = [...new Set(ids)];
  let lastError: unknown;
  for (const id of unique) {
    try {
      return await fn(google(id), id);
    } catch (err) {
      if (!isCapacityError(err)) throw err;
      console.warn(`Gemini model ${id} is overloaded, falling back`);
      lastError = err;
    }
  }
  throw lastError;
}
