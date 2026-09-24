import { index, jsonb, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import type { RecipeFeatures } from "@/domain/features";
import type { RecipeIngredient } from "@/domain/recipe";
import { id, timestamps } from "./columns";
import { users } from "./users";

export const recipes = pgTable(
  "recipes",
  {
    id: id(),
    /** Null = the shared library; otherwise the user who owns the recipe. */
    ownerId: uuid().references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    category: text().notNull(),
    ingredients: jsonb().$type<RecipeIngredient[]>().notNull(),
    steps: jsonb().$type<string[]>().notNull(),
    /** Filled by M2 labeling; null until then. */
    features: jsonb().$type<RecipeFeatures>(),
    source: text().notNull(),
    /** Path or URL within the source; with `source`, unique per recipe. */
    sourceRef: text().notNull(),
    license: text().notNull(),
    ...timestamps(),
  },
  (t) => [
    unique("recipes_source_source_ref_unique").on(t.source, t.sourceRef),
    index("recipes_owner_id_idx").on(t.ownerId),
  ],
);
