import { z } from "zod";

/**
 * Server-side environment schema, kept apart from `env.ts` so it can be
 * tested without reading the real process environment.
 */
export const envSchema = z.object({
  DATABASE_URL: z.url(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  MODEL_PLANNER: z.string().min(1).default("claude-sonnet-5"),
  MODEL_PARSER: z.string().min(1).default("claude-haiku-4-5-20251001"),
  DEDUPE_WINDOW_DAYS: z.coerce.number().int().positive().default(14),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses an environment. An empty value counts as unset: `.env.example`
 * ships `ANTHROPIC_API_KEY=""`, which must not fail before M4 needs it.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== ""),
  );
  return envSchema.parse(cleaned);
}
