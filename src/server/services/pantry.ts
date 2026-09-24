import { z } from "zod";
import { PANTRY_QUANTITIES } from "@/domain/enums";
import { normalizeIngredient } from "@/domain/ingredients/normalize";
import { ingredientIdentity, pantryIdentities } from "@/domain/shopping-list";
import { db } from "@/server/db/client";
import { appendEvent } from "@/server/db/repositories/events";
import {
  findActivePantry,
  insertPantryItems,
  removePantryItem as removePantryRow,
} from "@/server/db/repositories/pantry";
import { requireUser } from "./context";
import { parseInput, ServiceError } from "./errors";

export const addPantryItemsInputSchema = z.object({
  names: z.array(z.string()).min(1),
  quantity: z.enum(PANTRY_QUANTITIES).optional(),
});

export type AddPantryItemsInput = z.input<typeof addPantryItemsInputSchema>;

/**
 * Adds groceries to the pantry. Names are normalized against the ingredient
 * dictionary; one already in the pantry (or repeated in the same call) is
 * skipped rather than duplicated.
 */
export async function addPantryItems(
  userId: string,
  input: AddPantryItemsInput,
) {
  const { names, quantity } = parseInput(addPantryItemsInputSchema, input);

  return db.transaction(async (tx) => {
    await requireUser(tx, userId);
    const have = pantryIdentities(
      (await findActivePantry(tx, userId)).map((p) => ({
        ingredientKey: p.ingredientKey,
        rawName: p.rawName,
      })),
    );

    const rows = [];
    const skipped: string[] = [];
    for (const raw of names) {
      const rawName = raw.trim();
      const n = normalizeIngredient(rawName);
      const key = n.kind === "mapped" ? n.key : null;
      const id = ingredientIdentity(key, rawName);
      if (id === null) continue;
      if (have.has(id)) {
        skipped.push(rawName);
        continue;
      }
      have.add(id);
      rows.push({ userId, rawName, ingredientKey: key, quantity });
    }

    const added = await insertPantryItems(tx, rows);
    if (added.length > 0) {
      await appendEvent(tx, userId, "pantry_updated", {
        added: added.map((p) => p.rawName),
        ...(skipped.length > 0 ? { skipped } : {}),
      });
    }
    return { added, skipped };
  });
}

/** Marks a pantry item as used up or removed. */
export async function removePantryItem(userId: string, itemId: string) {
  const id = parseInput(z.uuid(), itemId);
  return db.transaction(async (tx) => {
    const removed = await removePantryRow(tx, userId, id);
    if (!removed) throw new ServiceError("not_found", `No pantry item ${id}`);
    await appendEvent(tx, userId, "pantry_updated", {
      removed: [removed.rawName],
    });
    return removed;
  });
}
