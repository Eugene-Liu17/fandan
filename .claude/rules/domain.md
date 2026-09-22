---
paths: ["src/domain/**"]
---

# Domain layer rules

- Pure functions only. No I/O: no `fetch`, no database client, no file
  system, no `console.log` as a side effect of business logic.
- Never import from `next`, `react`, `ai`, `@ai-sdk/*`, `drizzle-orm`,
  `postgres`, or anything under `src/server`. `pnpm run check:boundaries`
  enforces this — a violation fails the build even if the import is
  written as a relative path.
- Time and randomness are never read implicitly (`Date.now()`,
  `Math.random()`, `new Date()` with no argument). Always take them as
  parameters, so every case is reproducible in a test. See
  `src/domain/week.ts` for the pattern.
- Every exported function has a unit test. Cover the edge cases that
  matter for this domain specifically: empty pantry, an entire week
  eaten out, an allergy conflict, a dedupe window of 0 or 1 day.
- Allergy and restriction filtering lives here, never only in a prompt
  (see CLAUDE.md).
