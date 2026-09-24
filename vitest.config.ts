import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
