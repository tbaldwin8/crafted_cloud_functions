import globals from "globals";
import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

export default [
  js.configs.recommended,
  prettierConfig,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2023,
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      // Core JavaScript best practices
      camelcase: ["error", { properties: "always" }],
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: "error",
      "no-console": "warn",

      // Code readability and consistency
      "prettier/prettier": "error",
      indent: ["error", 2],
      quotes: ["error", "double"],
      semi: ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],
      "max-len": ["error", { code: 120 }],

      // Specific to JavaScript usage in your project
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "consistent-return": "error",
      "no-duplicate-imports": "error",
    },
  },
];
