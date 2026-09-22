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
      // Coverage is scoped to src/domain for now: it's the only layer with
      // code in it at M0. The 90% threshold from ROADMAP.md M1 is enforced
      // starting M1, once services/repositories exist to cover too.
      include: ["src/domain/**"],
      reporter: ["text", "html"],
    },
  },
});
