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
