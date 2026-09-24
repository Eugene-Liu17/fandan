/**
 * The database integration tests run against, set by vitest.config.ts
 * (override with TEST_DATABASE_URL). Never the development database: the
 * name must end in `_test`, and `resetDatabase` checks again before
 * truncating anything.
 */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set; run tests through vitest");
  }
  return url;
}

export function testDatabaseName(url: string = testDatabaseUrl()): string {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(
      `Refusing to use "${name}" for tests: the database name must end in _test`,
    );
  }
  return name;
}
