import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'apps/**/dist/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
