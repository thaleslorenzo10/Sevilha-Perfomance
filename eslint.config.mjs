// Quality gates do vibe-coding-toolkit. As regras em ./eslint-rules/ sao copia
// byte a byte do template — nao reescrever. Teto de arquivo: 350 linhas.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

import quality from "./eslint-rules/index.cjs";

export default defineConfig([
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
  },
  js.configs.recommended,
  {
    files: ["api/**/*.js", "lib/**/*.js", "scripts/**/*.{js,mjs}", "assets/**/*.js"],
    plugins: { quality },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-var": "warn",
      "prefer-const": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      complexity: ["warn", 12],
      "max-depth": ["warn", 4],
      "max-statements": ["warn", 20],
      "max-params": ["warn", 4],
      "max-lines-per-function": [
        "warn",
        { max: 150, skipBlankLines: true, skipComments: true },
      ],
      "max-nested-callbacks": ["warn", 3],
      // Baseline medido na instalacao: 8 arquivo(s) acima de 350
      // linhas. Sobe para "error" quando a contagem chegar a zero.
      "quality/max-lines": ["warn", { max: 350 }],
    },
  },
  {
    files: ["**/*.test.{js,mjs}"],
    plugins: { quality },
    rules: {
      "quality/max-lines": ["warn", { max: 350, includeTests: true }],
      "max-statements": "off",
      "max-lines-per-function": "off",
      "max-nested-callbacks": "off",
    },
  },
  {
    files: ["eslint-rules/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "readonly", require: "readonly" },
    },
  },
  globalIgnores([
    ".agents/**",
    ".github/skills/**",
    ".github/agents/**",
    ".github/hooks/**",
    "node_modules/**",
    ".next/**",
    "dist/**",
    "build/**",
    "out/**",
    "coverage/**",
    ".claude/**",
    "graphify-out/**",
    "**/*.tsbuildinfo",
    ".chrome-profile/**",
    "**/*.min.js",
    "vendor/**",
    "criativos/**",
    "--out/**",
    "docs/**",
  ]),
]);
