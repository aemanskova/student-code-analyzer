import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import simpleImportSort from "eslint-plugin-simple-import-sort"
import unusedImports from "eslint-plugin-unused-imports"
import boundaries from "eslint-plugin-boundaries"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores(["dist", "node_modules", "vite.config.ts"]),

  {
    files: ["**/*.{ts,tsx}"],
    plugins: { boundaries, unusedImports, simpleImportSort },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser
    },

    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite
    ],
    settings: {
      react: {
        version: "detect"
      },
      "import/resolver": {
        typescript: { alwaysTryTypes: true }
      },
      "boundaries/elements": [
        { type: "shared", pattern: "src/shared/**" },
        { type: "entities", pattern: "src/entities/**" },
        { type: "features", pattern: "src/features/**" },
        { type: "widgets", pattern: "src/widgets/**" },
        { type: "pages", pattern: "src/pages/**" },
        { type: "app", pattern: "src/app/**" }
      ]
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "app", allow: ["pages", "widgets", "features", "entities", "shared"] },
            { from: "pages", allow: ["widgets", "features", "entities", "shared"] },
            { from: "widgets", allow: ["features", "entities", "shared"] },
            { from: "features", allow: ["entities", "shared"] },
            { from: "entities", allow: ["shared"] },
            { from: "shared", allow: ["shared"] }
          ]
        }
      ],
      "simpleImportSort/imports": "error",
      "simpleImportSort/exports": "error",
      "unusedImports/no-unused-imports": "error",
      "react-hooks/set-state-in-effect": "off"
    }
  }
])
