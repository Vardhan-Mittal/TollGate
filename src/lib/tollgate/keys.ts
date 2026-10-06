import { createHash, randomBytes } from "node:crypto";

const PREFIX = "tg_agent_";

export function generateAgentKey() {
  const key = PREFIX + randomBytes(24).toString("base64url");
  return { key, hash: hashAgentKey(key), prefix: key.slice(0, PREFIX.length + 6) };
}

export function hashAgentKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function readBearerKey(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (!auth) return null;
  const [scheme, value] = auth.split(" ");
  return scheme?.toLowerCase() === "bearer" && value?.startsWith(PREFIX) ? value : null;
}
