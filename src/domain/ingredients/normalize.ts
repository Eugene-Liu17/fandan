/**
 * Ingredient-name normalization against the dictionary (ADR-008).
 *
 * Matching is exact (after `normalizeName`) on the canonical name or an
 * alias. It deliberately never guesses by substring: the shopping list and
 * dedupe need predictable keys. The conservative substring scan used for
 * allergy filtering is a separate rule.
 */

import {
  INGREDIENTS,
  type IngredientEntry,
  type IngredientKey,
} from "./dictionary";

export type NormalizedIngredient =
  | { kind: "mapped"; key: IngredientKey }
  | { kind: "unmapped"; name: string };

/**
 * Canonical form of a free-text ingredient name: Unicode NFKC (so full-width
 * characters fold to half-width), all whitespace removed, Latin lowercased.
 */
export function normalizeName(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

/**
 * Builds the name → key index. Throws if two entries share a key or a
 * normalized name/alias, so a bad dictionary edit fails at load time.
 */
export function buildIngredientIndex(
  entries: readonly IngredientEntry[],
): Map<string, string> {
  const keys = new Set<string>();
  const index = new Map<string, string>();
  for (const entry of entries) {
    if (keys.has(entry.key)) {
      throw new Error(`Duplicate ingredient key: ${entry.key}`);
    }
    keys.add(entry.key);
    for (const raw of [entry.name, ...entry.aliases]) {
      const name = normalizeName(raw);
      const existing = index.get(name);
      if (existing !== undefined) {
        throw new Error(
          `Ingredient name "${raw}" is used by both ${existing} and ${entry.key}`,
        );
      }
      index.set(name, entry.key);
    }
  }
  return index;
}

const NAME_INDEX = buildIngredientIndex(INGREDIENTS);
const BY_KEY: ReadonlyMap<string, IngredientEntry> = new Map(
  INGREDIENTS.map((entry) => [entry.key, entry]),
);

/** Maps a free-text ingredient name to its dictionary key, if it has one. */
export function normalizeIngredient(raw: string): NormalizedIngredient {
  const name = normalizeName(raw);
  const key = NAME_INDEX.get(name);
  return key === undefined
    ? { kind: "unmapped", name }
    : { kind: "mapped", key: key as IngredientKey };
}

/** True when `value` is a key in the ingredient dictionary. */
export function isIngredientKey(value: string): value is IngredientKey {
  return BY_KEY.has(value);
}

/** Looks up a dictionary entry by key. */
export function getIngredient(key: string): IngredientEntry | undefined {
  return BY_KEY.get(key);
}
