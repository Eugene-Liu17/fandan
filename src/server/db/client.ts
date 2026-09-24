import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/env";

const queryClient = postgres(env.DATABASE_URL);

// camelCase in TypeScript, snake_case in Postgres. Must match the `casing`
// option in drizzle.config.ts.
export const db = drizzle(queryClient, { casing: "snake_case" });

/** Closes the connection pool. Only scripts need this; the app keeps it open. */
export async function closeDb(): Promise<void> {
  await queryClient.end();
}
