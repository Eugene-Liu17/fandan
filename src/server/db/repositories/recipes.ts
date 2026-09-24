import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import type { RecipeCandidate } from "@/domain/recipe";
import { recipes } from "../schema";
import type { DbExecutor } from "./executor";

/** Recipes a user may see: the shared library plus their own. */
const visibleTo = (userId: string) =>
  or(isNull(recipes.ownerId), eq(recipes.ownerId, userId));

const candidateColumns = {
  id: recipes.id,
  name: recipes.name,
  ingredients: recipes.ingredients,
  features: recipes.features,
};

export async function findVisibleRecipes(
  ex: DbExecutor,
  userId: string,
): Promise<RecipeCandidate[]> {
  return ex
    .select(candidateColumns)
    .from(recipes)
    .where(visibleTo(userId))
    .orderBy(asc(recipes.name));
}

/** Visible recipes whose name is exactly one of `names`. */
export async function findVisibleRecipesByNames(
  ex: DbExecutor,
  userId: string,
  names: string[],
): Promise<RecipeCandidate[]> {
  if (names.length === 0) return [];
  return ex
    .select(candidateColumns)
    .from(recipes)
    .where(and(visibleTo(userId), inArray(recipes.name, names)))
    .orderBy(asc(recipes.name));
}

export async function findVisibleRecipesByIds(
  ex: DbExecutor,
  userId: string,
  ids: string[],
): Promise<RecipeCandidate[]> {
  if (ids.length === 0) return [];
  return ex
    .select(candidateColumns)
    .from(recipes)
    .where(and(visibleTo(userId), inArray(recipes.id, ids)))
    .orderBy(asc(recipes.name));
}
