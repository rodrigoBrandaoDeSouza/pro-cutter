import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/.next-e2e/**',
      '**/node_modules/**',
      '.doc/**',
      '**/generated/**',
      '**/next-env.d.ts',
      'apps/web/src/components/ui/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
