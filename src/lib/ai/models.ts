import { google } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { APICallError, RetryError, type LanguageModel } from "ai";

// Gemini first; Groq (open-weight gpt-oss models) is the automatic fallback when Gemini is
// overloaded, rate-limited or simply too slow to answer. Ids are Gemini model names, or
// "groq:<model>" for Groq. Groq joins the lists only when GROQ_API_KEY is set.
const groq = createGroq();
const GROQ_FALLBACKS = process.env.GROQ_API_KEY ? ["groq:openai/gpt-oss-120b", "groq:openai/gpt-oss-20b"] : [];

// Pricing runs in the background, so it can use a stronger, slower model.
// The research agent runs live in front of the user, so it uses a fast one.
export const PRICING_MODELS = [process.env.AI_MODEL_PRICING ?? "gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", ...GROQ_FALLBACKS];
export const AGENT_MODELS = [process.env.AI_MODEL_AGENT ?? "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", ...GROQ_FALLBACKS];

const providerOf = (id: string) => (id.startsWith("groq:") ? "groq" : "gemini");
const resolve = (id: string): LanguageModel => (id.startsWith("groq:") ? groq(id.slice("groq:".length)) : google(id));

/** "groq:openai/gpt-oss-120b" → "openai/gpt-oss-120b (Groq)", for display. */
export const modelLabel = (id: string) => (id.startsWith("groq:") ? `${id.slice("groq:".length)} (Groq)` : id);

function unwrap(err: unknown) {
  return err instanceof RetryError ? err.lastError : err;
}

function isCapacityError(err: unknown): boolean {
  const inner = unwrap(err);
  return APICallError.isInstance(inner) && (inner.statusCode === 503 || inner.statusCode === 429);
}

/** Our own time limit fired, or the connection failed: worth trying another provider. */
function isTimeoutOrNetwork(err: unknown): boolean {
  for (let e: unknown = unwrap(err), depth = 0; e instanceof Error && depth < 4; e = e.cause, depth++) {
    if (e.name === "TimeoutError" || e.name === "AbortError" || /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(e.message)) {
      return true;
    }
  }
  return false;
}

/**
 * Runs `fn` with the first usable model in `ids`. Each attempt gets its own time limit
 * (pass `signal` to the AI call as `abortSignal`). On overload, rate limit, timeout or a
 * network failure it moves to the next model; a provider that timed out is skipped for the
 * rest of the call, since a hang usually affects all its models at once.
 */
export async function withModelFallback<T>(
  ids: string[],
  fn: (model: LanguageModel, modelId: string, signal: AbortSignal) => Promise<T>,
  { timeoutMs = 45_000 }: { timeoutMs?: number } = {},
): Promise<T> {
  const skip = new Set<string>();
  let lastError: unknown;
  for (const id of new Set(ids)) {
    if (skip.has(providerOf(id))) continue;
    try {
      return await fn(resolve(id), id, AbortSignal.timeout(timeoutMs));
    } catch (err) {
      const timedOut = isTimeoutOrNetwork(err);
      if (!timedOut && !isCapacityError(err)) throw err;
      if (timedOut) skip.add(providerOf(id));
      console.warn(`model ${id} ${timedOut ? "timed out or unreachable" : "is overloaded"}, falling back`);
      lastError = err;
    }
  }
  throw lastError;
}
