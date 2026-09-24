import { describe, expect, it } from "vitest";
import { parseEnv } from "./env-schema";

const base = { DATABASE_URL: "postgresql://u:p@localhost:5432/db" };

describe("parseEnv", () => {
  it("applies defaults when optional values are absent", () => {
    expect(parseEnv(base)).toEqual({
      ...base,
      MODEL_PLANNER: "claude-sonnet-5",
      MODEL_PARSER: "claude-haiku-4-5-20251001",
      DEDUPE_WINDOW_DAYS: 14,
    });
  });

  it('treats an empty value as unset (ANTHROPIC_API_KEY="" before M4)', () => {
    const env = parseEnv({ ...base, ANTHROPIC_API_KEY: "", MODEL_PLANNER: "" });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.MODEL_PLANNER).toBe("claude-sonnet-5");
  });

  it("keeps a real API key and coerces the dedupe window", () => {
    const env = parseEnv({
      ...base,
      ANTHROPIC_API_KEY: "sk-test",
      DEDUPE_WINDOW_DAYS: "7",
    });
    expect(env.ANTHROPIC_API_KEY).toBe("sk-test");
    expect(env.DEDUPE_WINDOW_DAYS).toBe(7);
  });

  it("fails on a missing or empty DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow();
    expect(() => parseEnv({ DATABASE_URL: "" })).toThrow();
  });
});
