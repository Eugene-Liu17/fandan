import { z } from "zod";
import { addDays, isPlainDate, type PlainDate } from "@/domain/date";
import type { RecipeCandidate } from "@/domain/recipe";
import { type RankResult, rankCandidates } from "@/domain/scoring";
import { db } from "@/server/db/client";
import { findEatenDishes } from "@/server/db/repositories/meals";
import { findActivePantry } from "@/server/db/repositories/pantry";
import { findVisibleRecipes } from "@/server/db/repositories/recipes";
import { findActiveTasteFacts } from "@/server/db/repositories/taste-facts";
import { requireUser, restrictionsOf } from "./context";
import { parseInput } from "./errors";

/**
 * How far back past ratings are read for scoring. A data-loading bound, not
 * a business rule: dedupe applies its own window to the same history.
 */
const RATING_HISTORY_DAYS = 180;

export const getCandidatesInputSchema = z.object({
  targetDate: z
    .string()
    .refine(isPlainDate, { message: "Expected a YYYY-MM-DD date" })
    .transform((s) => s as PlainDate),
  cravings: z.array(z.string()).default([]),
  limit: z.number().int().positive().max(100).default(20),
});

export type GetCandidatesInput = z.input<typeof getCandidatesInputSchema>;

/**
 * Candidate dishes for `targetDate`, best first. Allergies/restrictions and
 * dedupe are applied by the domain before any scoring, so no ranking can
 * surface an excluded dish (SPEC core principles 1 and 3).
 */
export async function getCandidates(
  userId: string,
  input: GetCandidatesInput,
  { random = Math.random }: { random?: () => number } = {},
): Promise<RankResult<RecipeCandidate>> {
  const { targetDate, cravings, limit } = parseInput(
    getCandidatesInputSchema,
    input,
  );
  const user = await requireUser(db, userId);
  const windowDays = user.dedupeWindowDays;

  const [recipes, facts, history, pantry] = await Promise.all([
    findVisibleRecipes(db, userId),
    findActiveTasteFacts(db, userId),
    findEatenDishes(
      db,
      userId,
      addDays(targetDate, -Math.max(RATING_HISTORY_DAYS, windowDays)),
      addDays(targetDate, windowDays + 1),
    ),
    findActivePantry(db, userId),
  ]);

  const result = rankCandidates({
    recipes,
    targetDate,
    restrictions: facts
      .filter((f) => f.type === "restriction")
      .flatMap(restrictionsOf),
    history,
    windowDays,
    pantry: pantry.map((p) => ({
      ingredientKey: p.ingredientKey,
      rawName: p.rawName,
    })),
    cravings,
    random,
  });
  return { ranked: result.ranked.slice(0, limit), excluded: result.excluded };
}
