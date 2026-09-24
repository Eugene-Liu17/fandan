import { and, asc, eq, isNull } from "drizzle-orm";
import { tasteFacts } from "../schema";
import type { DbExecutor } from "./executor";

export type TasteFactRow = typeof tasteFacts.$inferSelect;

/** Facts the user has not retracted. */
export async function findActiveTasteFacts(
  ex: DbExecutor,
  userId: string,
): Promise<TasteFactRow[]> {
  return ex
    .select()
    .from(tasteFacts)
    .where(and(eq(tasteFacts.userId, userId), isNull(tasteFacts.deletedAt)))
    .orderBy(asc(tasteFacts.createdAt));
}
