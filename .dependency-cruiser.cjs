/**
 * Enforces the layer boundaries from CLAUDE.md and docs/DECISIONS.md
 * ADR-002:
 *   app/components -> server/services -> domain
 *   server/ai/tools -> server/services
 * `domain` has no I/O and no framework imports. `pnpm run
 * check:boundaries` runs this in CI so violations fail the build instead
 * of relying on convention.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-no-upper-layers",
      comment:
        "src/domain must not import from server, app, or components — it is pure business logic.",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^src/(server|app|components)" },
    },
    {
      name: "domain-no-frameworks",
      comment:
        "src/domain must not depend on Next.js, React, the AI SDK, or the database layer.",
      severity: "error",
      from: { path: "^src/domain" },
      to: {
        path: "node_modules/(next|react|react-dom|ai|@ai-sdk|drizzle-orm|postgres)",
      },
    },
    {
      name: "domain-no-node-core",
      comment:
        "src/domain is pure: no Node built-ins (fs, crypto, net ...), which would mean I/O or host state.",
      severity: "error",
      from: { path: "^src/domain" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "ui-only-services",
      comment:
        "app/ and components/ (outside components/ui, which is presentational shadcn primitives) may only call server/services, never server/db or server/ai directly.",
      severity: "error",
      from: { path: "^src/(app|components)", pathNot: "^src/components/ui" },
      to: { path: "^src/server/(db|ai)" },
    },
    {
      name: "ai-tools-only-services",
      comment:
        "server/ai/tools must call server/services, not server/db directly — the same rule the UI follows.",
      severity: "error",
      from: { path: "^src/server/ai" },
      to: { path: "^src/server/db" },
    },
    {
      name: "db-no-services",
      comment:
        "server/db sits below server/services; it must not import upward.",
      severity: "error",
      from: { path: "^src/server/db" },
      to: { path: "^src/server/services" },
    },
    {
      name: "testing-only-from-tests",
      comment:
        "Test helpers (e.g. resetDatabase, which truncates every table) may only be imported by tests and other test helpers.",
      severity: "error",
      from: { pathNot: "(\\.test\\.ts$|/testing/)" },
      to: { path: "^src/(server|domain)/testing/" },
    },
    {
      name: "no-circular",
      comment: "Circular dependencies make the layering above unverifiable.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
