/**
 * Recipe feature vocabulary and schema (ADR-008).
 *
 * The same schema validates features labeled by the M2 batch script and the
 * snapshot stored on each `meal_dishes` row. Keys are English; Chinese labels
 * belong to the UI.
 */

import { z } from "zod";
import { isIngredientKey } from "./ingredients/normalize";

/** A dish's role in a meal, used to compose e.g. one meat, one vegetable, one soup. */
export const DISH_ROLES = [
  "meat",
  "vegetable",
  "soup",
  "staple",
  "mixed",
] as const;
export type DishRole = (typeof DISH_ROLES)[number];

export const CUISINES = [
  "home_style",
  "sichuan",
  "hunan",
  "cantonese",
  "shandong",
  "jiangsu_zhejiang",
  "northeastern",
  "northwestern",
  "western",
  "japanese_korean",
  "southeast_asian",
  "other",
] as const;
export type Cuisine = (typeof CUISINES)[number];

export const COOKING_METHODS = [
  "stir_fry",
  "braise",
  "stew",
  "boil",
  "steam",
  "pan_fry",
  "deep_fry",
  "roast",
  "cold_mix",
  "other",
] as const;
export type CookingMethod = (typeof COOKING_METHODS)[number];

export const FLAVORS = [
  "savory",
  "soy_braised",
  "numbing_spicy",
  "spicy",
  "sweet_sour",
  "yuxiang",
  "sour_spicy",
  "light",
  "garlicky",
  "curry",
  "other",
] as const;
export type Flavor = (typeof FLAVORS)[number];

export const OIL_LEVELS = ["low", "medium", "high"] as const;
export type OilLevel = (typeof OIL_LEVELS)[number];

export const recipeFeaturesSchema = z.object({
  role: z.enum(DISH_ROLES),
  cuisine: z.enum(CUISINES),
  method: z.enum(COOKING_METHODS),
  flavor: z.enum(FLAVORS),
  /**
   * The specific main ingredient as a dictionary key (五花肉 and 排骨 differ).
   * Null when unknown, e.g. for a dish eaten out.
   */
  main_ingredient: z
    .string()
    .refine(isIngredientKey, { message: "Not an ingredient dictionary key" })
    .nullable(),
  oil_level: z.enum(OIL_LEVELS),
});

export type RecipeFeatures = z.infer<typeof recipeFeaturesSchema>;
