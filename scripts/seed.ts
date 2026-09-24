/**
 * Seeds the local database. Run with `pnpm run db:seed`; safe to run again.
 *
 * - Shared recipes are upserted by (source, source_ref).
 * - The developer account is created if missing and never modified, so real
 *   phase-1 usage is never overwritten.
 * - The demo account is deleted (cascading to all its rows) and rebuilt
 *   with about two weeks of history ending yesterday, one peanut allergy,
 *   and a few pantry items.
 */

import { sql } from "drizzle-orm";
import { addDays, toPlainDate } from "@/domain/date";
import { recipeFeaturesSchema } from "@/domain/features";
import { normalizeIngredient } from "@/domain/ingredients/normalize";
import { recipeIngredientSchema } from "@/domain/recipe";
import { restrictionSchema } from "@/domain/restrictions";
import {
  mealDishes,
  meals,
  pantryItems,
  recipes,
  tasteFacts,
  users,
} from "@/server/db/schema";
import {
  DEMO_DINNERS,
  DEMO_PANTRY,
  DEMO_USER_ID,
  DEVELOPER_USER_ID,
  SEED_LICENSE,
  SEED_RECIPES,
  SEED_SOURCE,
  SEED_TIMEZONE,
} from "./seed-data";

// Same env loading as drizzle.config.ts. Must run before the db client is
// imported, because src/server/env.ts validates process.env at import time.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (e.g. CI): DATABASE_URL must already be in the environment.
}
const { db, closeDb } = await import("@/server/db/client");

const excluded = (column: string) => sql.raw(`excluded.${column}`);

async function seed() {
  // Validate before touching the database, so bad seed data fails loudly.
  const recipeRows = SEED_RECIPES.map((r) => ({
    name: r.name,
    category: r.category,
    ingredients: recipeIngredientSchema.array().parse(r.ingredients),
    steps: r.steps,
    features: recipeFeaturesSchema.parse(r.features),
    source: SEED_SOURCE,
    sourceRef: r.ref,
    license: SEED_LICENSE,
  }));
  const peanutAllergy = restrictionSchema.parse({
    kind: "allergen",
    tag: "peanut",
  });
  const today = toPlainDate(new Date(), SEED_TIMEZONE);

  return db.transaction(async (tx) => {
    const upserted = await tx
      .insert(recipes)
      .values(recipeRows)
      .onConflictDoUpdate({
        target: [recipes.source, recipes.sourceRef],
        set: {
          name: excluded("name"),
          category: excluded("category"),
          ingredients: excluded("ingredients"),
          steps: excluded("steps"),
          features: excluded("features"),
          license: excluded("license"),
          updatedAt: new Date(),
        },
      })
      .returning({ id: recipes.id, ref: recipes.sourceRef });
    const recipeIdByRef = new Map(upserted.map((r) => [r.ref, r.id]));
    const recipeByRef = new Map(SEED_RECIPES.map((r) => [r.ref, r]));

    await tx
      .insert(users)
      .values({
        id: DEVELOPER_USER_ID,
        displayName: "开发者",
        timezone: SEED_TIMEZONE,
      })
      .onConflictDoNothing({ target: users.id });

    // The demo account is disposable: rebuild it from scratch every run.
    await tx.delete(users).where(sql`${users.id} = ${DEMO_USER_ID}`);
    await tx.insert(users).values({
      id: DEMO_USER_ID,
      displayName: "演示用户",
      timezone: SEED_TIMEZONE,
      householdSize: 2,
    });

    await tx.insert(tasteFacts).values([
      {
        userId: DEMO_USER_ID,
        type: "restriction",
        content: "花生过敏",
        payload: peanutAllergy,
        source: "choice",
      },
      {
        userId: DEMO_USER_ID,
        type: "preference",
        content: "喜欢酸辣口",
        source: "stated",
      },
    ]);

    await tx.insert(pantryItems).values(
      DEMO_PANTRY.map((rawName) => {
        const n = normalizeIngredient(rawName);
        return {
          userId: DEMO_USER_ID,
          rawName,
          ingredientKey: n.kind === "mapped" ? n.key : null,
        };
      }),
    );

    let dishCount = 0;
    for (const dinner of DEMO_DINNERS) {
      const [meal] = await tx
        .insert(meals)
        .values({
          userId: DEMO_USER_ID,
          date: addDays(today, -dinner.daysAgo),
          slot: "dinner",
          status: dinner.status,
        })
        .returning({ id: meals.id });
      if (!meal) throw new Error("Insert into meals returned no row");

      const dishes =
        dinner.status === "cooked"
          ? dinner.dishes.map((d, position) => {
              const r = recipeByRef.get(d.ref);
              const recipeId = recipeIdByRef.get(d.ref);
              if (!r || !recipeId) throw new Error(`Unknown recipe ${d.ref}`);
              return {
                position,
                recipeId,
                dishName: r.name,
                features: r.features,
                status: d.eaten ? ("eaten" as const) : ("not_eaten" as const),
                rating: d.rating,
              };
            })
          : dinner.status === "ate_out"
            ? [
                {
                  position: 0,
                  recipeId: null,
                  dishName: dinner.dishName,
                  features: dinner.features,
                  status: "eaten" as const,
                  rating: null,
                },
              ]
            : [];

      if (dishes.length > 0) {
        await tx.insert(mealDishes).values(
          dishes.map((d) => ({
            ...d,
            userId: DEMO_USER_ID,
            mealId: meal.id,
          })),
        );
        dishCount += dishes.length;
      }
    }

    return {
      today,
      recipes: upserted.length,
      demoMeals: DEMO_DINNERS.length,
      demoDishes: dishCount,
    };
  });
}

try {
  const summary = await seed();
  console.log("Seed complete:", {
    ...summary,
    developerUserId: DEVELOPER_USER_ID,
    demoUserId: DEMO_USER_ID,
  });
} finally {
  await closeDb();
}
