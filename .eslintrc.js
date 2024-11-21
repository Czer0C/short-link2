module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended', 'plugin:node/recommended'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    // Possible Errors
    'no-console': 'off', // Allow console for server logs
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

    // Best Practices
    eqeqeq: 'error',
    curly: 'error',
    'no-eval': 'error',

    // Node.js and CommonJS
    'node/no-unsupported-features/es-syntax': [
      'error',
      { ignores: ['modules'] },
    ],
    'node/no-missing-import': 'off', // Turn off if using TypeScript or custom paths

    // Code Style
    indent: ['error', 2],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'no-trailing-spaces': 'error',
    'eol-last': ['error', 'always'],
  },
}
