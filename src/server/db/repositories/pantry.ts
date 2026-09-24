import { and, asc, eq, isNull } from "drizzle-orm";
import { pantryItems } from "../schema";
import type { DbExecutor } from "./executor";

export type PantryRow = typeof pantryItems.$inferSelect;
export type NewPantryRow = typeof pantryItems.$inferInsert;

/** Items not yet used up or removed. */
export async function findActivePantry(
  ex: DbExecutor,
  userId: string,
): Promise<PantryRow[]> {
  return ex
    .select()
    .from(pantryItems)
    .where(and(eq(pantryItems.userId, userId), isNull(pantryItems.removedAt)))
    .orderBy(asc(pantryItems.addedAt));
}

export async function insertPantryItems(
  ex: DbExecutor,
  rows: NewPantryRow[],
): Promise<PantryRow[]> {
  if (rows.length === 0) return [];
  return ex.insert(pantryItems).values(rows).returning();
}

/** Soft-removes an active item; undefined when there is no such active item. */
export async function removePantryItem(
  ex: DbExecutor,
  userId: string,
  itemId: string,
): Promise<PantryRow | undefined> {
  const [row] = await ex
    .update(pantryItems)
    .set({ removedAt: new Date() })
    .where(
      and(
        eq(pantryItems.userId, userId),
        eq(pantryItems.id, itemId),
        isNull(pantryItems.removedAt),
      ),
    )
    .returning();
  return row;
}
