import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

/**
 * Anything repositories can run queries on: the `db` client or a
 * transaction, so services can compose several repository calls atomically.
 */
export type DbExecutor = PgDatabase<PostgresJsQueryResultHKT>;
