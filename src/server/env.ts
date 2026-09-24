import { type Env, parseEnv } from "./env-schema";

export type { Env } from "./env-schema";

/**
 * Validated once at import time so a missing or malformed variable fails
 * fast at startup instead of at the first query.
 */
export const env: Env = parseEnv(process.env);
