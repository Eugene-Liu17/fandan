import type { PlainDate } from "@/domain/date";
import type { DishStatus, MealSlot } from "@/domain/enums";
import { MEAL_SLOTS } from "@/domain/enums";
import type { RecipeFeatures } from "@/domain/features";
import { defaultDishesPerMeal } from "@/domain/household";
import { type SlotState, slotStateOf } from "@/domain/meal-state";
import type { Restriction } from "@/domain/restrictions";
import { getWeekRange, type WeekRange, weekDates } from "@/domain/week";
import { db } from "@/server/db/client";
import {
  findSlotsInRange,
  type SlotWithDishes,
} from "@/server/db/repositories/meals";
import { findActivePantry } from "@/server/db/repositories/pantry";
import { findActiveTasteFacts } from "@/server/db/repositories/taste-facts";
import { requireUser, restrictionOf, todayFor } from "./context";

export interface DishView {
  id: string;
  position: number;
  recipeId: string | null;
  dishName: string | null;
  status: DishStatus;
  rating: number | null;
  features: RecipeFeatures | null;
}

export interface SlotView {
  slot: MealSlot;
  /** "unknown" when the slot has no row; never assumed "cooked". */
  state: SlotState;
  mealId: string | null;
  note: string | null;
  dishes: DishView[];
}

export interface DayView {
  date: PlainDate;
  /** Always all three slots, in breakfast / lunch / dinner order. */
  slots: SlotView[];
}

export interface WeekContext {
  user: {
    id: string;
    displayName: string;
    timezone: string;
    weekStartsOn: 0 | 1;
    householdSize: number | null;
    /** Stored preference, else derived from household size, else null. */
    dishesPerMeal: number | null;
    dedupeWindowDays: number;
  };
  today: PlainDate;
  week: WeekRange;
  days: DayView[];
  pantry: {
    id: string;
    rawName: string;
    ingredientKey: string | null;
    quantity: string | null;
  }[];
  restrictions: { id: string; content: string; restriction: Restriction }[];
  preferences: { id: string; type: string; content: string }[];
}

function slotView(slot: MealSlot, found: SlotWithDishes | undefined): SlotView {
  return {
    slot,
    state: slotStateOf(found?.meal),
    mealId: found?.meal.id ?? null,
    note: found?.meal.note ?? null,
    dishes: (found?.dishes ?? []).map((d) => ({
      id: d.id,
      position: d.position,
      recipeId: d.recipeId,
      dishName: d.dishName,
      status: d.status,
      rating: d.rating,
      features: d.features,
    })),
  };
}

/**
 * Everything about the user's current week, read fresh from the database.
 * The calendar and every chat turn read state through this, so an edit made
 * in one is visible in the other on the next read (SPEC core principle 2).
 */
export async function getWeekContext(
  userId: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<WeekContext> {
  const user = await requireUser(db, userId);
  const today = todayFor(user, now);
  const weekStartsOn = user.weekStartsOn === 0 ? 0 : 1;
  const week = getWeekRange(today, weekStartsOn);

  const [slots, pantry, facts] = await Promise.all([
    findSlotsInRange(db, userId, week.start, week.end),
    findActivePantry(db, userId),
    findActiveTasteFacts(db, userId),
  ]);

  const days = weekDates(week).map((date) => ({
    date,
    slots: MEAL_SLOTS.map((slot) =>
      slotView(
        slot,
        slots.find((s) => s.meal.date === date && s.meal.slot === slot),
      ),
    ),
  }));

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      timezone: user.timezone,
      weekStartsOn,
      householdSize: user.householdSize,
      dishesPerMeal:
        user.dishesPerMeal ??
        (user.householdSize === null
          ? null
          : defaultDishesPerMeal(user.householdSize)),
      dedupeWindowDays: user.dedupeWindowDays,
    },
    today,
    week,
    days,
    pantry: pantry.map((p) => ({
      id: p.id,
      rawName: p.rawName,
      ingredientKey: p.ingredientKey,
      quantity: p.quantity,
    })),
    restrictions: facts
      .filter((f) => f.type === "restriction")
      .map((f) => ({
        id: f.id,
        content: f.content,
        restriction: restrictionOf(f),
      })),
    preferences: facts
      .filter((f) => f.type !== "restriction")
      .map((f) => ({ id: f.id, type: f.type, content: f.content })),
  };
}
