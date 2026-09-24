import type { PlainDate } from "@/domain/date";
import { MEAL_SLOTS } from "@/domain/enums";
import { defaultDishesPerMeal } from "@/domain/household";
import type { Restriction } from "@/domain/restrictions";
import { getWeekRange, type WeekRange, weekDates } from "@/domain/week";
import { db } from "@/server/db/client";
import { findSlotsInRange } from "@/server/db/repositories/meals";
import { findActivePantry } from "@/server/db/repositories/pantry";
import { findActiveTasteFacts } from "@/server/db/repositories/taste-facts";
import {
  optionalDate,
  requireUser,
  restrictionsOf,
  todayFor,
  weekStartsOnOf,
} from "./context";
import { type SlotView, toSlotView } from "./views";

export type { DishView, SlotView } from "./views";

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
  restrictions: { id: string; content: string; restrictions: Restriction[] }[];
  preferences: { id: string; type: string; content: string }[];
}

/**
 * Everything about one week (the current one unless `weekOf` names a date
 * in another), read fresh from the database. The calendar and every chat
 * turn read state through this, so an edit made in one is visible in the
 * other on the next read (SPEC core principle 2).
 */
export async function getWeekContext(
  userId: string,
  { now = new Date(), weekOf }: { now?: Date; weekOf?: string } = {},
): Promise<WeekContext> {
  const user = await requireUser(db, userId);
  const today = todayFor(user, now);
  const weekStartsOn = weekStartsOnOf(user);
  const week = getWeekRange(optionalDate(weekOf) ?? today, weekStartsOn);

  const [slots, pantry, facts] = await Promise.all([
    findSlotsInRange(db, userId, week.start, week.end),
    findActivePantry(db, userId),
    findActiveTasteFacts(db, userId),
  ]);

  const days = weekDates(week).map((date) => ({
    date,
    slots: MEAL_SLOTS.map((slot) => {
      const found = slots.find(
        (s) => s.meal.date === date && s.meal.slot === slot,
      );
      return toSlotView(slot, found?.meal, found?.dishes ?? []);
    }),
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
        restrictions: restrictionsOf(f),
      })),
    preferences: facts
      .filter((f) => f.type !== "restriction")
      .map((f) => ({ id: f.id, type: f.type, content: f.content })),
  };
}
