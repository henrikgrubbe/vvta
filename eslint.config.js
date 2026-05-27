// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
      // Sort imports consistently and run Prettier as part of ESLint so teams can use a single lint entrypoint
      'plugin:simple-import-sort/recommended',
      'plugin:prettier/recommended',
    ],
    plugins: ['simple-import-sort', 'prettier'],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      // Enforce import sorting
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      // Surface Prettier formatting issues as ESLint errors so CI/lint is a single entrypoint
      'prettier/prettier': 'error',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      // Surface Prettier format issues in templates as ESLint errors as well
      'prettier/prettier': 'error',
    },
  },
]);
