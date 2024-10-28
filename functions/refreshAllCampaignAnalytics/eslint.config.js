/* eslint-disable max-len */
module.exports = {
  env: {
    node: true,
    es2020: true, // Enable ECMAScript 2020 features
  },
  extends: [
    'eslint:recommended', // Use recommended ESLint rules
    'plugin:prettier/recommended', // Enable Prettier integration
  ],
  parserOptions: {
    ecmaVersion: 2020, // Enable ECMAScript 2020 features
  },
  rules: {
    // Core JavaScript best practices
    camelcase: ['error', { properties: 'always' }], // Enforce camelCase for variables and properties
    'no-var': 'error', // Disallow `var`, enforce `let` and `const`
    'prefer-const': 'error', // Suggest `const` if variable is never reassigned
    eqeqeq: 'error', // Require use of `===` and `!==` instead of `==` and `!=`
    'no-console': 'warn', // Warn on `console` statements to encourage proper logging

    // Code readability and consistency
    'prettier/prettier': ['error'], // Ensure Prettier enforces formatting
    indent: ['error', 2], // Enforce 2 spaces indentation
    quotes: ['error', 'double'], // Use double quotes for strings
    semi: ['error', 'always'], // Always use semicolons
    'comma-dangle': ['error', 'always-multiline'], // Enforce trailing commas where valid in ES5 (objects, arrays, etc.)
    'max-len': ['error', { code: 120 }], // Enforce a maximum line length of 120 characters

    // Specific to JavaScript usage in your project
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // Warn on unused variables but ignore unused function parameters starting with '_'
    'consistent-return': 'error', // Ensure functions either always or never specify values to return
    'no-duplicate-imports': 'error', // Prevent multiple imports from the same module
  },
  overrides: [
    {
      files: ['*.js'],
      rules: {
        // Example: Relax certain rules for specific files if needed
      },
    },
  ],
};
