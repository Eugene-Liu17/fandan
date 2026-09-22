---
paths: ["src/app/**", "src/components/**"]
---

# UI layer rules

- Mobile-first: design and test the phone layout first, desktop only
  needs to remain usable.
- All product copy is Simplified Chinese. Prefer shadcn/ui components
  (`src/components/ui/`) over hand-rolled equivalents.
- Server Actions call `src/server/services` only — never
  `src/server/db` or `src/server/ai` directly.
  `pnpm run check:boundaries` enforces this.
- Key interactions (marking a meal, confirming a menu draft) need
  Playwright coverage under `e2e/`.
