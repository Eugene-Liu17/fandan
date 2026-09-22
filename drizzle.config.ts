import { defineConfig } from "drizzle-kit";

// Node's built-in env file loader (no dotenv dependency). Safe to call
// even if the file is missing; drizzle-kit surfaces a clear error below
// when DATABASE_URL still ends up unset.
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not present (e.g. in CI, where DATABASE_URL is injected
  // directly) — fall through to the process.env check below.
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/*.ts",
  out: "./src/server/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
