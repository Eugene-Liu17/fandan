/**
 * Allergy and restriction hard filter (SPEC core principle 3, ADR-008).
 *
 * The filter is conservative: when in doubt, exclude. A recipe violates a
 * restriction when
 * - an ingredient resolves to a dictionary entry the restriction covers, or
 * - an ingredient's raw name contains any name or alias the restriction
 *   covers (catches unmapped names such as 花生酱), or
 * - the recipe name contains such a term of two or more characters (a safety
 *   net for incomplete ingredient lists; single characters are skipped there
 *   so 鱼香肉丝 is not read as fish).
 * No recommendation path may bypass this: callers filter before scoring.
 */

import { z } from "zod";
import { INGREDIENTS, type IngredientEntry } from "./ingredients/dictionary";
import {
  getIngredient,
  isIngredientKey,
  normalizeIngredient,
  normalizeName,
} from "./ingredients/normalize";
import {
  ALLERGEN_TAGS,
  type AllergenTag,
  INGREDIENT_CATEGORIES,
  type IngredientCategory,
} from "./ingredients/vocab";
import type { RecipeCandidate } from "./recipe";
import { resolveIngredientKey } from "./recipe";

/** Stored in `taste_facts.payload` for facts of type `restriction`. */
export const restrictionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("allergen"), tag: z.enum(ALLERGEN_TAGS) }),
  z.object({
    kind: z.literal("category"),
    category: z.enum(INGREDIENT_CATEGORIES),
  }),
  z.object({
    kind: z.literal("ingredient"),
    key: z
      .string()
      .refine(isIngredientKey, { message: "Not an ingredient dictionary key" }),
  }),
  /** Free text that could not be mapped to the dictionary. Never dropped. */
  z.object({ kind: z.literal("term"), text: z.string().trim().min(1) }),
]);

export type Restriction = z.infer<typeof restrictionSchema>;

/**
 * A search term, plus words that contain it but mean something else
 * (牛 in 牛奶 is not beef). Those words are masked out before matching.
 */
export interface GuardedTerm {
  term: string;
  unless?: readonly string[];
}

/** True when `text` contains `term` outside every `unless` word. */
export function containsTerm(text: string, { term, unless = [] }: GuardedTerm) {
  // Mask with a separator rather than deleting, so masking never joins
  // neighbouring characters into a new match.
  const masked = unless.reduce((t, word) => t.split(word).join("|"), text);
  return masked.includes(term);
}

/**
 * Per-category search terms beyond the dictionary's names, for products it
 * does not list (猪油, 羊蝎子, 肥牛卷 ...), and words that contain a
 * category's terms but mean something else (鸡蛋 is not poultry, 牛奶 is
 * not beef). The exclusions apply to every term of the category, including
 * the dictionary's own names and aliases such as 鸡.
 */
export const CATEGORY_TERMS: Partial<
  Record<
    IngredientCategory,
    { extra: readonly string[]; unless: readonly string[] }
  >
> = {
  pork: { extra: ["猪"], unless: [] },
  beef: {
    extra: ["牛"],
    unless: ["牛奶", "牛油果", "牛蛙", "蜗牛", "牛肝菌"],
  },
  lamb: { extra: ["羊"], unless: ["羊肚菌"] },
  poultry: { extra: ["鸡", "鸭", "鹅"], unless: ["鸡蛋", "鸭蛋", "鹅蛋"] },
  shellfish: { extra: ["贝", "虾", "蟹"], unless: [] },
};

const unlessFor = (c: IngredientCategory) => CATEGORY_TERMS[c]?.unless ?? [];

export interface Violation {
  restriction: Restriction;
  /** Where the match was found. */
  source: "ingredient" | "main_ingredient" | "recipe_name";
  /** The ingredient name or recipe name that matched. */
  matched: string;
}

interface Matcher {
  restriction: Restriction;
  coversEntry: (entry: IngredientEntry) => boolean;
  /** Normalized, non-empty search terms. */
  terms: GuardedTerm[];
}

const namesOf = (entry: IngredientEntry) => [entry.name, ...entry.aliases];
const termsOf = (entry: IngredientEntry): GuardedTerm[] =>
  namesOf(entry).map((term) => ({ term }));

