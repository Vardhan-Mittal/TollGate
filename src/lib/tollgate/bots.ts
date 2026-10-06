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

export type BotDetection =
  | { isBot: false }
  | { isBot: true; botName: string; via: "user-agent" | "tollgate-header" };

export function detectBot(headers: Headers): BotDetection {
  const declared = headers.get(HEADERS.agent);
  if (declared) return { isBot: true, botName: declared.slice(0, 64), via: "tollgate-header" };

  const ua = headers.get("user-agent") ?? "";
  const lower = ua.toLowerCase();
  const match = KNOWN_AI_BOTS.find((bot) => lower.includes(bot.toLowerCase()));
  if (match) return { isBot: true, botName: match, via: "user-agent" };

  return { isBot: false };
}
