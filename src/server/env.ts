import { z } from "zod";

/**
 * Server-side environment schema. Validated once at import time so a
 * missing or malformed variable fails fast at startup instead of at the
 * first query.
 */
const envSchema = z.object({
  DATABASE_URL: z.url(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  MODEL_PLANNER: z.string().min(1).default("claude-sonnet-5"),
  MODEL_PARSER: z.string().min(1).default("claude-haiku-4-5-20251001"),
  DEDUPE_WINDOW_DAYS: z.coerce.number().int().positive().default(14),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
