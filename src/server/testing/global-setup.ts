/**
 * Vitest global setup for the `server` project: makes sure the test
 * database exists and has every migration applied, using the same migration
 * files `pnpm run db:migrate` applies.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { testDatabaseName, testDatabaseUrl } from "./test-database-url";

export default async function setup(): Promise<void> {
  const name = testDatabaseName();

  const adminUrl = new URL(testDatabaseUrl());
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    const existing =
      await admin`select 1 from pg_database where datname = ${name}`;
    if (existing.length === 0) {
      // `name` is validated by testDatabaseName, so interpolating it is safe.
      await admin.unsafe(`create database "${name}"`);
    }
  } finally {
    await admin.end();
  }

  const client = postgres(testDatabaseUrl(), { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: "src/server/db/migrations",
    });
  } finally {
    await client.end();
  }
}
