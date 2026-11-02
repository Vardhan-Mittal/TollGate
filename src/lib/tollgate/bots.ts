import { HEADERS } from "./protocol";

// User-agent tokens of well-known AI crawlers and assistants. Matching is a
// case-insensitive substring check, so "Mozilla/5.0 ... GPTBot/1.1" matches.
const KNOWN_AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Google-CloudVertexBot",
  "CCBot",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended",
  "meta-externalagent",
  "Meta-ExternalFetcher",
  "cohere-ai",
  "Diffbot",
  "YouBot",
  "Timpibot",
  "ImagesiftBot",
] as const;

// Agent and bot names show on public boards and reach the finance assistant,
// so only plain label characters are kept; anything else gets a generic name.
export const NAME_PATTERN = /^[A-Za-z0-9._\/ ()-]{1,40}$/;
const UNNAMED_DECLARED_AGENT = "Self-declared agent";

export type BotDetection =
  | { isBot: false }
  | { isBot: true; botName: string; via: "user-agent" | "tollgate-header" };

export function detectBot(headers: Headers): BotDetection {
  const declared = headers.get(HEADERS.agent)?.trim();
  if (declared) {
    return { isBot: true, botName: NAME_PATTERN.test(declared) ? declared : UNNAMED_DECLARED_AGENT, via: "tollgate-header" };
  }

  const ua = headers.get("user-agent") ?? "";
  const lower = ua.toLowerCase();
  const match = KNOWN_AI_BOTS.find((bot) => lower.includes(bot.toLowerCase()));
  if (match) return { isBot: true, botName: match, via: "user-agent" };

  return { isBot: false };
}
