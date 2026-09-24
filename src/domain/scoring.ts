/**
 * Candidate dish ranking for a menu slot.
 *
 * Hard filters run first and cannot be outweighed by any score: the
 * unmapped-ingredient quarantine, restrictions (allergies and diet rules),
 * then dedupe. Only the survivors are scored.
 * Composing a meal (one meat, one vegetable, one soup) is draft generation,
 * not ranking.
 */

import type { PlainDate } from "./date";
import { dedupeCandidates, type EatenDish, type Repeat } from "./dedupe";
import { isStandardCondiment } from "./ingredients/condiments";
import { normalizeIngredient, normalizeName } from "./ingredients/normalize";
import {
  type RecipeCandidate,
  resolveIngredientKey,
  unmappedIngredients,
} from "./recipe";
import {
  filterByRestrictions,
  type Restriction,
  type Violation,
} from "./restrictions";
import {
  ingredientIdentity,
  type PantryItem,
  pantryIdentities,
} from "./shopping-list";

/** Initial weights; tuned in M4 against real drafts. */
export const SCORE_WEIGHTS = {
  /** × share of main ingredients already in the pantry (0–1). */
  pantryCoverage: 3,
  /** × past average rating mapped to -1…1 ((avg − 3) / 2). */
  rating: 1,
  /** + when the recipe matches a stated craving. */
  craving: 2,
  /** × random() in [0, 1), only to vary ties between equal candidates. */
  jitter: 0.1,
} as const;

export interface RankInput<T extends RecipeCandidate> {
  recipes: readonly T[];
  targetDate: PlainDate;
  restrictions: readonly Restriction[];
  history: readonly EatenDish[];
  windowDays: number;
  pantry: readonly PantryItem[];
  /** Free-text cravings, e.g. "排骨" or "酸辣". */
  cravings: readonly string[];
  /** Returns a number in [0, 1). Passed in so rankings are reproducible. */
  random: () => number;
}

export interface ScoreBreakdown {
  pantryCoverage: number;
  rating: number;
  craving: number;
  jitter: number;
}

export interface RankedCandidate<T extends RecipeCandidate> {
  recipe: T;
  score: number;
  breakdown: ScoreBreakdown;
}

export type Exclusion<T extends RecipeCandidate> =
  | { recipe: T; reason: "unmapped_ingredient"; ingredients: string[] }
  | { recipe: T; reason: "restriction"; violations: Violation[] }
  | { recipe: T; reason: "repeat"; repeat: Repeat };

export interface RankResult<T extends RecipeCandidate> {
  ranked: RankedCandidate<T>[];
  excluded: Exclusion<T>[];
}

/** Share (0–1) of a recipe's non-condiment main ingredients in the pantry. */
export function pantryCoverage(
  recipe: RecipeCandidate,
  have: ReadonlySet<string>,
): number {
  const mains = recipe.ingredients
    .filter((i) => i.role === "main")
    .map((i) => ({ key: resolveIngredientKey(i), raw: i.raw_name }))
    .filter(({ key }) => key === null || !isStandardCondiment(key))
    .map(({ key, raw }) => ingredientIdentity(key, raw))
    .filter((id): id is string => id !== null);
  if (mains.length === 0) return 0;
  return mains.filter((id) => have.has(id)).length / mains.length;
}

/** The recipe's average past rating mapped to -1…1, or 0 when never rated. */
export function ratingSignal(
  recipe: RecipeCandidate,
  history: readonly EatenDish[],
): number {
  const ratings = history
    .filter((d) => d.recipeId === recipe.id && d.rating !== null)
    .map((d) => d.rating as number);
  if (ratings.length === 0) return 0;
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return (avg - 3) / 2;
}

/**
 * True when any craving appears in the recipe name, or names one of the
 * recipe's main ingredients (through the dictionary, so 猪五花 finds 红烧肉).
 */
export function matchesCraving(
  recipe: RecipeCandidate,
  cravings: readonly string[],
): boolean {
  const recipeName = normalizeName(recipe.name);
  const mainKeys = new Set<string>(
    recipe.ingredients
      .filter((i) => i.role === "main")
      .map(resolveIngredientKey)
      .filter((k): k is NonNullable<typeof k> => k !== null),
  );
  if (recipe.features?.main_ingredient) {
    mainKeys.add(recipe.features.main_ingredient);
  }
  return cravings.some((raw) => {
    const craving = normalizeName(raw);
    if (craving.length === 0) return false;
    if (recipeName.includes(craving)) return true;
    const mapped = normalizeIngredient(craving);
    return mapped.kind === "mapped" && mainKeys.has(mapped.key);
  });
}

/**
 * Filters and ranks `recipes` for `targetDate`, best first. Ties are broken
 * by recipe id so the order is fully determined by the inputs.
 */
export function rankCandidates<T extends RecipeCandidate>(
  input: RankInput<T>,
): RankResult<T> {
  // Quarantine first: a recipe with an ingredient the dictionary does not
  // know cannot be vouched for by the allergy filter, for any user.
  const quarantined: Exclusion<T>[] = [];
  const mapped: T[] = [];
  for (const recipe of input.recipes) {
    const unknown = unmappedIngredients(recipe);
    if (unknown.length === 0) mapped.push(recipe);
    else {
      quarantined.push({
        recipe,
        reason: "unmapped_ingredient",
        ingredients: unknown,
      });
    }
  }

  const restricted = filterByRestrictions(mapped, input.restrictions);
  const deduped = dedupeCandidates(
    restricted.allowed,
    input.targetDate,
    input.history,
    input.windowDays,
  );
  const have = pantryIdentities(input.pantry);

  const ranked = deduped.allowed.map((recipe) => {
    const breakdown: ScoreBreakdown = {
      pantryCoverage:
        pantryCoverage(recipe, have) * SCORE_WEIGHTS.pantryCoverage,
      rating: ratingSignal(recipe, input.history) * SCORE_WEIGHTS.rating,
      craving: matchesCraving(recipe, input.cravings)
        ? SCORE_WEIGHTS.craving
        : 0,
      jitter: input.random() * SCORE_WEIGHTS.jitter,
    };
    const score =
      breakdown.pantryCoverage +
      breakdown.rating +
      breakdown.craving +
      breakdown.jitter;
    return { recipe, score, breakdown };
  });

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      (a.recipe.id < b.recipe.id ? -1 : a.recipe.id > b.recipe.id ? 1 : 0),
  );

  return {
    ranked,
    excluded: [
      ...quarantined,
      ...restricted.excluded.map(({ recipe, violations }) => ({
        recipe,
        reason: "restriction" as const,
        violations,
      })),
      ...deduped.excluded.map(({ recipe, repeat }) => ({
        recipe,
        reason: "repeat" as const,
        repeat,
      })),
    ],
  };
}
