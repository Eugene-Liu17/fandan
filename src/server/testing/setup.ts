/**
 * Per-file setup for the `server` project: every test starts from empty
 * tables, and each file closes its connection pool when done.
 */
import { afterAll, beforeEach } from "vitest";
import { closeDb } from "@/server/db/client";
import { resetDatabase } from "./db";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});
