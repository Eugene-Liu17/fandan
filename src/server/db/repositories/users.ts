import { eq } from "drizzle-orm";
import { users } from "../schema";
import type { DbExecutor } from "./executor";

export type UserRow = typeof users.$inferSelect;

export async function findUser(
  ex: DbExecutor,
  userId: string,
): Promise<UserRow | undefined> {
  const [row] = await ex
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}
