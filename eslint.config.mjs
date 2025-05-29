import nextPlugin from 'eslint-config-next';

/** @type {import('eslint').Linter.FlatConfig[]} */
const eslintConfig = [
  // Include Next.js default configuration
  // The `nextPlugin` might be an object or an array of configs
  ...(Array.isArray(nextPlugin) ? nextPlugin : [nextPlugin]),
  // You can add more custom rules or overrides here if needed
  // For example:
  // {
  //   files: ["src/**/*.js"],
  //   rules: {
  //     "no-unused-vars": "warn"
  //   }
  // }
];

export default eslintConfig;
