import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["frontend/src/**/*.ts", "backend/src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-function-return-types": "warn",
      "prefer-const": "warn",
      "no-console": "warn",
    },
  },
];
