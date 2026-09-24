import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The database integration tests run against; override with
// TEST_DATABASE_URL. Its name must end in _test (src/server/testing/).
process.env.TEST_DATABASE_URL ??=
  "postgresql://fandan:fandan@localhost:5432/fandan_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "domain",
          environment: "node",
          include: ["src/domain/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["src/server/**/*.test.ts"],
          // Integration tests run against a real Postgres test database,
          // never the development one (see src/server/testing/).
          env: { DATABASE_URL: process.env.TEST_DATABASE_URL },
          globalSetup: ["src/server/testing/global-setup.ts"],
          setupFiles: ["src/server/testing/setup.ts"],
          // Every test truncates the shared test database, so files must not
          // run concurrently.
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: "v8",
      // Business rules live in src/domain, so that is where the 90%
      // threshold from ROADMAP.md M1 applies. CI runs `test:coverage`, so
      // dropping below it fails the build.
      include: ["src/domain/**"],
      exclude: ["src/domain/**/*.test.ts", "src/domain/testing/**"],
      reporter: ["text", "html"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
