// Bots used only to test Tollgate (the Spend Guardian simulation, load and race tests).
// Showcases and analytics leave their traffic out; the raw dashboard grid still shows it.
const TEST_BOT_PREFIXES = ["RunawayAgent/", "ScaleTestBot/", "RaceTest/"];
const TEST_BOT_NAMES = ["T"];

/** Prisma `where` fragment for rows with a `botName` column: keeps everything except test bots. */
export const notTestTraffic = {
  OR: [
    { botName: null },
    {
      NOT: {
        OR: [
          ...TEST_BOT_PREFIXES.map((prefix) => ({ botName: { startsWith: prefix } })),
          { botName: { in: TEST_BOT_NAMES } },
        ],
      },
    },
  ],
};

/** LIKE patterns for raw SQL, e.g. `NOT LIKE ALL(${testBotLikePatterns})`. */
export const testBotLikePatterns = [...TEST_BOT_PREFIXES.map((prefix) => `${prefix}%`), ...TEST_BOT_NAMES];
