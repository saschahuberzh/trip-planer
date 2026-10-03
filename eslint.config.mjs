import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // UI must not access IndexedDB directly (UI → services → repositories → IndexedDB).
    files: ["src/app/**", "src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "dexie", message: "Use services/repositories instead of Dexie in UI code." }],
          patterns: [
            { group: ["@/lib/db", "@/lib/db/*"], message: "Use services/repositories instead of the database in UI code." },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated service worker.
    "public/sw.js",
    "public/swe-worker-*.js",
  ]),
]);

export default eslintConfig;