function compile(restriction: Restriction): Matcher {
  let coversEntry: (entry: IngredientEntry) => boolean;
  let rawTerms: GuardedTerm[];

  switch (restriction.kind) {
    case "allergen":
      coversEntry = (e) =>
        (e.allergens as readonly string[]).includes(restriction.tag);
      rawTerms = INGREDIENTS.filter(coversEntry).flatMap(termsOf);
      break;
    case "category": {
      const { category } = restriction;
      const unless = unlessFor(category);
      coversEntry = (e) => e.category === category;
      rawTerms = [
        ...INGREDIENTS.filter(coversEntry).flatMap(namesOf),
        ...(CATEGORY_TERMS[category]?.extra ?? []),
      ].map((term) => ({ term, unless }));
      break;
    }
    case "ingredient": {
      const entry = getIngredient(restriction.key);
      coversEntry = (e) => e.key === restriction.key;
      rawTerms = entry
        ? namesOf(entry).map((term) => ({
            term,
            unless: unlessFor(entry.category),
          }))
        : [];
      break;
    }
    case "term": {
      const mapped = normalizeIngredient(restriction.text);
      const entry =
        mapped.kind === "mapped" ? getIngredient(mapped.key) : undefined;
      coversEntry = (e) => entry !== undefined && e.key === entry.key;
      rawTerms = [{ term: restriction.text }, ...(entry ? termsOf(entry) : [])];
      break;
    }
  }

  const seen = new Set<string>();
  const terms = rawTerms
    .map((t) => ({ ...t, term: normalizeName(t.term) }))
    .filter((t) => {
      const id = `${t.term}|${(t.unless ?? []).join(",")}`;
      if (t.term.length === 0 || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  return { restriction, coversEntry, terms };
}

const MIN_RECIPE_NAME_TERM_LENGTH = 2;

function firstViolation(
  recipe: RecipeCandidate,
  matcher: Matcher,
): Violation | null {
  const { restriction, coversEntry, terms } = matcher;

  for (const ingredient of recipe.ingredients) {
    const key = resolveIngredientKey(ingredient);
    const entry = key === null ? undefined : getIngredient(key);
    const name = normalizeName(ingredient.raw_name);
    if (
      (entry !== undefined && coversEntry(entry)) ||
      terms.some((t) => containsTerm(name, t))
    ) {
      return {
        restriction,
        source: "ingredient",
        matched: ingredient.raw_name,
      };
    }
  }

  const mainKey = recipe.features?.main_ingredient;
  const mainEntry = mainKey ? getIngredient(mainKey) : undefined;
  if (mainEntry !== undefined && coversEntry(mainEntry)) {
    return { restriction, source: "main_ingredient", matched: mainEntry.name };
  }

  const recipeName = normalizeName(recipe.name);
  if (
    terms.some(
      (t) =>
        [...t.term].length >= MIN_RECIPE_NAME_TERM_LENGTH &&
        containsTerm(recipeName, t),
    )
  ) {
    return { restriction, source: "recipe_name", matched: recipe.name };
  }

  return null;
}

/** Every restriction `recipe` violates (at most one violation each). */
export function findViolations(
  recipe: RecipeCandidate,
  restrictions: readonly Restriction[],
): Violation[] {
  return restrictions
    .map(compile)
    .map((m) => firstViolation(recipe, m))
    .filter((v): v is Violation => v !== null);
}

export interface RestrictionFilterResult<T extends RecipeCandidate> {
  allowed: T[];
  excluded: { recipe: T; violations: Violation[] }[];
}

/** Splits `recipes` into those that respect every restriction and those that do not. */
export function filterByRestrictions<T extends RecipeCandidate>(
  recipes: readonly T[],
  restrictions: readonly Restriction[],
): RestrictionFilterResult<T> {
  const matchers = restrictions.map(compile);
  const result: RestrictionFilterResult<T> = { allowed: [], excluded: [] };
  for (const recipe of recipes) {
    const violations = matchers
      .map((m) => firstViolation(recipe, m))
      .filter((v): v is Violation => v !== null);
    if (violations.length === 0) result.allowed.push(recipe);
    else result.excluded.push({ recipe, violations });
  }
  return result;
}

const category = (c: IngredientCategory): Restriction => ({
  kind: "category",
  category: c,
});
const allergen = (tag: AllergenTag): Restriction => ({ kind: "allergen", tag });

const MEAT_AND_SEAFOOD: Restriction[] = (
  ["pork", "beef", "lamb", "poultry", "fish", "shellfish"] as const
).map(category);
const RED_MEAT: Restriction[] = (["pork", "beef", "lamb"] as const).map(
  category,
);

export interface RestrictionKeyword {
  terms: readonly GuardedTerm[];
  /**
   * Match only when the statement, stripped of phrasing such as 不吃 or 过敏,
   * is exactly one of the terms. For words that are too common inside other
   * words: 肉 alone means "no meat", but 不吃猪肉 must not.
   */
  exactCore?: boolean;
  restrictions: readonly Restriction[];
}

const t = (term: string, ...unless: string[]): GuardedTerm =>
  unless.length > 0 ? { term, unless } : { term };

/**
 * Words in a stated restriction that name a group rather than one dictionary
 * entry ("海鲜过敏", "不吃牛羊肉", "吃素"), plus the short aromatics people
 * commonly refuse.
 */
export const RESTRICTION_KEYWORDS: readonly RestrictionKeyword[] = [
  {
    terms: [t("花生")],
    restrictions: [allergen("peanut")],
  },
  {
    terms: [t("坚果")],
    restrictions: [allergen("tree_nut")],
  },
  {
    terms: [t("牛奶"), t("奶制品"), t("乳制品"), t("乳糖"), t("乳", "腐乳")],
    restrictions: [allergen("milk")],
  },
  {
    terms: [t("奶")],
    exactCore: true,
    restrictions: [allergen("milk")],
  },
  {
    terms: [t("鸡蛋"), t("蛋类")],
    restrictions: [allergen("egg")],
  },
  {
    terms: [t("蛋")],
    exactCore: true,
    restrictions: [allergen("egg")],
  },
  {
    terms: [t("鱼")],
    restrictions: [allergen("fish"), category("fish")],
  },
  {
    terms: [t("虾"), t("蟹"), t("甲壳")],
    restrictions: [allergen("crustacean")],
  },
  {
    terms: [t("贝"), t("软体"), t("鱿鱼"), t("蚝")],
    restrictions: [allergen("mollusc")],
  },
  {
    terms: [t("海鲜"), t("水产")],
    restrictions: [
      category("fish"),
      category("shellfish"),
      allergen("fish"),
      allergen("crustacean"),
      allergen("mollusc"),
    ],
  },
  {
    terms: [t("大豆"), t("黄豆"), t("豆制品")],
    restrictions: [allergen("soy")],
  },
  {
    terms: [t("豆类")],
    restrictions: [allergen("soy"), category("legume")],
  },
  {
    terms: [t("小麦"), t("麸质"), t("面筋")],
    restrictions: [allergen("wheat")],
  },
  {
    terms: [t("芝麻")],
    restrictions: [allergen("sesame")],
  },
  { terms: [t("猪")], restrictions: [category("pork")] },
  {
    terms: [t("牛", "牛奶", "牛油果", "牛蛙", "蜗牛", "牛肝菌")],
    restrictions: [category("beef")],
  },
  { terms: [t("羊", "羊肚菌")], restrictions: [category("lamb")] },
  {
    terms: [
      t("鸡", "鸡蛋", "鸡精", "鸡粉"),
      t("鸭", "鸭蛋"),
      t("鹅", "鹅蛋"),
      t("禽"),
    ],
    restrictions: [category("poultry")],
  },
  { terms: [t("红肉")], restrictions: RED_MEAT },
  {
    terms: [t("肉"), t("肉类"), t("荤"), t("荤菜"), t("荤腥")],
    exactCore: true,
    restrictions: MEAT_AND_SEAFOOD,
  },
  {
    terms: [t("吃素"), t("素食"), t("蛋奶素")],
    restrictions: MEAT_AND_SEAFOOD,
  },
  {
    terms: [t("纯素"), t("全素")],
    restrictions: [...MEAT_AND_SEAFOOD, allergen("egg"), allergen("milk")],
  },
  {
    terms: [t("葱", "洋葱")],
    restrictions: [
      { kind: "ingredient", key: "scallion" },
      { kind: "ingredient", key: "leek_scallion" },
    ],
  },
  { terms: [t("姜")], restrictions: [{ kind: "ingredient", key: "ginger" }] },
  {
    terms: [t("蒜", "蒜苔", "蒜薹")],
    restrictions: [{ kind: "ingredient", key: "garlic" }],
  },
];

/** Leading and trailing phrasing around the thing being refused. */
const STATEMENT_PREFIX = /^我?(不能吃|不吃|不要|不喝|忌口|忌|对)/;
const STATEMENT_SUFFIX = /(过敏|忌口|不能吃|不吃)$/;

/**
 * Structured restrictions read from what the user said, e.g. "花生过敏" or
 * "不吃牛羊肉". Always keeps the statement (and the statement stripped of
 * phrasing such as 不吃 / 过敏) as `term` restrictions, then adds every
 * keyword group and every dictionary name of two or more characters it
 * mentions. Used for "other (I'll type it)" answers and alongside every
 * stored restriction, so a stated restriction is never dropped.
 */
export function restrictionsFromText(text: string): Restriction[] {
  const statement = normalizeName(text);
  if (statement.length === 0) return [];

  const found: Restriction[] = [{ kind: "term", text: statement }];
  const core = statement
    .replace(STATEMENT_PREFIX, "")
    .replace(STATEMENT_SUFFIX, "");
  if (core.length > 0 && core !== statement) {
    found.push({ kind: "term", text: core });
  }

  for (const { terms, exactCore, restrictions } of RESTRICTION_KEYWORDS) {
    const matches = exactCore
      ? terms.some(({ term }) => core === term)
      : terms.some((g) => containsTerm(statement, g));
    if (matches) found.push(...restrictions);
  }
  for (const entry of INGREDIENTS) {
    const mentioned = namesOf(entry).some(
      (n) => [...n].length >= 2 && statement.includes(normalizeName(n)),
    );
    if (mentioned) found.push({ kind: "ingredient", key: entry.key });
  }

  return uniqueRestrictions(found);
}

/** `restrictions` without duplicates, in first-seen order. */
export function uniqueRestrictions(
  restrictions: readonly Restriction[],
): Restriction[] {
  const seen = new Set<string>();
  return restrictions.filter((r) => {
    const id = JSON.stringify(r);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
