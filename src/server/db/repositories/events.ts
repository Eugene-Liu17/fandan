import type { EventType } from "@/domain/enums";
import { events } from "../schema";
import type { DbExecutor } from "./executor";

/** Appends a row to the behavior log (SPEC MVP item 8). */
export async function appendEvent(
  ex: DbExecutor,
  userId: string,
  type: EventType,
  payload: Record<string, unknown>,
): Promise<void> {
  await ex.insert(events).values({ userId, type, payload });
}
